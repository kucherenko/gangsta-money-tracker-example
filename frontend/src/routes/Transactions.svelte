<script lang="ts">
  import { transactions } from "../state/transactions.svelte";
  import { categories } from "../state/categories.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    transactions.load();
    categories.load();
  });

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await transactions.deleteTransaction(id);
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Transactions</h1>
    <button
      onclick={() => navigate("/transaction/new")}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >Add Transaction</button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          bind:value={transactions.filter.dateFrom}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          bind:value={transactions.filter.dateTo}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select
          bind:value={transactions.filter.type}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Category</label>
        <select
          bind:value={transactions.filter.categoryId}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value={undefined}>All</option>
          {#each categories.items as cat}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="flex gap-2">
      <button
        onclick={() => transactions.load()}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >Apply Filters</button>
      <button
        onclick={() => {
          transactions.filter = { dateFrom: "", dateTo: "", categoryId: undefined, type: "", sortBy: "date", sortOrder: "desc" };
          transactions.load();
        }}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >Clear</button>
    </div>
  </div>

  <!-- List -->
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-gray-500">Date</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500">Description</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500">Category</th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each transactions.items as tx (tx.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 text-gray-700">{formatDate(tx.date)}</td>
              <td class="px-4 py-3 text-gray-900 max-w-xs truncate">{tx.description || "—"}</td>
              <td class="px-4 py-3">
                {#if tx.category}
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style="background-color: {tx.category.color}20; color: {tx.category.color}">
                    {tx.category.name}
                  </span>
                {:else}
                  <span class="text-gray-400">Uncategorized</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-right font-medium {tx.type === 'income' ? 'text-green-600' : 'text-red-600'}">
                {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    onclick={() => navigate(`/transaction/${tx.id}`)}
                    class="text-blue-600 hover:text-blue-800 text-sm"
                  >Edit</button>
                  <button
                    onclick={() => handleDelete(tx.id)}
                    class="text-red-600 hover:text-red-800 text-sm"
                  >Delete</button>
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="5" class="px-4 py-12 text-center text-gray-500">No transactions found</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
