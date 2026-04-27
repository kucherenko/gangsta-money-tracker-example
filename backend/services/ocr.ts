import { receiptExtractSchema, type ReceiptExtract } from "@money-tracker/shared/schemas";

export interface OcrService {
  extractReceipt(
    filePath: string,
    options?: { categories?: string[]; currencies?: string[] }
  ): Promise<ReceiptExtract>;

  extractReceiptFromUrl(
    url: string,
    options?: { categories?: string[]; currencies?: string[]; pageText?: string }
  ): Promise<ReceiptExtract>;
}

function buildCategories(options?: { categories?: string[] }) {
  return options?.categories || [
    "Food", "Transport", "Utilities", "Entertainment",
    "Shopping", "Health", "Education", "Other"
  ];
}

function buildCurrencies(options?: { currencies?: string[] }) {
  return options?.currencies || [
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD",
    "AUD", "NZD", "SEK", "NOK", "DKK", "PLN",
    "CZK", "HUF", "RON", "BGN", "HRK", "TRY",
    "MXN", "ZAR", "BTC", "ETH", "SOL", "XRP", "ADA"
  ];
}

async function ollamaGenerate(baseUrl: string, model: string, prompt: string, bodyExtra?: Record<string, any>): Promise<string> {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      ...bodyExtra,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Ollama request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as any;
  return data.response ?? "";
}

function parseLlmJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Ollama returned invalid JSON");
  }
}

function validateLlmResult(parsed: any): ReceiptExtract {
  const validated = receiptExtractSchema.safeParse(parsed);
  if (!validated.success) {
    const issues = (validated.error?.issues || validated.error?.errors || [])
      .map((e: any) => `${e.path.join('.')}: ${e.message}`)
      .join("; ") || "Unknown validation error";
    throw new Error(`OCR extraction failed validation: ${issues}`);
  }
  return validated.data;
}

function computeConfidence(result: ReceiptExtract, currencies: string[]) {
  const amountNum = parseFloat(result.amount);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const parsedDate = new Date(result.date);

  let confidence: "high" | "medium" | "low" = "high";

  if (isNaN(amountNum) || amountNum <= 0 || amountNum >= 1_000_000) {
    confidence = "low";
  }
  if (parsedDate < fiveYearsAgo || parsedDate > today) {
    confidence = confidence === "high" ? "medium" : "low";
  }
  if (result.currency && !currencies.includes(result.currency.toUpperCase())) {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return { ...result, confidence };
}

export class OllamaOcrService implements OcrService {
  constructor(
    private model: string = process.env.OLLAMA_MODEL!,
    private baseUrl: string = process.env.OLLAMA_HOST!
  ) {
    if (!this.model) {
      throw new Error("OLLAMA_MODEL environment variable is required");
    }
    if (!this.baseUrl) {
      throw new Error("OLLAMA_HOST environment variable is required");
    }
  }

  async extractReceipt(
    filePath: string,
    options?: { categories?: string[]; currencies?: string[] }
  ): Promise<ReceiptExtract> {
    const imageBuffer = await Bun.file(filePath).arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");

    const categories = buildCategories(options);
    const currencies = buildCurrencies(options);

    const prompt = `You are a receipt OCR assistant. Analyze the attached receipt document and extract the following fields as a JSON object:

- amount: a plain numeric string (digits and optional decimal point only — no commas, no currency symbols, no thousands separators)
- currency: a 3-letter ISO 4217 currency code from this list: ${currencies.join(", ")}
- date: in YYYY-MM-DD format
- description: a short description of what the transaction is for (max 255 characters). If unclear, use null.
- category: the most appropriate category from this exact list: ${categories.join(", ")}. If none match, use null.

Return ONLY raw JSON — no markdown code fences, no explanations. Example:
{"amount":"12.50","currency":"USD","date":"2025-04-26","description":"Coffee at Starbucks","category":"Food"}`;

    const rawContent = await ollamaGenerate(this.baseUrl, this.model, prompt, { images: [base64] });
    const parsed = parseLlmJson(rawContent);
    const result = validateLlmResult(parsed);
    return computeConfidence(result, currencies);
  }

  async extractReceiptFromUrl(
    url: string,
    options?: { categories?: string[]; currencies?: string[]; pageText?: string }
  ): Promise<ReceiptExtract> {
    const categories = buildCategories(options);
    const currencies = buildCurrencies(options);

    const pageContext = options?.pageText
      ? `Here is some text content extracted from the e-receipt page:\n---\n${options.pageText.slice(0, 4000)}\n---\n`
      : "";

    const prompt = `You are a receipt data extraction assistant. A user has provided a URL to an electronic receipt (e-receipt). Extract the transaction details from the URL parameters and any page content.

URL: ${url}

${pageContext}

Extract and return a JSON object with these fields:
- amount: a plain numeric string (digits and optional decimal point only — no commas, no currency symbols, no thousands separators)
- currency: a 3-letter ISO 4217 currency code from this list: ${currencies.join(", ")}
- date: in YYYY-MM-DD format
- description: a short description of what the transaction is for (max 255 characters). If unclear, try to infer from the URL/domain. If still unclear, use null.
- category: the most appropriate category from this exact list: ${categories.join(", ")}. If none match, use null.

Tips for extracting from URL parameters:
- Look for parameters like 'prc', 'price', 'amount', 'sum', 'total', 'amt' for the amount.
- Look for parameters like 'crtd', 'date', 'created', 'dt' for the date.
- Look for parameters like 'ord', 'order', 'invoice', 'iic' for a description.
- Look for domain-specific hints about currency.

Return ONLY raw JSON — no markdown code fences, no explanations. Example:
{"amount":"8260.78","currency":"ALL","date":"2025-04-22","description":"Invoice #27817","category":"Other"}`;

    const rawContent = await ollamaGenerate(this.baseUrl, this.model, prompt);
    const parsed = parseLlmJson(rawContent);
    const result = validateLlmResult(parsed);
    return computeConfidence(result, currencies);
  }
}

export class MockOcrService implements OcrService {
  async extractReceipt(): Promise<ReceiptExtract> {
    return {
      amount: "10.00",
      currency: "USD",
      date: new Date().toISOString().split("T")[0],
      description: "Mock receipt",
      category: "Food",
      confidence: "high",
    };
  }

  async extractReceiptFromUrl(): Promise<ReceiptExtract> {
    return {
      amount: "8260.78",
      currency: "ALL",
      date: "2026-04-22",
      description: "E-invoice from efiskalizimi-app",
      category: "Other",
      confidence: "medium",
    };
  }
}
