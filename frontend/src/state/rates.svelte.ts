import { api } from "../lib/api";

export class RatesState {
  rates = $state<Record<string, { rate: number; updatedAt: number; source: string }>>({});
  loading = $state(false);
  lastFetch = $state<string | null>(null);

  async load() {
    try {
      const result = await api.getRates();
      if (Array.isArray(result)) {
        const rateMap: Record<string, { rate: number; updatedAt: number; source: string }> = {};
        for (const r of result) {
          const key = `${r.baseCurrency}/${r.targetCurrency}`;
          rateMap[key] = {
            rate: r.rate,
            updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now(),
            source: r.source,
          };
        }
        this.rates = rateMap;
        this.lastFetch = new Date().toLocaleTimeString();
      }
    } catch (err) {
      console.error("Failed to load rates:", err);
    }
  }

  async refresh() {
    this.loading = true;
    try {
      await api.refreshRates();
      // Wait a bit for fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.load();
    } catch (err) {
      console.error("Failed to refresh rates:", err);
    } finally {
      this.loading = false;
    }
  }

  getRate(base: string, target: string): { rate: number; updatedAt: number; source: string } | null {
    // Try both directions
    const key = `${base}/${target}`;
    if (this.rates[key]) return this.rates[key];
    
    // Try reverse: if we need EUR/USD and only have USD/EUR
    const reverseKey = `${target}/${base}`;
    if (this.rates[reverseKey]) {
      return {
        rate: 1 / this.rates[reverseKey].rate,
        updatedAt: this.rates[reverseKey].updatedAt,
        source: this.rates[reverseKey].source,
      };
    }
    
    return null;
  }

  isStale(updatedAt: number, intervalMinutes: number = 60): boolean {
    const age = Date.now() - updatedAt;
    return age > intervalMinutes * 60 * 1000;
  }

  formatAge(updatedAt: number): string {
    const age = Date.now() - updatedAt;
    const minutes = Math.floor(age / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

export const rates = new RatesState();
