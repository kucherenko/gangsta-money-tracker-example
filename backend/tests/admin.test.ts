import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { testClient } from "hono/testing";
import { client, ensureSettingsRow } from "../db";
import { hash } from "bcryptjs";
import { app } from "../server";
import { CONFIG_KEYS } from "../lib/config-constants";

const testApp = testClient(app);

const CONFIG_KEYS_ALLOW_REGISTRATION = CONFIG_KEYS.ALLOW_REGISTRATION;

let adminToken: string;
let adminId: number;

async function setupAdmin() {
  client.exec("DELETE FROM refresh_tokens");
  client.exec("DELETE FROM transactions");
  client.exec("DELETE FROM categories WHERE user_id IS NOT NULL");
  client.exec("DELETE FROM settings");
  client.exec("DELETE FROM system_config");
  client.exec("DELETE FROM users");
  client.exec("DELETE FROM audit_log");
  client.exec("DELETE FROM cleanup_tokens");

  const adminPw = await hash("admin12345", 12);
  client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", ["testadmin", adminPw]);
  const user = client.prepare("SELECT id FROM users WHERE username = 'testadmin'").get() as any;
  adminId = user.id;
  ensureSettingsRow(adminId);

  const res = await testApp.auth.login.$post({
    json: { username: "testadmin", password: "admin12345" },
  });
  const data = await res.json();
  adminToken = data.token;
}

async function createUserDirect(username: string, password: string, role: string) {
  const pw = await hash(password, 12);
  client.exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [username, pw, role]);
  const user = client.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
  ensureSettingsRow(user.id);
  return user.id;
}

async function loginUser(username: string, password: string) {
  const res = await testApp.auth.login.$post({
    json: { username, password },
  });
  return await res.json();
}

