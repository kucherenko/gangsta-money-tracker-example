process.env.NODE_ENV = "test";

import { testClient } from "hono/testing";
import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { client, ensureSettingsRow } from "../db";
import { hash } from "bcryptjs";
import { app } from "../server";

const testApp = testClient(app);

let adminToken: string;

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
  client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", ["testadmin", adminPw]);
  const admin = client.prepare("SELECT id FROM users WHERE username = 'testadmin'").get() as any;
  ensureSettingsRow(admin.id);
  client.exec("INSERT OR IGNORE INTO system_config (key, value) VALUES ('allow_registration', 'false')");

  const adminRes = await testApp.auth.login.$post({ json: { username: "testadmin", password: "admin12345" } });
  const adminBody = await adminRes.json();
  adminToken = adminBody.token;
});

describe("Setup Endpoint", () => {
  describe("POST /setup", () => {
    it("returns 409 when admin already exists", async () => {
      const res = await testApp.setup.$post({
        json: { username: "newadmin", password: "password123", confirmPassword: "password123" },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message || body.error).toContain("already completed");
    });
  });

  describe("GET /auth/config/register", () => {
    it("returns needsSetup: false when admin exists", async () => {
      const res = await testApp.auth.config.register.$get();
      const body = await res.json();
      expect(body.needsSetup).toBe(false);
    });
  });

  describe("Last admin deletion guard", () => {
    it("prevents deleting the last admin user", async () => {
      const users = await testApp.admin.users.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const userList = await users.json();
      const admin = userList.find((u: any) => u.role === "admin");
      expect(admin).toBeDefined();

      const res = await testApp.admin.users[":id"].$delete({
        param: { id: String(admin.id) },
      }, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(403);
    });

    it("allows deleting a non-last admin", async () => {
      const userPw = await hash("user12345", 12);
      client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", ["secondadmin", userPw]);
      const secondAdmin = client.prepare("SELECT id FROM users WHERE username = 'secondadmin'").get() as any;
      ensureSettingsRow(secondAdmin.id);

      const users = await testApp.admin.users.$get(undefined, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const userList = await users.json();
      const secondAdminUser = userList.find((u: any) => u.username === "secondadmin");
      expect(secondAdminUser).toBeDefined();

      const res = await testApp.admin.users[":id"].$delete({
        param: { id: String(secondAdminUser.id) },
      }, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });
});

describe("Fresh Setup", () => {
  beforeAll(async () => {
    try {
      client.exec("DELETE FROM refresh_tokens");
      client.exec("DELETE FROM transactions");
      client.exec("DELETE FROM categories WHERE user_id IS NOT NULL");
      client.exec("DELETE FROM settings");
      client.exec("DELETE FROM system_config");
      client.exec("DELETE FROM users");
    } catch {}
  });

  describe("GET /auth/config/register (no admin)", () => {
    it("returns needsSetup: true when no admin exists", async () => {
      const res = await testApp.auth.config.register.$get();
      const body = await res.json();
      expect(body.needsSetup).toBe(true);
    });

    it("returns allowRegistration: false when no admin exists", async () => {
      const res = await testApp.auth.config.register.$get();
      const body = await res.json();
      expect(body.allowRegistration).toBe(false);
    });
  });

  describe("POST /setup (fresh database)", () => {
    it("creates admin user successfully", async () => {
      const res = await testApp.setup.$post({
        json: { username: "setupadmin", password: "setuppass123", confirmPassword: "setuppass123" },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.username).toBe("setupadmin");
      expect(body.user.role).toBe("admin");
    });

    it("returns needsSetup: false after setup", async () => {
      const res = await testApp.auth.config.register.$get();
      const body = await res.json();
      expect(body.needsSetup).toBe(false);
    });

    it("returns 409 on second setup attempt", async () => {
      const res = await testApp.setup.$post({
        json: { username: "anotheradmin", password: "anotherpass123", confirmPassword: "anotherpass123" },
      });
      expect(res.status).toBe(409);
    });
  });

  describe("Validation", () => {
    it("rejects short username", async () => {
      try {
        client.exec("DELETE FROM refresh_tokens");
        client.exec("DELETE FROM users");
        client.exec("DELETE FROM settings");
      } catch {}

      const res = await testApp.setup.$post({
        json: { username: "ab", password: "password123", confirmPassword: "password123" },
      });
      expect(res.status).toBe(422);
    });

    it("rejects mismatched passwords", async () => {
      try {
        client.exec("DELETE FROM refresh_tokens");
        client.exec("DELETE FROM users");
        client.exec("DELETE FROM settings");
      } catch {}

      const res = await testApp.setup.$post({
        json: { username: "testuser", password: "password123", confirmPassword: "different123" },
      });
      expect(res.status).toBe(422);
    });

    it("rejects short password", async () => {
      try {
        client.exec("DELETE FROM refresh_tokens");
        client.exec("DELETE FROM users");
        client.exec("DELETE FROM settings");
      } catch {}

      const res = await testApp.setup.$post({
        json: { username: "testuser", password: "short", confirmPassword: "short" },
      });
      expect(res.status).toBe(422);
    });
  });
});