<script lang="ts">
  import { transactions } from "../state/transactions.svelte";
  import { categories } from "../state/categories.svelte";
  import { settings } from "../state/settings.svelte";
  import { rates } from "../state/rates.svelte";
  import { onMount } from "svelte";
  import { insertTransactionSchema } from "@money-tracker/shared/schemas";
  import { api } from "../lib/api";

  onMount(() => {
    categories.load();
    settings.load();
    rates.load();
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

  // Rate state
  let rateInfo = $state<{ rate: number; updatedAt: number; source: string } | null>(null);
  let rateLoading = $state(false);

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
    
    // If editing a foreign currency transaction, look up cached rate
    if (currency !== getDefaultCurrency()) {
      await lookupRate();
    }
  }

  async function lookupRate() {
    const defaultCurrency = getDefaultCurrency();
    if (currency === defaultCurrency) {
      rateInfo = null;
      return;
    }
    
    rateLoading = true;
    
    // Check if we have the rate in our store
    const cached = rates.getRate(defaultCurrency, currency);
    if (cached) {
      rateInfo = cached;
      exchangeRate = String(cached.rate);
    } else {
      // Try fetching specific rate
      try {
        const result = await api.getRate(defaultCurrency, currency);
        if (result?.rate) {
          rateInfo = {
            rate: result.rate,
            updatedAt: result.updatedAt ? new Date(result.updatedAt).getTime() : Date.now(),
            source: result.source,
          };
          exchangeRate = String(result.rate);
        } else {
          rateInfo = null;
        }
      } catch (err) {
        rateInfo = null;
      }
    }
    
    rateLoading = false;
  }

  function validate(): boolean {
    errors = {};
    const amt = Number(amount);
    const rate = Number(exchangeRate) || 1;
    const defaultCurrency = getDefaultCurrency();
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
    const defaultCurrency = getDefaultCurrency();
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

  async function onCurrencyChange() {
    const defaultCurrency = getDefaultCurrency();
    if (currency === defaultCurrency) {
      exchangeRate = "";
      rateInfo = null;
    } else {
      await lookupRate();
    }
  }

  function isRateStale(): boolean {
    if (!rateInfo?.updatedAt) return true;
    return rates.isStale(rateInfo.updatedAt, settings.data?.fiatFetchInterval || 60);
  }

  function getRateAge(): string {
    if (!rateInfo?.updatedAt) return "";
    return rates.formatAge(rateInfo.updatedAt);
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">{id ? "Edit Transaction" : "Add Transaction"}</h1>

  {#if errors.submit}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.submit}</div>
  {/if}

  <form onsubmit={handleSubmit} class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
    <!-- Type -->
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

    <!-- Amount + Currency -->
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
                <option value={c.code}>{c.symbol || c.code} — {c.name}</option>
              {/each}
            </optgroup>
            <optgroup label="Crypto">
              {#each getCurrencies().filter((c: any) => c.type === 'crypto') as c}
                <option value={c.code}>{c.symbol || c.code} — {c.name}</option>
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

    <!-- Exchange Rate -->
    {#if currency !== getDefaultCurrency()}
      <div class="bg-gray-50 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">
            Exchange Rate
          </label>
          {#if rateInfo}
            <span class="text-xs {isRateStale() ? 'text-orange-500' : 'text-green-600'}">
              {#if rateLoading}Loading...{:else}{getRateAge()}{/if}
            </span>
          {/if}
        </div>
        
        <p class="text-xs text-gray-500">
          1 {currency} = {getDefaultCurrency()} {exchangeRate || "?"}
        </p>
        
        <input 
          type="number" 
          step="0.00001" 
          min="0" 
          bind:value={exchangeRate}
          placeholder="Enter exchange rate"
          class="w-full rounded-lg border {isRateStale() ? 'border-orange-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500" 
        />
        
        {#if rateInfo}
          {#if isRateStale()}
            <p class="text-xs text-orange-600 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              This rate may be stale. Please verify or update.
            </p>
          {:else}
            <p class="text-xs text-green-600">
              Rate from {rateInfo.source === 'frankfurter' ? 'frankfurter.app' : 'CoinGecko'} — {getRateAge()}
            </p>
          {/if}
        {:else}
          <p class="text-xs text-gray-500">
            No cached rate available. Enter the rate manually.
          </p>
        {/if}
        
        <!-- Converted amount preview -->
        <div class="flex items-center justify-between pt-2 border-t border-gray-200">
          <span class="text-sm text-gray-500">Converted amount:</span>
          <span class="text-sm font-medium text-gray-900">
            {getDefaultCurrency()} {Math.round(Number(amount || 0) * Number(exchangeRate || 0) * 100) / 100}
          </span>
        </div>
      </div>
    {/if}

    <!-- Date -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
      <input type="date" bind:value={date}
        class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>

    <!-- Category -->
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

    <!-- Description -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
      <input type="text" bind:value={description} placeholder="What was this for?" maxlength="255"
        class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>

    <!-- Actions -->
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
