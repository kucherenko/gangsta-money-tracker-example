import { api } from "../lib/api";

export class DashboardState {
  data = $state<any>(null);

  async load() {
    this.data = await api.getDashboard();
  }
}

export const dashboard = new DashboardState();
