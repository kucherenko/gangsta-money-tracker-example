<!-- Simplified TransactionForm that works with the current architecture -->
<script lang="ts">
  import { transactions } from "../state/transactions.svelte";
  import { categories } from "../state/categories.svelte";
  import { settings } from "../state/settings.svelte";
  import { onMount } from "svelte";
  import { insertTransactionSchema } from "@money-tracker/shared/schemas";
  import { api } from "../lib/api";

  onMount(() => {
    categories.load();
    settings.load();
    const id = extractId();
    if (id) {
      loadTransaction(id);
    }
  });

  let id = $state<number | null>(null);
  let amount = $state("");
  let currency = $state("USD");
  let exchangeRate = $state("");
  let description = $state("");
  let date = $state(new Date().toISOString().split("T")[0]);
  let type = $state<"income" | "expense">("expense");
  let categoryId = $state<number | undefined>(undefined);
  let errors = $state<Record<string, string>>({});
  let loading = $state(false);

  function extractId(): number | null {
    const hash = window.location.hash;
    const match = hash.match(/\/transaction\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function loadTransaction(txId: number) {
    id = txId;
    const tx = await api.getTransaction(txId);
    amount = String(tx.amount);
    currency = tx.currency || "USD";
    exchangeRate = tx.exchangeRate ? String(tx.exchangeRate) : "";
    description = tx.description || "";
    date = tx.date;
    type = tx.type;
    categoryId = tx.categoryId;
  }

  function validate(): boolean {
    errors = {};
    const amt = Number(amount);
    const rate = Number(exchangeRate) || 1;
    const defaultCurrency = settings.data?.defaultCurrency || "USD";
    const amountDefault = currency === defaultCurrency ? amt : Math.round(amt * rate * 100) / 100;
    
    const result = insertTransactionSchema.safeParse({
      amount: amt,
      currency,
      amountDefault,
      exchangeRate: currency !== defaultCurrency ? rate : undefined,
      description: description || undefined,
      date,
      type,
      categoryId,
    });

    if (!result.success) {
      result.error.errors.forEach((err) => {
        errors[err.path[0]] = err.message;
      });
      return false;
    }
    return true;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    loading = true;
    
    const amt = Number(amount);
    const rate = Number(exchangeRate) || 1;
    const defaultCurrency = settings.data?.defaultCurrency || "USD";
    const amountDefault = currency === defaultCurrency ? amt : Math.round(amt * rate * 100) / 100;
    
    const data = {
      amount: amt,
      currency,
      amountDefault,
      exchangeRate: currency !== defaultCurrency ? rate : undefined,
      description: description || undefined,
      date,
      type,
      categoryId,
    };

    try {
      if (id) {
        await transactions.updateTransaction(id, data);
      } else {
        await transactions.addTransaction(data);
      }
      window.location.hash = "#/transactions";
    } catch (err: any) {
      errors.submit = err.message || "Failed to save transaction";
    } finally {
      loading = false;
    }
  }

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }

  function getCurrencies() {
    return settings.currencies || [];
  }

  function getDefaultCurrency() {
    return settings.data?.defaultCurrency || "USD";
  }

  function onCurrencyChange() {
    const defaultCurrency = getDefaultCurrency();
    if (currency === defaultCurrency) {
      exchangeRate = "";
    } else {
      // Try to find cached rate
      // Note: We'll implement this when rates API is working
      exchangeRate = "1.0";
    }
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">{id ? "Edit Transaction" : "Add Transaction"}</h1>

  {#if errors.submit}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.submit}</div>
  {/if}

  <form onsubmit={handleSubmit} class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
      <div class="flex gap-3">
        <label class="flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer {type === 'income' ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
          <input type="radio" name="type" value="income" bind:group={type} class="sr-only" />
          <span class="text-sm {type === 'income' ? 'text-green-700 font-medium' : 'text-gray-600'}">Income</span>
        </label>
        <label class="flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer {type === 'expense' ? 'border-red-500 bg-red-50' : 'border-gray-200'}">
          <input type="radio" name="type" value="expense" bind:group={type} class="sr-only" />
          <span class="text-sm {type === 'expense' ? 'text-red-700 font-medium' : 'text-gray-600'}">Expense</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Amount</label>
        <input type="number" step="0.01" min="0" bind:value={amount} placeholder="0.00"
          class="w-full rounded-lg border {errors.amount ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500" />
        {#if errors.amount}
          <p class="mt-1 text-xs text-red-600">{errors.amount}</p>
        {/if}
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
        <select bind:value={currency} onchange={onCurrencyChange}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {#if getCurrencies().length > 0}
            <optgroup label="Fiat">
              {#each getCurrencies().filter((c: any) => c.type === 'fiat') as c}
                <option value={c.code}>{c.symbol || c.code} {c.name}</option>
              {/each}
            </optgroup>
            <optgroup label="Crypto">
              {#each getCurrencies().filter((c: any) => c.type === 'crypto') as c}
                <option value={c.code}>{c.symbol || c.code} {c.name}</option>
              {/each}
            </optgroup>
          {:else}
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          {/if}
        </select>
      </div>
    </div>

    {#if currency !== getDefaultCurrency()}
      <div class="bg-gray-50 rounded-lg p-4 space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Exchange Rate (1 {currency} = ? {getDefaultCurrency()})
          </label>
          <input type="number" step="0.00001" min="0" bind:value={exchangeRate}
            class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div class="text-sm text-gray-500">
          Converted: {getDefaultCurrency()} {Math.round(Number(amount) * Number(exchangeRate || 1) * 100) / 100}
        </div>
      </div>
    {/if}

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
      <input type="date" bind:value={date}
        class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
      <select bind:value={categoryId}
        class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="">Select category...</option>
        {#each categories.items.filter((c: any) => c.type === type) as cat}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
      <input type="text" bind:value={description} placeholder="What was this for?" maxlength="255"
        class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>

    <div class="flex gap-3 pt-2">
      <button type="submit" disabled={loading}
        class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : id ? "Update" : "Add Transaction"}
      </button>
      <button type="button" onclick={() => navigate("/transactions")}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >Cancel</button>
    </div>
  </form>
</div>
