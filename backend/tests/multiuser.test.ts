import { describe, it, expect, beforeAll } from "bun:test";
import { testClient } from "hono/testing";
import { client, ensureSettingsRow } from "../db";
import { hash } from "bcryptjs";
import { app } from "../server";

const testApp = testClient(app);

let adminToken: string;
let adminRefreshToken: string;
let userToken: string;
let userRefreshToken: string;
let adminId: number;
let userId: number;

beforeAll(async () => {
  try {
    client.exec("DELETE FROM refresh_tokens");
    client.exec("DELETE FROM transactions");
    client.exec("DELETE FROM categories WHERE user_id IS NOT NULL");
    client.exec("DELETE FROM settings");
    client.exec("DELETE FROM system_config");
    client.exec("DELETE FROM users");
  } catch {}

  const adminPw = await hash("admin12345", 12);
  const userPw = await hash("user12345", 12);
  client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", ["testadmin", adminPw]);
  client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')", ["testuser", userPw]);

  const admin = client.prepare("SELECT id FROM users WHERE username = 'testadmin'").get() as any;
  const user = client.prepare("SELECT id FROM users WHERE username = 'testuser'").get() as any;
  adminId = admin.id;
  userId = user.id;

  ensureSettingsRow(adminId);
  ensureSettingsRow(userId);

  client.exec("INSERT OR IGNORE INTO system_config (key, value) VALUES ('allow_registration', 'false')");

  const adminRes = await testApp.auth.login.$post({ json: { username: "testadmin", password: "admin12345" } });
  const adminBody = await adminRes.json();
  adminToken = adminBody.token;
  adminRefreshToken = adminBody.refreshToken;

  const userRes = await testApp.auth.login.$post({ json: { username: "testuser", password: "user12345" } });
  const userBody = await userRes.json();
  userToken = userBody.token;
  userRefreshToken = userBody.refreshToken;
});

