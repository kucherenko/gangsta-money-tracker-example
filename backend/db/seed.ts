import { client, ensureSettingsRow } from "./index";
import { hash } from "bcryptjs";

const DEFAULT_CATEGORIES = [
  { name: "Salary", color: "#22c55e", icon: "Wallet", type: "income", isPredefined: 1 },
  { name: "Freelance", color: "#14b8a6", icon: "Briefcase", type: "income", isPredefined: 1 },
  { name: "Food", color: "#ef4444", icon: "UtensilsCrossed", type: "expense", isPredefined: 1 },
  { name: "Transport", color: "#3b82f6", icon: "Car", type: "expense", isPredefined: 1 },
  { name: "Utilities", color: "#f59e0b", icon: "Zap", type: "expense", isPredefined: 1 },
  { name: "Entertainment", color: "#8b5cf6", icon: "Film", type: "expense", isPredefined: 1 },
  { name: "Shopping", color: "#ec4899", icon: "ShoppingBag", type: "expense", isPredefined: 1 },
  { name: "Health", color: "#06b6d4", icon: "Heart", type: "expense", isPredefined: 1 },
  { name: "Education", color: "#6366f1", icon: "GraduationCap", type: "expense", isPredefined: 1 },
  { name: "Other", color: "#64748b", icon: "Tag", type: "expense", isPredefined: 1 },
];

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

export async function seed() {
  try {
    const userResult = client.prepare("SELECT * FROM users WHERE username = ?").get(ADMIN_USERNAME);
    if (!userResult) {
      const passwordHash = await hash(ADMIN_PASSWORD, 12);
      client.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(ADMIN_USERNAME, passwordHash);
      console.log(`Created admin user (username: ${ADMIN_USERNAME})`);
    }

    const catResult = client.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
    if (catResult.count === 0) {
      const stmt = client.prepare("INSERT INTO categories (name, color, icon, type, is_predefined) VALUES (?, ?, ?, ?, ?)");
      for (const cat of DEFAULT_CATEGORIES) {
        stmt.run(cat.name, cat.color, cat.icon, cat.type, cat.isPredefined);
      }
      console.log(`Created ${DEFAULT_CATEGORIES.length} default categories`);
    }
  } catch (e) {
    console.error("Seed error:", e);
  }
}
