import { api } from "../lib/api";

export class SettingsState {
  data = $state<any>({
    defaultCurrency: "USD",
    fiatFetchInterval: 60,
    cryptoFetchInterval: 5,
    autoFetchRates: true,
    showCryptoOnDashboard: true,
  });
  currencies = $state<any[]>([]);

  async load() {
    try {
      this.data = await api.getSettings();
      this.currencies = await api.getCurrencies();
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async update(data: any) {
    this.data = await api.updateSettings(data);
  }

  getCurrency(code: string): any {
    return this.currencies.find((c: any) => c.code === code);
  }
}

export const settings = new SettingsState();
