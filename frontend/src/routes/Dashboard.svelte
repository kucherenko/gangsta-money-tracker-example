<script lang="ts">
  import { dashboard } from "../state/dashboard.svelte";
  import { settings } from "../state/settings.svelte";
  import { rates } from "../state/rates.svelte";
  import BalanceCard from "../components/BalanceCard.svelte";
  import { onMount } from "svelte";
  import { api } from "../lib/api";

  onMount(() => {
    dashboard.load();
    settings.load();
    rates.load();
    loadUsedCurrencies();
  });

  function formatAmount(value: number): string {
    const currency = settings.data?.defaultCurrency || "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  }

  // Fetch currencies actually used in this month's transactions
  let usedCurrencies = $state<any[]>([]);
  let refreshingRates = $state(false);

  async function loadUsedCurrencies() {
    try {
      const result = await api.getTransactions({ dateFrom: new Date().toISOString().slice(0, 7) + "-01" });
      if (result?.items) {
        const allCurrencies = result.items.map((t: any) => t.currency).filter(Boolean);
        const uniqueCodes = [...new Set(allCurrencies)];
        const currencyDetails = uniqueCodes
          .map((code) => settings.currencies?.find((c: any) => c.code === code))
          .filter(Boolean);
        usedCurrencies = currencyDetails;
      }
    } catch (err) {
      console.warn("Failed to load used currencies:", err);
    }
  }

  // Filter to non-default currencies
  let nonDefaultCurrencies = $derived(() =>
    usedCurrencies.filter((c: any) => c.code !== (settings.data?.defaultCurrency || "USD"))
  );

  async function refreshRates() {
    refreshingRates = true;
    try {
      await rates.refresh();
    } finally {
      refreshingRates = false;
    }
  }

  function getRateForCurrency(code: string): { rate: number; source: string; age: string } | null {
    const defaultCurrency = settings.data?.defaultCurrency || "USD";
    const rateInfo = rates.getRate(defaultCurrency, code);
    if (!rateInfo) return null;
    return {
      rate: rateInfo.rate,
      source: rateInfo.source,
      age: rates.formatAge(rateInfo.updatedAt),
    };
  }
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>

  {#if dashboard.data}
    <!-- Balance Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <BalanceCard
        title="Current Balance"
        amount={dashboard.data.currentBalance}
        color={dashboard.data.currentBalance >= 0 ? "text-green-600" : "text-red-600"}
      />
      <BalanceCard title="Income (This Month)" amount={dashboard.data.monthIncome} color="text-green-600" />
      <BalanceCard title="Expense (This Month)" amount={dashboard.data.monthExpense} color="text-red-600" />
    </div>

    <!-- Exchange Rates Section -->
    {#if settings.data?.showCryptoOnDashboard !== 0}
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Exchange Rates</h2>
          <button 
            onclick={refreshRates} 
            disabled={refreshingRates}
            class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {refreshingRates ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {#if nonDefaultCurrencies().length > 0}
            {#each nonDefaultCurrencies() as c}
              {@const rateData = getRateForCurrency(c.code)}
              <div class="flex flex-col p-3 rounded-lg bg-gray-50 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-900">{c.code}</span>
                  <span class="text-xs {c.type === 'crypto' ? 'text-purple-600 bg-purple-50' : 'text-gray-500 bg-gray-200'} rounded-full px-2 py-0.5">
                    {c.type === 'crypto' ? 'Crypto' : 'Fiat'}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">1 {c.code} = {settings.data?.defaultCurrency || "USD"}</span>
                  <span class="text-sm font-semibold text-gray-900">{rateData ? rateData.rate.toFixed(4) : "—"}</span>
                </div>
                {#if rateData}
                  <span class="text-xs text-gray-400">
                    {rateData.source === 'frankfurter' ? 'frankfurter.app' : 'CoinGecko'} • {rateData.age}
                  </span>
                {/if}
              </div>
            {/each}
          {:else}
            <p class="text-gray-500 text-sm col-span-full">No multi-currency transactions this month.</p>
          {/if}
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Monthly Trend -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h2>
        {#if dashboard.data.monthlyTrend?.length > 0}
          <div class="h-64 flex items-end justify-around gap-2">
            {#each dashboard.data.monthlyTrend as month}
              <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div class="w-full flex gap-0.5 h-48 items-end">
                  <div
                    class="flex-1 bg-green-500 rounded-t"
                    style="height: {Math.min((month.income / Math.max(...dashboard.data.monthlyTrend.map((m: any) => Math.max(m.income, m.expense)))) * 100, 100)}%"
                  />
                  <div
                    class="flex-1 bg-red-500 rounded-t"
                    style="height: {Math.min((month.expense / Math.max(...dashboard.data.monthlyTrend.map((m: any) => Math.max(m.income, m.expense)))) * 100, 100)}%"
                  />
                </div>
                <span class="text-xs text-gray-500 truncate">{month.month}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-gray-500 text-center py-8">No data available</p>
        {/if}
      </div>

      <!-- Category Breakdown -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h2>
        {#if dashboard.data.categoryBreakdown?.length > 0}
          <div class="space-y-3">
            {#each dashboard.data.categoryBreakdown as cat}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" style="background-color: {cat.color || '#64748b'}"></div>
                  <span class="text-sm text-gray-700">{cat.name}</span>
                </div>
                <span class="text-sm font-medium text-gray-900">
                  {formatAmount(cat.total)}
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-gray-500 text-center py-8">No data available</p>
        {/if}
      </div>
    </div>
  {:else}
    <div class="text-center py-12 text-gray-500">Loading...</div>
  {/if}
</div>
