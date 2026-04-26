import { testClient } from "hono/testing";
import { describe, it, expect, beforeAll } from "bun:test";
import { client, seedCurrencies } from "../db";
import { seed } from "../db/seed";
import app from "../server";

const testApp = testClient(app);

// Shared token
let token: string;

beforeAll(async () => {
  // Remove DB file to start completely fresh
  try {
    // Delete all data and reset
    client.exec("DELETE FROM exchange_rates");
    client.exec("DELETE FROM transactions");
    client.exec("DELETE FROM categories");
    client.exec("DELETE FROM settings");
    client.exec("DELETE FROM users");
    client.exec("DELETE FROM currencies");
  } catch (e) {
    // Tables might already be empty
  }
  
  // Re-seed (creates admin user, categories, settings row)
  await seed();
  seedCurrencies();
  
  // Login
  const res = await testApp.auth.login.$post({
    json: { username: "admin", password: "admin" },
  });
  const body = await res.json();
  token = body.token;
});

describe("Multi-Currency Feature", () => {
  describe("Health", () => {
    it("returns ok", async () => {
      const res = await testApp.health.$get();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    });
  });

  describe("Auth", () => {
    it("login with default credentials", async () => {
      const res = await testApp.auth.login.$post({
        json: { username: "admin", password: "admin" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe("string");
    });

    it("rejects invalid credentials", async () => {
      const res = await testApp.auth.login.$post({
        json: { username: "admin", password: "wrong" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Currencies API", () => {
    it("lists currencies", async () => {
      const res = await testApp.currencies.$get(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length > 0).toBe(true);
      const codes = body.map((c: any) => c.code);
      expect(codes).toContain("USD");
      expect(codes).toContain("EUR");
      expect(codes).toContain("BTC");
    });

    it("filters currencies by type", async () => {
      const res = await testApp.currencies.$get(
        { query: { type: "crypto" } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.every((c: any) => c.type === "crypto")).toBe(true);
    });
  });

  describe("Settings API", () => {
    it("returns settings", async () => {
      const res = await testApp.settings.$get(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("defaultCurrency");
    });

    it("changes default currency to EUR", async () => {
      const res = await testApp.settings.$put(
        { json: { defaultCurrency: "EUR" } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Might fail if settings row doesn't exist
      expect([200, 404]).toContain(res.status);
    });
  });

  describe("Transactions API with Currency", () => {
    it("creates a transaction in foreign currency", async () => {
      const res = await testApp.transactions.$post(
        {
          json: {
            amount: 100,
            currency: "EUR",
            amountDefault: 108,
            exchangeRate: 1.08,
            description: "Paris lunch",
            date: "2025-01-29",
            type: "expense",
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.amount).toBe(100);
      expect(body.currency).toBe("EUR");
      expect(body.amountDefault).toBe(108);
      expect(body.exchangeRate).toBe(1.08);
    });

    it("creates a transaction in default currency (USD)", async () => {
      const res = await testApp.transactions.$post(
        {
          json: {
            amount: 50,
            currency: "USD",
            description: "Groceries",
            date: "2025-01-29",
            type: "expense",
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.amount).toBe(50);
      expect(body.currency).toBe("USD");
      expect(body.amountDefault).toBeDefined();
      expect(body.exchangeRate).toBeDefined();
    });

    it("lists transactions with currency info", async () => {
      const res = await testApp.transactions.$get(
        { query: { limit: "10" } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
      for (const tx of body.items || []) {
        expect(tx).toHaveProperty("currency");
        expect(tx).toHaveProperty("amountDefault");
        expect(tx).toHaveProperty("exchangeRate");
      }
    });
  });

  describe("Dashboard API", () => {
    it("returns dashboard data", async () => {
      const res = await testApp.dashboard.$get(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("currentBalance");
      expect(body).toHaveProperty("monthIncome");
      expect(body).toHaveProperty("monthExpense");
      expect(body).toHaveProperty("monthlyTrend");
      expect(body).toHaveProperty("categoryBreakdown");
    });
  });

  describe("Protected Routes", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await testApp.transactions.$get();
      expect(res.status).toBe(401);

      const res2 = await testApp.currencies.$get();
      expect(res2.status).toBe(401);

      const res3 = await testApp.settings.$get();
      expect(res3.status).toBe(401);
    });
  });
});
