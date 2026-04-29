import type { ReceiptUploadResponse } from "@money-tracker/shared/schemas";

const API_URL = "http://localhost:3001";

let accessToken: string | null = localStorage.getItem("accessToken");
let refreshToken: string | null = localStorage.getItem("refreshToken");
let refreshPromise: Promise<string> | null = null;

function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error("No refresh token");
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    window.location.hash = "#/login";
    throw new Error("Session expired");
  }
  const data = await res.json();
  setTokens(data.token, data.refreshToken);
  return data.token;
}

async function fetchWithAuth(path: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    headers["Authorization"] = `Bearer ${newToken}`;
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  }

  return res;
}

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetchWithAuth(path, options);
  if (res.status === 401) {
    clearTokens();
    window.location.hash = "#/login";
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: async (credentials: { username: string; password: string }) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || err.message || "Login failed");
    }
    const data = await res.json();
    setTokens(data.token, data.refreshToken);
    return data;
  },

  register: async (data: { username: string; password: string; confirmPassword: string; email?: string }) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error || err.message || "Registration failed");
    }
    const result = await res.json();
    setTokens(result.token, result.refreshToken);
    return result;
  },

  logout: async (rt?: string) => {
    const token = rt || localStorage.getItem("refreshToken");
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify({ refreshToken: token }),
        });
      } catch {}
    }
    clearTokens();
  },

  changePassword: async (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => {
    return fetchJson("/auth/change-password", { method: "POST", body: JSON.stringify(data) });
  },

  getMe: async () => {
    return fetchJson("/auth/me");
  },

  getRegistrationStatus: async () => {
    const res = await fetch(`${API_URL}/auth/config/register`);
    return res.json();
  },

  getTransactions: (params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string; categoryId?: number; type?: string; sortBy?: string; sortOrder?: string; currency?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.dateFrom) search.set("dateFrom", params.dateFrom);
    if (params?.dateTo) search.set("dateTo", params.dateTo);
    if (params?.categoryId) search.set("categoryId", String(params.categoryId));
    if (params?.type) search.set("type", params.type);
    if (params?.sortBy) search.set("sortBy", params.sortBy);
    if (params?.sortOrder) search.set("sortOrder", params.sortOrder);
    if (params?.currency) search.set("currency", params.currency);
    return fetchJson(`/transactions?${search.toString()}`);
  },
  getTransaction: (id: number) => fetchJson(`/transactions/${id}`),

  uploadReceipt: async (file: File): Promise<ReceiptUploadResponse> => {
    const currentAccessToken = localStorage.getItem("accessToken") || "";
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_URL}/api/ocr`, {
      method: "POST",
      headers: { ...(currentAccessToken ? { Authorization: `Bearer ${currentAccessToken}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  uploadReceiptFromUrl: async (url: string): Promise<ReceiptUploadResponse> => {
    return fetchJson("/api/ocr/url", { method: "POST", body: JSON.stringify({ url }) });
  },

  createTransaction: (data: any) => fetchJson("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: any) => fetchJson(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => fetchJson(`/transactions/${id}`, { method: "DELETE" }),

  getCategories: () => fetchJson("/categories"),
  createCategory: (data: any) => fetchJson("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: any) => fetchJson(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => fetchJson(`/categories/${id}`, { method: "DELETE" }),

  getDashboard: () => fetchJson("/dashboard"),

  getCurrencies: (type?: string, all?: boolean) => {
    const search = new URLSearchParams();
    if (type) search.set("type", type);
    if (all) search.set("all", "true");
    const qs = search.toString();
    return fetchJson(`/currencies${qs ? `?${qs}` : ""}`);
  },
  getCurrency: (code: string) => fetchJson(`/currencies/${code}`),
  createCurrency: (data: any) => fetchJson("/currencies", { method: "POST", body: JSON.stringify(data) }),
  updateCurrency: (code: string, data: any) => fetchJson(`/currencies/${code}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCurrency: (code: string) => fetchJson(`/currencies/${code}`, { method: "DELETE" }),
  exportCurrencies: () => fetchJson("/currencies/export"),
  importCurrencies: (data: any[]) => fetchJson("/currencies/import", { method: "POST", body: JSON.stringify(data) }),

  getSettings: () => fetchJson("/settings"),
  updateSettings: (data: any) => fetchJson("/settings", { method: "PUT", body: JSON.stringify(data) }),

  getRates: (base?: string) => {
    const search = base ? `?base=${base}` : "";
    return fetchJson(`/rates${search}`);
  },
  getRate: (base: string, target: string) => fetchJson(`/rates/${base}/${target}`),
  refreshRates: () => fetchJson("/rates/refresh", { method: "POST" }),

  // Admin
  getUsers: () => fetchJson("/admin/users"),
  getUsersPaginated: (page: number, limit: number) => fetchJson(`/admin/users?page=${page}&limit=${limit}`),
  createUser: (data: { username: string; password: string; email?: string; role?: string }) => fetchJson("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => fetchJson(`/admin/users/${id}`, { method: "DELETE" }),
  getConfig: () => fetchJson("/admin/config"),
  updateConfig: (key: string, value: string) => fetchJson(`/admin/config/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),

  // Admin stats & cleanup
  getAdminStats: () => fetchJson("/admin/stats"),
  requestCleanupToken: (scope: string) => fetchJson("/admin/cleanup/token", { method: "POST", body: JSON.stringify({ scope }) }),
  executeCleanup: (token: string, scope: string) => fetchJson("/admin/cleanup", { method: "POST", body: JSON.stringify({ token, scope }) }),
  getAdminAudit: () => fetchJson("/admin/audit"),

  setTokens(ac: string, rc: string) {
    setTokens(ac, rc);
  },
  clearTokens() {
    clearTokens();
  },
};