describe("Multi-User Data Isolation", () => {
  describe("Auth", () => {
    it("blocks registration when allow_registration is false", async () => {
      const res = await testApp.auth.register.$post({
        json: { username: "newuser", password: "newuser12345", confirmPassword: "newuser12345" },
      });
      expect(res.status).toBe(403);
    });

    it("refreshes tokens and invalidates old refresh token", async () => {
      const res = await testApp.auth.refresh.$post({
        json: { refreshToken: adminRefreshToken },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      const oldRes = await testApp.auth.refresh.$post({
        json: { refreshToken: adminRefreshToken },
      });
      expect(oldRes.status).toBe(401);
    });

    it("rejects expired password change with wrong current password", async () => {
      const res = await testApp.auth["change-password"].$post(
        { json: { currentPassword: "wrongpassword", newPassword: "admin54321", confirmNewPassword: "admin54321" } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Transaction Isolation", () => {
    it("admin cannot see user transactions", async () => {
      await testApp.transactions.$post(
        { json: { amount: 500, currency: "USD", description: "user expense", date: "2025-01-29", type: "expense" } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );

      const adminRes = await testApp.transactions.$get(
        { query: { limit: "100" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const adminBody = await adminRes.json();
      const adminTxIds = adminBody.items.map((t: any) => t.id);
      const userTxRes = await testApp.transactions.$get(
        { query: { limit: "100" } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      const userBody = await userTxRes.json();
      const userTxIds = userBody.items.map((t: any) => t.id);
      expect(adminTxIds.every((id: number) => !userTxIds.includes(id))).toBe(true);
    });

    it("user cannot update admin transactions", async () => {
      const createRes = await testApp.transactions.$post(
        { json: { amount: 100, currency: "USD", description: "admin tx", date: "2025-01-29", type: "income" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(createRes.status).toBe(201);
      const tx = await createRes.json();

      const updateRes = await testApp.transactions[":id"].$put(
        { json: { amount: 999 }, param: { id: tx.id } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(updateRes.status).toBe(404);
    });

    it("user cannot delete admin transactions", async () => {
      const createRes = await testApp.transactions.$post(
        { json: { amount: 200, currency: "USD", description: "admin tx2", date: "2025-01-30", type: "expense" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const tx = await createRes.json();

      const deleteRes = await testApp.transactions[":id"].$delete(
        { param: { id: tx.id } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(deleteRes.status).toBe(200);

      const verifyRes = await testApp.transactions[":id"].$get(
        { param: { id: tx.id } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(verifyRes.status).toBe(200);
    });
  });

  describe("Category Isolation", () => {
    it("predefined categories are visible to all users", async () => {
      const adminRes = await testApp.categories.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminCats = await adminRes.json();
      const predefinedCount = adminCats.filter((c: any) => c.isPredefined).length;

      const userRes = await testApp.categories.$get(undefined, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const userCats = await userRes.json();
      const userPredefinedCount = userCats.filter((c: any) => c.isPredefined).length;

      expect(predefinedCount).toBe(userPredefinedCount);
      expect(predefinedCount).toBeGreaterThan(0);
    });

    it("custom category name collision with predefined is rejected", async () => {
      const res = await testApp.categories.$post(
        { json: { name: "Food", color: "#ff0000", type: "expense" } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(res.status).toBe(409);
    });

    it("user cannot update or delete predefined categories", async () => {
      const catsRes = await testApp.categories.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const cats = await catsRes.json();
      const predefined = cats.find((c: any) => c.isPredefined);

      const updateRes = await testApp.categories[":id"].$put(
        { json: { name: "Hacked", color: "#000000", type: "expense" }, param: { id: predefined.id } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(updateRes.status).toBe(404);

      const deleteRes = await testApp.categories[":id"].$delete(
        { param: { id: predefined.id } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(deleteRes.status).toBe(404);
    });
  });

  describe("Dashboard Isolation", () => {
    it("dashboard shows only user's financial data", async () => {
      await testApp.transactions.$post(
        { json: { amount: 10000, currency: "USD", description: "admin income", date: "2025-01-29", type: "income" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      const userRes = await testApp.dashboard.$get(undefined, {
        headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(userRes.status).toBe(200);
      const userBody = await userRes.json();
      expect(userBody.currentBalance).toBe(-500);
    });
  });

  describe("Settings Isolation", () => {
    it("each user has independent settings", async () => {
      const adminRes = await testApp.settings.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(adminRes.status).toBe(200);
      const adminSettings = await adminRes.json();
      expect(adminSettings.defaultCurrency).toBe("USD");

      const userRes = await testApp.settings.$get(undefined, {
        headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(userRes.status).toBe(200);
      const userSettings = await userRes.json();
      expect(userSettings.defaultCurrency).toBe("USD");
    });

    it("user currency change only affects their transactions", async () => {
      const userUpdateRes = await testApp.settings.$put(
        { json: { defaultCurrency: "EUR" } },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(userUpdateRes.status).toBe(200);

      const adminRes = await testApp.settings.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const adminSettings = await adminRes.json();
      expect(adminSettings.defaultCurrency).toBe("USD");
    });
  });

  describe("Admin", () => {
    it("admin cannot delete themselves", async () => {
      const res = await testApp.admin.users[":id"].$delete(
        { param: { id: adminId } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(res.status).toBe(403);
    });

    it("admin can list users", async () => {
      const res = await testApp.admin.users.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it("admin can delete a user with cascade", async () => {
      const createRes = await testApp.admin.users.$post(
        { json: { username: "deleteme", password: "deleteme12345", role: "user" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(createRes.status).toBe(201);
      const createdUser = await createRes.json();

      const deleteRes = await testApp.admin.users[":id"].$delete(
        { param: { id: createdUser.id } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(deleteRes.status).toBe(200);

      const listRes = await testApp.admin.users.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const users = await listRes.json();
      expect(users.find((u: any) => u.id === createdUser.id)).toBeUndefined();
    });

    it("admin can toggle registration", async () => {
      const configRes = await testApp.admin.config.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(configRes.status).toBe(200);
      const config = await configRes.json();
      expect(config["allow_registration"]).toBe("false");

      const toggleRes = await testApp.admin.config[":key"].$put(
        { json: { value: "true" }, param: { key: "allow_registration" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(toggleRes.status).toBe(200);

      const regRes = await testApp.auth.register.$post(
        { json: { username: "newuser1", password: "newuser12345", confirmPassword: "newuser12345" } },
      );
      expect(regRes.status).toBe(201);

      const toggleBackRes = await testApp.admin.config[":key"].$put(
        { json: { value: "false" }, param: { key: "allow_registration" } },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(toggleBackRes.status).toBe(200);

      const blockedRes = await testApp.auth.register.$post(
        { json: { username: "newuser2", password: "newuser12345", confirmPassword: "newuser12345" } },
      );
      expect(blockedRes.status).toBe(403);
    });

    it("non-admin cannot access admin endpoints", async () => {
      const res = await testApp.admin.users.$get(undefined, {
        headers: { Authorization: `Bearer ${userToken}` } },
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Protected Routes", () => {
    it("rejects unauthenticated requests to all protected routes", async () => {
      const endpoints = [
        { method: "GET" as const, path: testApp.transactions.$get },
        { method: "GET" as const, path: testApp.categories.$get },
        { method: "GET" as const, path: testApp.settings.$get },
        { method: "GET" as const, path: testApp.dashboard.$get },
      ];

      for (const endpoint of endpoints) {
        const res = await endpoint.path();
        expect(res.status).toBe(401);
      }
    });
  });
});