describe("Admin Stats", () => {
  beforeAll(setupAdmin);

  it("returns aggregate counts", async () => {
    const res = await testApp.admin.stats.$get({}, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.users).toBe("number");
    expect(typeof data.transactions).toBe("number");
    expect(typeof data.categories).toBe("number");
    expect(typeof data.exchange_rates).toBe("number");
  });

  it("returns 403 for non-admin", async () => {
    await createUserDirect("regular1", "password1", "user");
    const { token } = await loginUser("regular1", "password1");

    const res = await testApp.admin.stats.$get({}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated", async () => {
    const res = await testApp.admin.stats.$get();
    expect(res.status).toBe(401);
  });
});

describe("Admin Users Pagination", () => {
  beforeAll(setupAdmin);

  it("returns full array without params (backward compat)", async () => {
    const res = await testApp.admin.users.$get({}, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns paginated response with page and limit", async () => {
    const res = await testApp.admin.users.$get({
      query: { page: "1", limit: "10" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.items).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(Array.isArray(data.items)).toBe(true);
  });
});

describe("Cleanup Token Request", () => {
  beforeAll(setupAdmin);

  beforeEach(() => {
    client.exec("DELETE FROM cleanup_tokens");
  });

  it("creates a cleanup token for valid scope", async () => {
    const res = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe("string");
    expect(data.token.length).toBeGreaterThan(0);
  });

  it("stores token hash not plaintext", async () => {
    const res = await testApp.admin.cleanup.token.$post({
      json: { scope: "orphaned" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;
    const rawToken = data.token;

    const stored = client.prepare("SELECT token_hash FROM cleanup_tokens WHERE user_id = ?").get(adminId) as any;
    expect(stored.token_hash).not.toBe(rawToken);
    expect(stored.token_hash.length).toBe(64);
  });

  it("creates token with correct scope", async () => {
    await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const stored = client.prepare("SELECT scope FROM cleanup_tokens WHERE user_id = ?").get(adminId) as any;
    expect(stored.scope).toBe("transactions");
  });

  it("rate limits to 1 token per 60 seconds per user", async () => {
    await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(429);
  });

  it("returns 403 for non-admin", async () => {
    await createUserDirect("regular2", "password2", "user");
    const { token } = await loginUser("regular2", "password2");

    const res = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("Cleanup Execution", () => {
  beforeAll(setupAdmin);

  beforeEach(() => {
    client.exec("DELETE FROM cleanup_tokens");
  });

  it("deletes all transactions with valid token for scope=transactions", async () => {
    client.exec("INSERT INTO categories (name, type, is_predefined) VALUES ('testcat', 'expense', 0)");
    const cat = client.prepare("SELECT id FROM categories ORDER BY id DESC LIMIT 1").get() as any;
    client.prepare("INSERT INTO transactions (amount, currency, amount_default, exchange_rate, date, type, user_id, category_id) VALUES (100, 'USD', 100, 1.0, '2024-01-01', 'expense', ?, ?)").run(adminId, cat.id);
    client.prepare("INSERT INTO transactions (amount, currency, amount_default, exchange_rate, date, type, user_id, category_id) VALUES (200, 'USD', 200, 1.0, '2024-01-02', 'income', ?, ?)").run(adminId, cat.id);

    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    const res = await testApp.admin.cleanup.$post({
      json: { token, scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.affected_rows).toBeGreaterThanOrEqual(2);
    expect(data.scope).toBe("transactions");

    const remaining = (client.prepare("SELECT COUNT(*) as count FROM transactions").get() as any).count;
    expect(remaining).toBe(0);
  });

  it("deletes consumed expired tokens and orphaned categories for scope=orphaned", async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 86400;
    client.prepare("INSERT INTO refresh_tokens (token_hash, user_id, expires_at, consumed) VALUES (?, ?, ?, 1)").run("test_hash_consumed_expired", adminId, pastTimestamp);
    client.exec("INSERT INTO categories (name, type, is_predefined, user_id) VALUES ('orphancat', 'expense', 0, NULL)");

    client.exec("DELETE FROM cleanup_tokens");

    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "orphaned" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    const res = await testApp.admin.cleanup.$post({
      json: { token, scope: "orphaned" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);

    const staleTokenCount = (client.prepare("SELECT COUNT(*) as count FROM refresh_tokens WHERE consumed = 1 AND expires_at < ?").get(Math.floor(Date.now() / 1000)) as any).count;
    expect(staleTokenCount).toBe(0);
  });

  it("rejects invalid token", async () => {
    const res = await testApp.admin.cleanup.$post({
      json: { token: "fake-token", scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });

  it("rejects expired token", async () => {
    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    const pastExpiry = Math.floor(Date.now() / 1000) - 600;
    client.exec("UPDATE cleanup_tokens SET expires_at = ?", [pastExpiry]);

    const res = await testApp.admin.cleanup.$post({
      json: { token, scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });

  it("rejects consumed token (cannot reuse)", async () => {
    client.exec("DELETE FROM cleanup_tokens");
    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    await testApp.admin.cleanup.$post({
      json: { token, scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res2 = await testApp.admin.cleanup.$post({
      json: { token, scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res2.status).toBe(400);
  });

  it("rejects scope mismatch between token and request", async () => {
    client.exec("DELETE FROM cleanup_tokens");
    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    const res = await testApp.admin.cleanup.$post({
      json: { token, scope: "orphaned" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });

  it("writes audit log entry after cleanup", async () => {
    client.exec("DELETE FROM cleanup_tokens");
    client.exec("DELETE FROM audit_log");
    const tokenRes = await testApp.admin.cleanup.token.$post({
      json: { scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { token } = await tokenRes.json() as any;

    await testApp.admin.cleanup.$post({
      json: { token, scope: "transactions" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const logs = client.prepare("SELECT * FROM audit_log WHERE action = 'cleanup'").all() as any[];
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].scope).toBe("transactions");
    expect(logs[0].performed_by).toBe(adminId);
  });
});

describe("Audit Logging", () => {
  beforeAll(setupAdmin);

  it("logs user deletion", async () => {
    client.exec("DELETE FROM audit_log");
    const userId = await createUserDirect("deleteme", "password12", "user");

    await testApp.admin.users[":id"].$delete({
      param: { id: String(userId) },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const logs = client.prepare("SELECT * FROM audit_log WHERE action = 'user_deletion'").all() as any[];
    expect(logs.length).toBe(1);
    expect(logs[0].performed_by).toBe(adminId);
    const details = JSON.parse(logs[0].details);
    expect(details.deleted_user_id).toBe(userId);
  });

  it("logs config changes to allow_registration", async () => {
    client.exec("DELETE FROM audit_log");

    await testApp.admin.config[":key"].$put({
      param: { key: CONFIG_KEYS_ALLOW_REGISTRATION },
      json: { value: "true" },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const logs = client.prepare("SELECT * FROM audit_log WHERE action = 'config_change'").all() as any[];
    expect(logs.length).toBe(1);
    const details = JSON.parse(logs[0].details);
    expect(details.key).toBe("allow_registration");
    expect(details.new_value).toBe("true");
  });

  it("audit_log performed_by survives admin deletion (ON DELETE SET NULL)", async () => {
    client.exec("DELETE FROM audit_log");
    const tempAdminId = await createUserDirect("tempadmin", "password12", "admin");
    const { token: tempToken } = await loginUser("tempadmin", "password12");

    await testApp.admin.config[":key"].$put({
      param: { key: CONFIG_KEYS_ALLOW_REGISTRATION },
      json: { value: "true" },
    }, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });

    const logBefore = client.prepare("SELECT * FROM audit_log WHERE action = 'config_change' LIMIT 1").get() as any;
    expect(logBefore.performed_by).toBe(tempAdminId);

    client.exec("DELETE FROM users WHERE id = ?", [tempAdminId]);

    const logAfter = client.prepare("SELECT * FROM audit_log WHERE id = ?").get(logBefore.id) as any;
    expect(logAfter.performed_by).toBeNull();
  });

  it("returns audit log via GET /admin/audit (last 50)", async () => {
    client.exec("DELETE FROM audit_log");
    const res = await testApp.admin.audit.$get({}, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 403 for non-admin accessing audit", async () => {
    const userId = await createUserDirect("regular4", "password12", "user");
    const { token } = await loginUser("regular4", "password12");

    const res = await testApp.admin.audit.$get({}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe("User Deletion with Transaction", () => {
  beforeAll(setupAdmin);

  it("wraps user cascade deletion in transaction", async () => {
    const userId = await createUserDirect("todelete", "password12", "user");

    const res = await testApp.admin.users[":id"].$delete({
      param: { id: String(userId) },
    }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);

    const deleted = client.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    expect(deleted).toBeNull();

    const txCount = (client.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?").get(userId) as any).count;
    expect(txCount).toBe(0);
  });
});