import { api } from "../lib/api";

export class AuthState {
  token = $state(localStorage.getItem("token") || "");
  isAuthenticated = $derived(!!this.token);

  async login(username: string, password: string) {
    const res = await api.login({ username, password });
    api.setToken(res.token);
    this.token = res.token;
  }

  logout() {
    api.clearToken();
    this.token = "";
  }
}

export const auth = new AuthState();
