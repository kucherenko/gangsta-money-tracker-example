const API_URL = "http://localhost:3001";

function getToken(): string {
  return localStorage.getItem("token") || "";
}

function getHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: getHeaders(),
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.hash = "#/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: async (credentials: { username: string; password: string }) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    return data;
  },

  // Transactions
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
  createTransaction: (data: any) => fetchJson("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: any) => fetchJson(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => fetchJson(`/transactions/${id}`, { method: "DELETE" }),

  // Categories
  getCategories: () => fetchJson("/categories"),
  createCategory: (data: any) => fetchJson("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: any) => fetchJson(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => fetchJson(`/categories/${id}`, { method: "DELETE" }),

  // Dashboard
  getDashboard: () => fetchJson("/dashboard"),

  // Currencies
  getCurrencies: (type?: string) => {
    const search = type ? `?type=${type}` : "";
    return fetchJson(`/currencies${search}`);
  },
  getCurrency: (code: string) => fetchJson(`/currencies/${code}`),

  // Settings
  getSettings: () => fetchJson("/settings"),
  updateSettings: (data: any) => fetchJson("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Rates
  getRates: (base?: string) => {
    const search = base ? `?base=${base}` : "";
    return fetchJson(`/rates${search}`);
  },
  getRate: (base: string, target: string) => fetchJson(`/rates/${base}/${target}`),
  refreshRates: () => fetchJson("/rates/refresh", { method: "POST" }),

  // Token helpers
  setToken(newToken: string) {
    localStorage.setItem("token", newToken);
  },
  getToken() {
    return getToken();
  },
  clearToken() {
    localStorage.removeItem("token");
  },
};
