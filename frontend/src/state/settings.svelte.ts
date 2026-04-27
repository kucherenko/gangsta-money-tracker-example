import { api } from "../lib/api";
import { getCurrencyEmoji } from "@money-tracker/shared/currencyData";

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
      // Load ALL currencies including archived ones
      this.currencies = await api.getCurrencies(undefined, true);
      // Sort by sortOrder DESC (higher = first)
      this.currencies.sort((a: any, b: any) => (b.sortOrder || 0) - (a.sortOrder || 0));
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

  getCurrencyWithEmoji(code: string): { emoji: string; currency: any } {
    const currency = this.currencies.find((c: any) => c.code === code);
    return {
      emoji: getCurrencyEmoji(code),
      currency,
    };
  }

  activeCurrencies(type?: string) {
    let list = this.currencies.filter((c: any) => c.isActive !== false);
    if (type) list = list.filter((c: any) => c.type === type);
    return list;
  }

  async reorderCurrencies(orderedCodes: string[]) {
    try {
      for (let i = 0; i < orderedCodes.length; i++) {
        await api.updateCurrency(orderedCodes[i], { sortOrder: (orderedCodes.length - i) * 100 });
      }
      await this.load();
    } catch (err) {
      console.error("Failed to reorder currencies:", err);
    }
  }

  async deleteCurrency(code: string) {
    try {
      await api.deleteCurrency(code);
      await this.load();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete currency");
    }
  }
}

export const settings = new SettingsState();
