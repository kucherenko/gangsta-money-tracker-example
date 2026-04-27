import { z } from "zod";

// ─── User ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

export const userSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  passwordHash: z.string(),
  token: z.string().nullable().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;

// ─── Category ─────────────────────────────────────────────────────────────────

export const categoryTypeSchema = z.enum(["income", "expense"]);

export const categorySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(50),
  color: z.string().max(7).default("#64748b"),
  icon: z.string().max(50).optional(),
  type: categoryTypeSchema,
  isPredefined: z.number().int().default(0),
});

export const insertCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).min(4).default("#64748b"),
  icon: z.string().max(50).optional(),
  type: categoryTypeSchema,
});

export type Category = z.infer<typeof categorySchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// ─── Currency ─────────────────────────────────────────────────────────────────

export const currencyTypeSchema = z.enum(["fiat", "crypto"]);

export const currencySchema = z.object({
  id: z.number().int(),
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(50),
  symbol: z.string().max(10).optional(),
  precision: z.number().int().min(0).max(18).default(2),
  type: currencyTypeSchema,
  isActive: z.number().int().default(1),
});

export const insertCurrencySchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(50),
  symbol: z.string().max(10).optional(),
  precision: z.number().int().min(0).max(18).default(2),
  type: currencyTypeSchema,
});

export type Currency = z.infer<typeof currencySchema>;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;

// ─── Settings ───────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  id: z.number().int().optional(),
  userId: z.number().int().nullable().optional(),
  defaultCurrency: z.string().min(1).max(10).default("USD"),
  fiatFetchInterval: z.number().int().min(1).max(1440).default(60),
  cryptoFetchInterval: z.number().int().min(1).max(1440).default(5),
  autoFetchRates: z.number().int().default(1),
  showCryptoOnDashboard: z.number().int().default(1),
});

export const updateSettingsSchema = settingsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// ─── Exchange Rate ──────────────────────────────────────────────────────────────

export const exchangeRateSchema = z.object({
  id: z.number().int().optional(),
  baseCurrency: z.string().min(1).max(10),
  targetCurrency: z.string().min(1).max(10),
  rate: z.number().positive(),
  updatedAt: z.string().datetime().optional(),
  source: z.enum(["frankfurter", "coingecko", "fawaz"]),
});

export type ExchangeRate = z.infer<typeof exchangeRateSchema>;

// ─── Transaction ──────────────────────────────────────────────────────────────

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const transactionSchema = z.object({
  id: z.number().int(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(10).default("USD"),
  amountDefault: z.number().positive(),
  exchangeRate: z.number().positive().optional(),
  description: z.string().max(255).optional(),
  date: z.string().datetime(),
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
});

export const insertTransactionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1).max(10).default("USD"),
  amountDefault: z.number().positive().optional(),
  exchangeRate: z.number().positive().optional(),
  description: z.string().max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
});

// Backend computes amountDefault if not provided
export const computedTransactionSchema = insertTransactionSchema.transform((data) => ({
  ...data,
  amountDefault: data.amountDefault ?? data.amount,
  exchangeRate: data.exchangeRate ?? 1.0,
}));

export const updateTransactionSchema = insertTransactionSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

export type Transaction = z.infer<typeof transactionSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardSchema = z.object({
  currentBalance: z.number(),
  monthIncome: z.number(),
  monthExpense: z.number(),
  yearIncome: z.number(),
  yearExpense: z.number(),
  monthlyTrend: z.array(
    z.object({
      month: z.string(),
      income: z.number(),
      expense: z.number(),
    }),
  ),
  categoryBreakdown: z.array(
    z.object({
      categoryId: z.number().int(),
      name: z.string(),
      total: z.number(),
    }),
  ),
});

export type DashboardData = z.infer<typeof dashboardSchema>;

// ─── API Response ─────────────────────────────────────────────────────────────

// ─── Receipt OCR ────────────────────────────────────────────────────────────────

export const receiptExtractSchema = z.object({
  amount: z.string().regex(/^\d+\.?\d*$/),
  currency: z.string().min(3).max(3).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(255).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export type ReceiptExtract = z.infer<typeof receiptExtractSchema>;

export const receiptUploadResponseSchema = z.object({
  suggestion: receiptExtractSchema,
  tempId: z.string(),
  tempExt: z.string(),
});

export type ReceiptUploadResponse = z.infer<typeof receiptUploadResponseSchema>;

// ─── API Response ─────────────────────────────────────────────────────────────

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});
