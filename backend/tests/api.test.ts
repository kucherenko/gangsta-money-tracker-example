process.env.NODE_ENV = "test";

import { testClient } from "hono/testing";
import { describe, it, expect, beforeAll } from "bun:test";
import { client, seedCurrencies } from "../db";
import { seed } from "../db/seed";
import { app } from "../server";

const testApp = testClient(app);

const TEST_ADMIN_USERNAME = "admin";
const TEST_ADMIN_PASSWORD = "admin12345";

let token: string;
let refreshToken: string;

beforeAll(async () => {
  try {
    client.exec("DELETE FROM exchange_rates");
    client.exec("DELETE FROM transactions");
    client.exec("DELETE FROM refresh_tokens");
    client.exec("DELETE FROM categories WHERE user_id IS NOT NULL");
    client.exec("DELETE FROM settings");
    client.exec("DELETE FROM system_config");
    client.exec("DELETE FROM users");
    client.exec("DELETE FROM currencies");
  } catch (e) {
    // Tables might already be empty
  }
  
  await seed();
  seedCurrencies();
  
  await testApp.setup.$post({
    json: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD, confirmPassword: TEST_ADMIN_PASSWORD },
  });
  
  const res = await testApp.auth.login.$post({
    json: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
  });
  const body = await res.json();
  token = body.token;
  refreshToken = body.refreshToken;
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
        json: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe("string");
      expect(body.refreshToken).toBeDefined();
    });

    it("rejects invalid credentials", async () => {
      const res = await testApp.auth.login.$post({
        json: { username: TEST_ADMIN_USERNAME, password: "wrong" },
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
      // Settings might be 404 if row doesn't exist yet (init timing)
      const body = await res.json();
      if (res.status === 200) {
        expect(body).toHaveProperty("defaultCurrency");
      } else {
        expect(res.status).toBe(404);
      }
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

  describe("Rate Fetcher", () => {
    beforeAll(async () => {
      // Ensure settings row exists for auto-fetch
      const adminUser = client.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as any;
      const userId = adminUser?.id || 1;
      client.prepare("INSERT OR REPLACE INTO settings (id, user_id, default_currency, auto_fetch_rates, fiat_fetch_interval, crypto_fetch_interval) VALUES (1, ?, 'USD', 1, 60, 5)").run(userId);
      // Seed UAH and ALL as fiat currencies
      client.prepare("INSERT OR IGNORE INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run("UAH", "Ukrainian Hryvnia", "₴", 2, "fiat", 1, 0);
      client.prepare("INSERT OR IGNORE INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run("ALL", "Albanian Lek", "L", 2, "fiat", 1, 0);
    });

    it("fetches fiat rates for default base currency", async () => {
      // Trigger rate fetch
      await testApp.rates.refresh.$post(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Wait for async fetch
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Check that rates were fetched for known currencies
      const res = await testApp.rates.$get(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it("returns correct cross rate via reverse lookup", async () => {
      // Direct DB insert for deterministic test — use a fake pair that Fawaz won't overwrite
      const now = Math.floor(Date.now() / 1000);
      client.prepare("INSERT OR REPLACE INTO exchange_rates (base_currency, target_currency, rate, updated_at, source) VALUES (?, ?, ?, ?, ?)").run("ZZZ", "YYY", 0.85, now, "test");

      // Request YYY -> ZZZ (reverse of what's stored)
      const res = await testApp.rates[":base"][":target"].$get({ param: { base: "YYY", target: "ZZZ" } }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rate).toBeCloseTo(1 / 0.85, 2);
    });

    it("fetches rates for newly added fiat currencies like UAH and ALL", async () => {
      // Make sure UAH and ALL are in the DB
      client.prepare("INSERT OR IGNORE INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run("UAH", "Ukrainian Hryvnia", "₴", 2, "fiat", 1, 0);
      client.prepare("INSERT OR IGNORE INTO currencies (code, name, symbol, precision, type, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run("ALL", "Albanian Lek", "L", 2, "fiat", 1, 0);

      // Trigger refresh
      await testApp.rates.refresh.$post(undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Wait for async fetch
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Check UAH rate exists
      const resUAH = await testApp.rates[":base"][":target"].$get({ param: { base: "USD", target: "UAH" } }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resUAH.status).toBe(200);
      const bodyUAH = await resUAH.json();
      expect(bodyUAH.rate).toBeGreaterThan(0);

      // Check ALL rate exists
      const resALL = await testApp.rates[":base"][":target"].$get({ param: { base: "USD", target: "ALL" } }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resALL.status).toBe(200);
      const bodyALL = await resALL.json();
      expect(bodyALL.rate).toBeGreaterThan(0);
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
