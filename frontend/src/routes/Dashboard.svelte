<script lang="ts">
  import { dashboard } from "../state/dashboard.svelte";
  import BalanceCard from "../components/BalanceCard.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    dashboard.load();
  });
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>

  {#if dashboard.data}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <BalanceCard
        title="Current Balance"
        amount={dashboard.data.currentBalance}
        color={dashboard.data.currentBalance >= 0 ? "text-green-600" : "text-red-600"}
      />
      <BalanceCard title="Income (This Month)" amount={dashboard.data.monthIncome} color="text-green-600" />
      <BalanceCard title="Expense (This Month)" amount={dashboard.data.monthExpense} color="text-red-600" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cat.total)}
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
