<script lang="ts">
  import { categories } from "../state/categories.svelte";
  import { settings } from "../state/settings.svelte";
  import { api } from "../lib/api";
  import { onMount } from "svelte";

  onMount(() => {
    categories.load();
    settings.load();
  });

  // Category management state
  let newName = $state("");
  let newColor = $state("#64748b");
  let newType = $state<"income" | "expense">("expense");
  let editingId = $state<number | null>(null);
  let errors = $state<Record<string, string>>({});

  // Currency management state
  let newCurrencyCode = $state("");
  let newCurrencyName = $state("");
  let newCurrencySymbol = $state("$");
  let newCurrencyPrecision = $state(2);
  let newCurrencyType = $state<"fiat" | "crypto">("fiat");
  let showCurrencyForm = $state(false);
  let savingCurrency = $state(false);
  let savingSettings = $state(false);

  // Default currency change modal
  let showCurrencyChangeModal = $state(false);
  let selectedDefaultCurrency = $state("");
  let transactionCount = $state(0);

  function startEdit(cat: any) {
    editingId = cat.id;
    newName = cat.name;
    newColor = cat.color;
    newType = cat.type;
  }

  function cancelEdit() {
    editingId = null;
    newName = "";
    newColor = "#64748b";
    newType = "expense";
    errors = {};
  }

  async function handleCategorySubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      errors = { name: "Name is required" };
      return;
    }

    const data = { name: newName.trim(), color: newColor, type: newType };
    try {
      if (editingId) {
        await categories.updateCategory(editingId, data);
      } else {
        await categories.addCategory(data);
      }
      cancelEdit();
      await categories.load();
    } catch (err: any) {
      errors = { submit: err.message };
    }
  }

  async function handleDelete(id: number) {
    const cat = categories.items.find((c: any) => c.id === id);
    if (cat?.isPredefined) {
      alert("Cannot delete predefined categories");
      return;
    }
    if (!confirm("Are you sure? This may uncategorize some transactions.")) return;
    await categories.deleteCategory(id);
  }

  // Settings handlers
  async function loadTransactionCount() {
    try {
      const result = await api.getTransactions({ limit: 1 });
      transactionCount = result.items?.length ? 1 : 0; // Simplified
      // Actually get count from API or compute
      const allResult = await api.getTransactions({ limit: 1000 });
      transactionCount = allResult.items?.length || 0;
    } catch (err) {
      transactionCount = 0;
    }
  }

  async function onChangeDefaultCurrency(e: Event) {
    const select = e.target as HTMLSelectElement;
    selectedDefaultCurrency = select.value;
    if (selectedDefaultCurrency !== settings.data?.defaultCurrency) {
      await loadTransactionCount();
      showCurrencyChangeModal = true;
    }
  }

  async function confirmCurrencyChange() {
    try {
      savingSettings = true;
      await settings.update({ defaultCurrency: selectedDefaultCurrency });
      showCurrencyChangeModal = false;
      await settings.load();
    } catch (err: any) {
      errors = { settings: err.message };
    } finally {
      savingSettings = false;
    }
  }

  function cancelCurrencyChange() {
    showCurrencyChangeModal = false;
    selectedDefaultCurrency = settings.data?.defaultCurrency || "USD";
  }

  // Currency management
  async function handleCurrencySubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!newCurrencyCode.trim() || !newCurrencyName.trim()) {
      errors = { currency: "Code and name are required" };
      return;
    }

    try {
      savingCurrency = true;
      await api.createCurrency({
        code: newCurrencyCode.trim().toUpperCase(),
        name: newCurrencyName.trim(),
        symbol: newCurrencySymbol,
        precision: newCurrencyPrecision,
        type: newCurrencyType,
      });
      showCurrencyForm = false;
      await settings.load(); // Reload currencies
      newCurrencyCode = "";
      newCurrencyName = "";
      newCurrencySymbol = "$";
      newCurrencyPrecision = 2;
      newCurrencyType = "fiat";
    } catch (err: any) {
      errors = { currency: err.message || "Failed to create currency" };
    } finally {
      savingCurrency = false;
    }
  }

  function toggleAutoFetch(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    settings.update({ autoFetchRates: checkbox.checked ? 1 : 0 });
  }

  function getFiatCurrencies() {
    return settings.currencies?.filter((c: any) => c.type === "fiat") || [];
  }

  function getCryptoCurrencies() {
    return settings.currencies?.filter((c: any) => c.type === "crypto") || [];
  }

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Settings</h1>

  {#if errors.submit || errors.settings}
    <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {errors.submit || errors.settings}
    </div>
  {/if}

  <!-- Currency Settings -->
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Currency Settings</h2>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
        <select
          value={settings.data?.defaultCurrency || "USD"}
          onchange={onChangeDefaultCurrency}
          class="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {#each getFiatCurrencies() as c}
            <option value={c.code}>{c.symbol} {c.code} — {c.name}</option>
          {/each}
        </select>
        <p class="mt-1 text-xs text-gray-500">
          All totals and reports will be displayed in this currency.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <input
          type="checkbox"
          id="autoFetch"
          checked={settings.data?.autoFetchRates === 1}
          onchange={toggleAutoFetch}
          class="rounded border-gray-300"
        />
        <label for="autoFetch" class="text-sm text-gray-700">
          Auto-fetch exchange rates
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Fiat fetch interval (minutes)</label>
          <input
            type="number"
            value={settings.data?.fiatFetchInterval || 60}
            oninput={(e) => settings.update({ fiatFetchInterval: parseInt((e.target as any).value) })}
            min="1"
            max="10080"
            class="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Crypto fetch interval (minutes)</label>
          <input
            type="number"
            value={settings.data?.cryptoFetchInterval || 5}
            oninput={(e) => settings.update({ cryptoFetchInterval: parseInt((e.target as any).value) })}
            min="1"
            max="10080"
            class="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Currencies -->
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Currencies</h2>

    <div class="space-y-4">
      {#if settings.currencies?.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Code</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Symbol</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Precision</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each getFiatCurrencies() as c}
                <tr>
                  <td class="px-3 py-2 font-medium">{c.code}</td>
                  <td class="px-3 py-2">{c.name}</td>
                  <td class="px-3 py-2">{c.symbol || "—"}</td>
                  <td class="px-3 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600">Fiat</span></td>
                  <td class="px-3 py-2">{c.precision}</td>
                </tr>
              {/each}
              {#each getCryptoCurrencies() as c}
                <tr>
                  <td class="px-3 py-2 font-medium">{c.code}</td>
                  <td class="px-3 py-2">{c.name}</td>
                  <td class="px-3 py-2">{c.symbol || "—"}</td>
                  <td class="px-3 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-blue-50 text-blue-600">Crypto</span></td>
                  <td class="px-3 py-2">{c.precision}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-gray-500 text-sm">Loading currencies...</p>
      {/if}

      <button
        onclick={() => showCurrencyForm = !showCurrencyForm}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {showCurrencyForm ? "Cancel" : "Add Custom Currency"}
      </button>

      {#if showCurrencyForm}
        <form onsubmit={handleCurrencySubmit} class="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
          {#if errors.currency}
            <p class="text-xs text-red-600">{errors.currency}</p>
          {/if}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Code (3-5 letters)</label>
              <input type="text" bind:value={newCurrencyCode} maxlength="5" placeholder="SGD"
                class="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" bind:value={newCurrencyName} maxlength="50" placeholder="Singapore Dollar"
                class="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input type="text" bind:value={newCurrencySymbol} maxlength="5" placeholder="S$"
                class="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Precision</label>
              <input type="number" bind:value={newCurrencyPrecision} min="0" max="18"
                class="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select bind:value={newCurrencyType}
                class="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="fiat">Fiat</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={savingCurrency}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingCurrency ? "Creating..." : "Create Currency"}
          </button>
        </form>
      {/if}
    </div>
  </div>

  <!-- Categories -->
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Categories</h2>

    {#if errors.submit}
      <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.submit}</div>
    {/if}

    <form onsubmit={handleCategorySubmit} class="mb-6 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <input
          type="text"
          bind:value={newName}
          placeholder="Category name"
          class="w-full rounded-lg border {errors.name ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <input
          type="color"
          bind:value={newColor}
          class="h-9 w-14 rounded-lg border border-gray-300 cursor-pointer"
        />
      </div>
      <select bind:value={newType} class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <option value="income">Income</option>
        <option value="expense">Expense</option>
      </select>
      <button
        type="submit"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {editingId ? "Update" : "Add"}
      </button>
      {#if editingId}
        <button type="button" onclick={cancelEdit} class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      {/if}
    </form>

    <div class="space-y-2">
      {#each categories.items as cat (cat.id)}
        <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded-full" style="background-color: {cat.color}"></div>
            <span class="text-sm text-gray-700">{cat.name}</span>
            {#if cat.isPredefined}
              <span class="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Default</span>
            {/if}
            <span class="text-xs text-gray-400 capitalize">{cat.type}</span>
          </div>
          <div class="flex gap-2">
            {#if !cat.isPredefined}
              <button onclick={() => startEdit(cat)} class="text-sm text-blue-600 hover:text-blue-800">Edit</button>
              <button onclick={() => handleDelete(cat.id)} class="text-sm text-red-600 hover:text-red-800">Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Currency Change Confirmation Modal -->
{#if showCurrencyChangeModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Change Default Currency?</h3>
      <p class="text-sm text-gray-600 mb-4">
        You are about to change your default currency to 
        <span class="font-medium">{selectedDefaultCurrency}</span>.
      </p>
      <div class="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800 mb-4">
        This will recalculate all {transactionCount} existing transactions.
        Make sure you have the correct exchange rates stored.
      </div>
      <div class="flex gap-3">
        <button
          onclick={confirmCurrencyChange}
          disabled={savingSettings}
          class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {savingSettings ? "Updating..." : "Confirm"}
        </button>
        <button
          onclick={cancelCurrencyChange}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
