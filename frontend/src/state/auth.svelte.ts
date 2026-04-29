import { api } from "../lib/api";

const API_URL = "http://localhost:3001";

export class AuthState {
  token = $state(localStorage.getItem("accessToken") || "");
  refreshToken = $state(localStorage.getItem("refreshToken") || "");
  user = $state<{ id: number; username: string; role: string; email?: string } | null>(null);
  isAuthenticated = $derived(!!this.token);
  needsSetup = $state(false);

  async login(username: string, password: string) {
    const res = await api.login({ username, password });
    this.setTokens(res.token, res.refreshToken);
    this.user = { id: res.user.id, username: res.user.username, role: res.user.role, email: res.user.email };
  }

  async register(username: string, password: string, email?: string) {
    const res = await api.register({ username, password, confirmPassword: password, email });
    this.setTokens(res.token, res.refreshToken);
    this.user = { id: res.user.id, username: res.user.username, role: res.user.role, email: res.user.email };
  }

  async fetchUser() {
    try {
      const user = await api.getMe();
      this.user = user;
    } catch {
      this.user = null;
    }
  }

  async checkSetupStatus() {
    try {
      const data = await fetch(`${API_URL}/auth/config/register`).then(r => r.json());
      this.needsSetup = data.needsSetup === true;
    } catch {
      this.needsSetup = false;
    }
  }

  async completeSetup(data: { username: string; password: string; confirmPassword: string }) {
    const res = await fetch(`${API_URL}/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Setup failed" }));
      throw new Error(err.message || err.error || "Setup failed");
    }
    const result = await res.json();
    this.setTokens(result.token, result.refreshToken);
    this.user = { id: result.user.id, username: result.user.username, role: result.user.role };
    this.needsSetup = false;
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    this.token = accessToken;
    this.refreshToken = refreshToken;
    api.setTokens(accessToken, refreshToken);
  }

  logout() {
    api.logout(this.refreshToken).catch(() => {});
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    this.token = "";
    this.refreshToken = "";
    this.user = null;
  }
}

export const auth = new AuthState();