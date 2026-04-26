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

// ─── Transaction ──────────────────────────────────────────────────────────────

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const transactionSchema = z.object({
  id: z.number().int(),
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  date: z.string().datetime(),
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
});

export const insertTransactionSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  type: transactionTypeSchema,
  categoryId: z.number().int().optional(),
});

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

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});
