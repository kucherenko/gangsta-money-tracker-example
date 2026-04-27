import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { query } from "../db";
import { OllamaOcrService, MockOcrService } from "../services/ocr";
import { renderPdfFirstPage } from "../services/pdfRenderer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  RECEIPT_MAX_SIZE_BYTES,
  RECEIPT_ACCEPTED_MIME_TYPES,
  RECEIPT_ACCEPTED_EXTENSIONS,
} from "@money-tracker/shared/receipts";

const ocr = new Hono();

ocr.use("*", authMiddleware);

async function getCategoriesAndCurrencies() {
  const categoriesRows = query("SELECT name FROM categories") as any[];
  const categories = categoriesRows.map((r) => r.name).filter(Boolean);

  const currenciesRows = query("SELECT code FROM currencies WHERE is_active = 1") as any[];
  const currencies = currenciesRows.map((r) => r.code).filter(Boolean);

  return { categories, currencies };
}

async function runOcr(tempPath: string, rawExt: string): Promise<{ suggestion: any; tempId: string; tempExt: string }> {
  const tempDir = path.resolve("data/temp_receipts");

  // If PDF, render first page to PNG for OCR
  let ocrPath = tempPath;
  if (rawExt === "pdf" && process.env.NODE_ENV !== "test") {
    const pngPath = path.join(tempDir, `${randomUUID()}.png`);
    try {
      await renderPdfFirstPage(tempPath, pngPath);
      ocrPath = pngPath;
    } catch (err: any) {
      throw new HTTPException(422, {
        message: `Could not render PDF to image: ${err.message || "Unknown error"}`,
      });
    }
  }

  const { categories, currencies } = await getCategoriesAndCurrencies();
  const ocrService = process.env.NODE_ENV === 'test' ? new MockOcrService() : new OllamaOcrService();
  const suggestion = await ocrService.extractReceipt(ocrPath, { categories, currencies });

  // Extract tempId from tempPath
  const basename = path.basename(tempPath);
  const dotIndex = basename.lastIndexOf('.');
  const tempId = dotIndex >= 0 ? basename.slice(0, dotIndex) : basename;

  return { suggestion, tempId, tempExt: rawExt };
}

ocr.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("image");

  if (!file || typeof file !== "object" || !("size" in file) || typeof (file as any).size !== "number") {
    throw new HTTPException(400, { message: "No receipt file provided" });
  }

  if (file.size > RECEIPT_MAX_SIZE_BYTES) {
    throw new HTTPException(413, {
      message: `File too large. Maximum size is ${RECEIPT_MAX_SIZE_BYTES / (1024 * 1024)} MB.`,
    });
  }

  if (!RECEIPT_ACCEPTED_MIME_TYPES.includes(file.type as any)) {
    throw new HTTPException(400, { message: `Unsupported file type: ${file.type}` });
  }

  const rawExt = path.extname(file.name || "").toLowerCase().replace(/^\./, "");
  if (!RECEIPT_ACCEPTED_EXTENSIONS.includes(rawExt as any)) {
    throw new HTTPException(400, { message: `Unsupported file extension: ${rawExt || "unknown"}` });
  }

  const tempDir = path.resolve("data/temp_receipts");
  mkdirSync(tempDir, { recursive: true });

  const tempId = randomUUID();
  const tempPath = path.join(tempDir, `${tempId}.${rawExt}`);
  await Bun.write(tempPath, file);

  const result = await runOcr(tempPath, rawExt);
  return c.json(result);
});

ocr.post("/url", async (c) => {
  const body = await c.req.json();
  const url = body?.url;

  if (!url || typeof url !== "string") {
    throw new HTTPException(400, { message: "URL is required" });
  }

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    throw new HTTPException(400, { message: "Invalid URL format" });
  }

  // Only allow http/https
  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    throw new HTTPException(400, { message: "Only HTTP and HTTPS URLs are supported" });
  }

  // Fetch the receipt with a browser-like User-Agent
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    } as any);
  } catch (err: any) {
    throw new HTTPException(422, { message: `Failed to fetch URL: ${err.message || "Network error"}` });
  }

  // If the response is not OK, we can still try text extraction from the URL itself
  const contentType = response.headers.get("content-type") || "";
  const contentLength = Number(response.headers.get("content-length") || "0");
  const lowerContentType = contentType.toLowerCase();

  // Check if it's a downloadable receipt (image or PDF)
  const isImageOrPdf = lowerContentType.includes("image/")
    || lowerContentType.includes("application/pdf");

  let htmlContent: string | null = null;

  if (!isImageOrPdf) {
    // It's HTML or similar — try extracting text
    const text = await response.text().catch(() => "");
    htmlContent = text;
  }

  // If it's an image/PDF AND response is OK, treat as downloadable receipt
  if (isImageOrPdf && response.ok) {
    if (contentLength > RECEIPT_MAX_SIZE_BYTES) {
      throw new HTTPException(413, {
        message: `File too large. Maximum size is ${RECEIPT_MAX_SIZE_BYTES / (1024 * 1024)} MB.`,
      });
    }

    // Determine extension
    let rawExt = "";
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    for (const [mime, ext] of Object.entries(mimeToExt)) {
      if (lowerContentType.includes(mime)) {
        rawExt = ext;
        break;
      }
    }
    if (!rawExt) {
      rawExt = path.extname(urlObj.pathname).toLowerCase().replace(/^\./, "");
    }

    const tempDir = path.resolve("data/temp_receipts");
    mkdirSync(tempDir, {recursive: true});
    const tempId = randomUUID();
    const tempPath = path.join(tempDir, `${tempId}.${rawExt}`);
    const arrayBuffer = await response.arrayBuffer();
    await Bun.write(tempPath, new Uint8Array(arrayBuffer));

    const result = await runOcr(tempPath, rawExt);
    return c.json(result);
  }

  // Fallback: text-based extraction from URL (and any HTML)
  const pageText = htmlContent
    ? htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : null;

  const { categories, currencies } = await getCategoriesAndCurrencies();
  const ocrService = process.env.NODE_ENV === 'test' ? new MockOcrService() : new OllamaOcrService();
  const suggestion = await ocrService.extractReceiptFromUrl(url, {
    categories,
    currencies,
    pageText: pageText || undefined,
  });

  // No actual file to persist, but return a tempId for consistency
  const tempId = randomUUID();
  return c.json({ suggestion, tempId, tempExt: "url" });
});

export default ocr;
