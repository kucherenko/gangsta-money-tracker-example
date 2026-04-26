import { Hono } from "hono";
import { testClient } from "hono/testing";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../db";
import { categories, transactions, users } from "../db/schema";
import app from "../server";

const client = testClient(app);

// Reset DB before tests
beforeAll(() => {
  db.delete(transactions);
  db.delete(categories);
  db.delete(users);
});

describe("Health", () => {
  it("returns ok", async () => {
    const res = await client.health.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

describe("Auth", () => {
  it("login with default credentials", async () => {
    const res = await client.auth.login.$post({
      json: { username: "admin", password: "admin" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
  });

  it("rejects invalid credentials", async () => {
    const res = await client.auth.login.$post({
      json: { username: "admin", password: "wrong" },
    });
    expect(res.status).toBe(401);
  });
});

describe("Transactions API", () => {
  let token: string;

  beforeAll(async () => {
    const res = await client.auth.login.$post({
      json: { username: "admin", password: "admin" },
    });
    const body = await res.json();
    token = body.token;
  });

  it("creates a transaction", async () => {
    const cats = await client.categories.$get(undefined, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catList = await cats.json();
    const foodCat = catList.find((c: any) => c.name === "Food");

    const res = await client.transactions.$post(
      {
        json: {
          amount: 25.5,
          description: "Lunch",
          date: "2025-01-15",
          type: "expense",
          categoryId: foodCat?.id,
        },
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.amount).toBe(25.5);
    expect(body.type).toBe("expense");
  });

  it("lists transactions", async () => {
    const res = await client.transactions.$get(
      { query: { limit: "10" } },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length >= 0).toBe(true);
  });

  it("filters transactions by type", async () => {
    const res = await client.transactions.$get(
      { query: { type: "expense", limit: "10" } },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const item of body.items || []) {
      expect(item.type).toBe("expense");
    }
  });
});

describe("Dashboard API", () => {
  let token: string;

  beforeAll(async () => {
    const res = await client.auth.login.$post({
      json: { username: "admin", password: "admin" },
    });
    const body = await res.json();
    token = body.token;
  });

  it("returns dashboard data", async () => {
    const res = await client.dashboard.$get(undefined, {
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
    const res = await client.transactions.$get();
    expect(res.status).toBe(401);
  });
});
