import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { query, getOne } from "../db";

const dashboard = new Hono();

dashboard.use("*", authMiddleware);

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getYearStart() {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function getMonthEnd() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

dashboard.get("/", async (c) => {
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();
  const yearStart = getYearStart();

  // All transactions
  const allTx = query("SELECT * FROM transactions");

  // Monthly transactions
  const monthTx = query("SELECT * FROM transactions WHERE date >= ? AND date <= ?", [monthStart, monthEnd]);

  // Year transactions
  const yearTx = query("SELECT * FROM transactions WHERE date >= ?", [yearStart]);

  // Current balance
  const totalIncome = allTx.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + t.amount, 0);
  const totalExpense = allTx.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0);

  // Monthly totals
  const monthIncome = monthTx.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + t.amount, 0);
  const monthExpense = monthTx.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0);

  // Year totals
  const yearIncome = yearTx.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + t.amount, 0);
  const yearExpense = yearTx.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0);

  // Monthly trend (last 6 months)
  const months = getLast6Months();
  const monthlyTrend = months.map((m: string) => {
    const monthTx2 = allTx.filter((t: any) => t.date.startsWith(m));
    return {
      month: m,
      income: monthTx2.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + t.amount, 0),
      expense: monthTx2.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0),
    };
  });

  // Category breakdown
  const categoriesList = query("SELECT id, name, color FROM categories");
  const categoryBreakdown = categoriesList.map((cat: any) => {
    const catTotal = monthTx
      .filter((t: any) => t.category_id === cat.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    return {
      categoryId: cat.id,
      name: cat.name,
      total: catTotal,
      color: cat.color,
    };
  }).filter((c: any) => c.total > 0);

  return c.json({
    currentBalance: totalIncome - totalExpense,
    monthIncome,
    monthExpense,
    yearIncome,
    yearExpense,
    monthlyTrend,
    categoryBreakdown,
  });
});

export default dashboard;
