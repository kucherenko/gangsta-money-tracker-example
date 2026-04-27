<script lang="ts">
  import { categories } from "../state/categories.svelte";
  import { settings } from "../state/settings.svelte";
  import { api } from "../lib/api";
  import { onMount } from "svelte";
  import {
    getCurrencyEmoji,
    isIsoFiatCode,
    ISO_4217_CURRENCIES,
    COMMON_CRYPTOS,
  } from "@money-tracker/shared/currencyData";

  onMount(() => {
    categories.load();
    settings.load();
  });

  // ─── Tabs ────────────────────────────────────────────────────────────────
  let activeTab = $state<"general" | "currencies" | "categories">("general");
  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "currencies", label: "Currencies" },
    { key: "categories", label: "Categories" },
  ];

  // ─── Errors ─────────────────────────────────────────────────────────────────
  let errors = $state<Record<string, string>>({});
  function clearError(key: string) { errors = { ...errors, [key]: "" }; }
  function setError(key: string, message: string) { errors = { ...errors, [key]: message }; }

  // ─── Category management state ─────────────────────────────────────────────
  let catName = $state("");
  let catColor = $state("#64748b");
  let catType = $state<"income" | "expense">("expense");
  let editingCatId = $state<number | null>(null);

  function startEditCategory(cat: any) {
    editingCatId = cat.id;
    catName = cat.name;
    catColor = cat.color;
    catType = cat.type;
  }

  function cancelEditCategory() {
    editingCatId = null;
    catName = "";
    catColor = "#64748b";
    catType = "expense";
    clearError("cat");
  }

  async function handleCategorySubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!catName.trim()) { setError("cat", "Name is required"); return; }
    const data = { name: catName.trim(), color: catColor, type: catType };
    try {
      if (editingCatId) { await categories.updateCategory(editingCatId, data); }
      else { await categories.addCategory(data); }
      cancelEditCategory();
      await categories.load();
    } catch (err: any) { setError("cat", err.message); }
  }

  async function handleDeleteCategory(id: number) {
    const cat = categories.items.find((c: any) => c.id === id);
    if (cat?.isPredefined) { alert("Cannot delete predefined categories"); return; }
    if (!confirm("Are you sure? This may uncategorize some transactions.")) return;
    try {
      await categories.deleteCategory(id);
      if (editingCatId === id) cancelEditCategory();
    } catch (err: any) { setError("cat", err.message); }
  }

  // ─── Currency management state ────────────────────────────────────────────
  let newCurrencyCode = $state("");
  let newCurrencyName = $state("");
  let newCurrencySymbol = $state("$");
  let newCurrencyPrecision = $state(2);
  let newCurrencyType = $state<"fiat" | "crypto">("fiat");
  let showCurrencyForm = $state(false);
  let showImportForm = $state(false);
  let savingCurrency = $state(false);
  let savingSettings = $state(false);

  // Inline editing
  let editingCurrencyCode = $state<string | null>(null);
  let editCurrencyName = $state("");
  let editCurrencySymbol = $state("");
  let editCurrencyPrecision = $state(2);
  let editCurrencyType = $state<"fiat" | "crypto">("fiat");

  function startEditCurrency(c: any) {
    editingCurrencyCode = c.code;
    editCurrencyName = c.name;
    editCurrencySymbol = c.symbol || "";
    editCurrencyPrecision = c.precision;
    editCurrencyType = c.type;
  }

  function cancelEditCurrency() {
    editingCurrencyCode = null;
    editCurrencyName = "";
    editCurrencySymbol = "";
    editCurrencyPrecision = 2;
    editCurrencyType = "fiat";
  }

  async function handleCurrencyUpdate(c: any) {
    if (!editCurrencyName.trim()) { setError("currencyEdit", "Name is required"); return; }
    try {
      savingCurrency = true;
      await api.updateCurrency(c.code, {
        name: editCurrencyName.trim(),
        symbol: editCurrencySymbol,
        precision: editCurrencyPrecision,
        type: editCurrencyType,
      });
      cancelEditCurrency();
      await settings.load();
    } catch (err: any) {
      setError("currencyEdit", err.message || "Failed to update currency");
    } finally {
      savingCurrency = false;
    }
  }

  async function handleDeleteCurrency(code: string) {
    if (!confirm(`Are you sure you want to delete ${code}? This cannot be undone.`)) return;
    try {
      await settings.deleteCurrency(code);
      if (editingCurrencyCode === code) cancelEditCurrency();
    } catch (err: any) {
      setError("currencyDelete", err.message || "Failed to delete currency");
    }
  }

  // ISO auto-fill hint
  let codeHint = $state<{ name: string; symbol: string; valid: boolean } | null>(null);

  function onCurrencyCodeInput() {
    const code = newCurrencyCode.trim().toUpperCase();
    if (!code) { codeHint = null; return; }
    const allCurrencies = [...ISO_4217_CURRENCIES, ...COMMON_CRYPTOS];
    const found = allCurrencies.find((c) => c.code === code);
    if (found) {
      codeHint = { name: found.name, symbol: found.symbol, valid: true };
      newCurrencyName = found.name;
      newCurrencySymbol = found.symbol;
    } else if (newCurrencyType === "fiat" && isIsoFiatCode(code)) {
      codeHint = { name: "", symbol: "", valid: true };
    } else {
      codeHint = { name: "", symbol: "", valid: false };
    }
  }

  // Default currency change modal
  let showCurrencyChangeModal = $state(false);
  let selectedDefaultCurrency = $state("");
  let transactionCount = $state(0);

  // Import/Export
  let importJson = $state("");
  let importResult = $state<any>(null);

  // ─── Reordering ────────────────────────────────────────────────────────────
  async function moveUp(code: string) {
    const list = [...settings.currencies].filter(c => c.isActive !== false);
    const idx = list.findIndex((c: any) => c.code === code);
    if (idx <= 0) return;
    const reordered = [...list];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await settings.reorderCurrencies(reordered.map((c: any) => c.code));
  }

  async function moveDown(code: string) {
    const list = [...settings.currencies].filter(c => c.isActive !== false);
    const idx = list.findIndex((c: any) => c.code === code);
    if (idx < 0 || idx >= list.length - 1) return;
    const reordered = [...list];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    await settings.reorderCurrencies(reordered.map((c: any) => c.code));
  }

  // ─── Toggle active/inactive ────────────────────────────────────────────────
  async function toggleActive(code: string, current: boolean) {
    await settings.toggleCurrency(code, !current);
  }

  // ─── Export / Import ────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const data = await api.exportCurrencies();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `money-tracker-currencies-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("import", `Export failed: ${err.message}`);
    }
  }

  function handleImportParse() {
    importResult = null;
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
      importResult = { valid: true, count: parsed.length, currencies: parsed };
    } catch (e: any) {
      importResult = { valid: false, error: e.message };
    }
  }

  async function handleImportSubmit() {
    if (!importResult?.valid) return;
    savingCurrency = true;
    try {
      const result = await api.importCurrencies(importResult.currencies);
      importResult = { ...importResult, result };
      await settings.load();
      importJson = "";
    } catch (err: any) {
      setError("import", `Import failed: ${err.message}`);
    } finally {
      savingCurrency = false;
    }
  }

  // ─── Settings handlers ─────────────────────────────────────────────────────
  async function loadTransactionCount() {
    try {
      const allResult = await api.getTransactions({ limit: 1000 });
      transactionCount = allResult.items?.length || 0;
    } catch { transactionCount = 0; }
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
      setError("settings", err.message);
    } finally {
      savingSettings = false;
    }
  }

  function cancelCurrencyChange() {
    showCurrencyChangeModal = false;
    selectedDefaultCurrency = settings.data?.defaultCurrency || "USD";
  }

  // Currency submit
  async function handleCurrencySubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!newCurrencyCode.trim() || !newCurrencyName.trim()) {
      setError("currency", "Code and name are required");
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
      await settings.load();
      newCurrencyCode = ""; newCurrencyName = ""; newCurrencySymbol = "$"; newCurrencyPrecision = 2; newCurrencyType = "fiat";
      codeHint = null;
    } catch (err: any) {
      setError("currency", err.message || "Failed to create currency");
    } finally {
      savingCurrency = false;
    }
  }

  function toggleAutoFetch(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    settings.update({ autoFetchRates: checkbox.checked ? 1 : 0 });
  }

  // Show all currencies (including inactive) for management, but active-only for dropdowns
  function activeFiatCurrencies() {
    return settings.activeCurrencies("fiat");
  }

  function inactiveCurrencies() {
    return settings.currencies?.filter((c: any) => !c.isActive) || [];
  }

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }
</script>

<!-- ═══ Tabs ─────────────────────────────────────────────────────────────────── -->
<div class="space-y-6 max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900">Settings</h1>

  {#if errors.submit || errors.settings || errors.import}
    <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {errors.submit || errors.settings || errors.import}
    </div>
  {/if}

  <nav class="flex gap-1 border-b border-gray-200">
    {#each tabs as tab}
      <button
        class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
          {activeTab === tab.key
            ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
        onclick={() => activeTab = tab.key}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <!-- ═══ GENERAL TAB ════════════════════════════════════════════════════════ -->
  {#if activeTab === "general"}
    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
          <select
            value={settings.data?.defaultCurrency || "USD"}
            onchange={onChangeDefaultCurrency}
            class="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {#each activeFiatCurrencies() as c}
              {@const emoji = getCurrencyEmoji(c.code)}
              <option value={c.code}>{emoji ? emoji + " " : ""}{c.symbol || c.code} {c.code} — {c.name}</option>
            {/each}
          </select>
          <p class="mt-1 text-xs text-gray-500">All totals and reports will be displayed in this currency.</p>
        </div>
        <div class="flex items-center gap-3">
          <input type="checkbox" id="autoFetch" checked={settings.data?.autoFetchRates === 1} onchange={toggleAutoFetch} class="rounded border-gray-300">
          <label for="autoFetch" class="text-sm text-gray-700">Auto-fetch exchange rates</label>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Fiat fetch interval (minutes)</label>
            <input type="number" value={settings.data?.fiatFetchInterval || 60}
              oninput={(e) => settings.update({ fiatFetchInterval: parseInt((e.target as any).value) })}
              min="1" max="10080" class="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Crypto fetch interval (minutes)</label>
            <input type="number" value={settings.data?.cryptoFetchInterval || 5}
              oninput={(e) => settings.update({ cryptoFetchInterval: parseInt((e.target as any).value) })}
              min="1" max="10080" class="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ═══ CURRENCIES TAB ═════════════════════════════════════════════════════ -->
  {#if activeTab === "currencies"}
    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Currencies</h2>
        <button onclick={handleExport} class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          📤 Export JSON
        </button>
      </div>

      {#if errors.currencyEdit || errors.currencyDelete}
        <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errors.currencyEdit || errors.currencyDelete}
        </div>
      {/if}

      <!-- Active Currencies Table -->
      {#if settings.currencies?.length > 0}
        <div class="overflow-x-auto mb-6">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="w-8 px-2 py-2 text-left font-medium text-gray-500"></th>
                <th class="w-12 px-2 py-2 text-center font-medium text-gray-500">Active</th>
                <th class="w-8 px-2 py-2 text-center font-medium text-gray-500"></th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Code</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Symbol</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Precision</th>
                <th class="px-3 py-2 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each [...settings.currencies].filter(c => c.isActive !== false) as c, idx (c.code)}
                <tr class="transition-colors duration-200 hover:bg-slate-50">
                  <td class="px-2 py-2">
                    <div class="flex flex-col gap-0.5">
                      <button class="px-1 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity disabled:opacity-0" disabled={idx === 0} onclick={() => moveUp(c.code)} title="Move up">
                        ▲
                      </button>
                      <button class="px-1 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity disabled:opacity-0" disabled={idx >= [...settings.currencies].filter(fc => fc.isActive !== false).length - 1} onclick={() => moveDown(c.code)} title="Move down">
                        ▼
                      </button>
                    </div>
                  </td>
                  <td class="px-2 py-2 text-center">
                    <button onclick={() => toggleActive(c.code, c.isActive !== false)}
                      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 {c.isActive !== false ? 'bg-blue-500' : 'bg-gray-300'}"
                      role="switch" aria-checked={c.isActive !== false}>
                      <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {c.isActive !== false ? 'translate-x-4' : 'translate-x-0.5'}"></span>
                    </button>
                  </td>
                  <td class="px-2 py-2 text-center" title="{getCurrencyEmoji(c.code) ? 'Recognized currency' : 'Custom / unknown'}">
                    <span class="text-lg">{getCurrencyEmoji(c.code) || "🪙"}</span>
                  </td>
                  <td class="px-3 py-2 font-medium">{c.code}</td>

                  {#if editingCurrencyCode === c.code}
                    <td class="px-2 py-2">
                      <input type="text" bind:value={editCurrencyName} class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
                    </td>
                    <td class="px-2 py-2">
                      <input type="text" bind:value={editCurrencySymbol} class="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
                    </td>
                    <td class="px-2 py-2">
                      <select bind:value={editCurrencyType} class="rounded border border-gray-300 px-2 py-1 text-xs">
                        <option value="fiat">Fiat</option>
                        <option value="crypto">Crypto</option>
                      </select>
                    </td>
                    <td class="px-2 py-2">
                      <input type="number" bind:value={editCurrencyPrecision} min="0" max="18" class="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
                    </td>
                    <td class="px-2 py-2">
                      <div class="flex gap-2">
                        <button onclick={() => handleCurrencyUpdate(c)} disabled={savingCurrency} class="text-xs text-green-600 hover:text-green-800 disabled:opacity-50">Save</button>
                        <button onclick={cancelEditCurrency} class="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </td>
                  {:else}
                    <td class="px-3 py-2">{c.name}</td>
                    <td class="px-3 py-2 text-gray-600">{c.symbol || "—"}</td>
                    <td class="px-3 py-2">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs {c.type === 'crypto' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}">
                        {c.type === "crypto" ? "Crypto" : "Fiat"}
                      </span>
                    </td>
                    <td class="px-3 py-2">{c.precision}</td>
                    <td class="px-3 py-2">
                      <div class="flex gap-2">
                        <button onclick={() => startEditCurrency(c)} class="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                        <button onclick={() => handleDeleteCurrency(c.code)} class="text-xs text-red-600 hover:text-red-800">Delete</button>
                      </div>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Inactive Currencies (collapsed) -->
        {#if inactiveCurrencies().length > 0}
          <details class="mb-4">
            <summary class="cursor-pointer text-sm text-gray-500 font-medium select-none">
              Hidden currencies ({inactiveCurrencies().length})
            </summary>
            <div class="mt-2 space-y-1">
              {#each inactiveCurrencies() as c}
                <div class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg opacity-60">
                  <span class="text-lg">{getCurrencyEmoji(c.code) || "🪙"}</span>
                  <span class="text-sm font-medium text-gray-500">{c.code}</span>
                  <span class="text-sm text-gray-400">{c.name}</span>
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-200 text-gray-500">{c.type}</span>
                  <button onclick={() => toggleActive(c.code, false)} class="ml-auto text-xs text-blue-600 hover:text-blue-800">Show</button>
                </div>
              {/each}
            </div>
          </details>
        {/if}
      {:else}
        <p class="text-gray-500 text-sm py-4">Loading currencies...</p>
      {/if}

      <!-- Action Buttons -->
      <div class="flex gap-3 mt-4">
        <button onclick={() => { showCurrencyForm = !showCurrencyForm; showImportForm = false; }}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showCurrencyForm ? "Cancel" : "+ Add Custom Currency"}
        </button>
        <button onclick={() => { showImportForm = !showImportForm; showCurrencyForm = false; }}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showImportForm ? "Cancel" : "📥 Import JSON"}
        </button>
      </div>

      <!-- Add Currency Form -->
      {#if showCurrencyForm}
        <form onsubmit={handleCurrencySubmit} class="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
          {#if errors.currency}
            <p class="text-xs text-red-600">{errors.currency}</p>
          {/if}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Code (2-10 chars)</label>
              <input type="text" bind:value={newCurrencyCode} maxlength="10"
                oninput={onCurrencyCodeInput}
                placeholder={newCurrencyType === "fiat" ? "e.g. SGD" : "e.g. BTC"}
                class="w-full rounded-lg border px-3 py-2 text-sm" />
              {#if codeHint}
                <p class="mt-0.5 text-xs {codeHint.valid ? 'text-green-600' : 'text-gray-500'}">
                  {#if codeHint.name}
                    ✓ Found: {codeHint.name} ({codeHint.symbol})
                  {:else if codeHint.valid}
                    ✓ Valid {newCurrencyType === "fiat" ? "ISO 4217" : "crypto ticker"}
                  {:else}
                    ⚠ Not in standard registry — custom currency
                  {/if}
                </p>
              {/if}
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" bind:value={newCurrencyName} maxlength="50"
                placeholder="e.g. Singapore Dollar"
                class="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input type="text" bind:value={newCurrencySymbol} maxlength="5"
                placeholder="S$"
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
                onchange={() => { newCurrencyPrecision = newCurrencyType === "crypto" ? 8 : 2; codeHint = null; }}
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

      <!-- Import Form -->
      {#if showImportForm}
        <div class="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <p class="text-sm text-gray-600">Paste a JSON array of currencies below. Duplicates will be updated.</p>
          <textarea bind:value={importJson} rows="8"
            placeholder={`[\n  {\n    "code": "SEK",\n    "name": "Swedish Krona",\n    "symbol": "kr",\n    "precision": 2,\n    "type": "fiat",\n    "isActive": true,\n    "sortOrder": 0\n  }\n]`}
            class="w-full rounded-lg border px-3 py-2 text-sm font-mono"
          ></textarea>
          <div class="flex gap-2">
            <button onclick={handleImportParse} disabled={!importJson.trim()}
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Validate
            </button>
            {#if importResult?.valid}
              <button onclick={handleImportSubmit} disabled={savingCurrency}
                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCurrency ? "Importing..." : `Import ${importResult.count} currencies`}
              </button>
            {/if}
          </div>
          {#if importResult}
            <div class="text-sm p-2 rounded {importResult.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}">
              {#if importResult.valid}
                ✅ Valid: {importResult.count} currencies ready to import
                {#if importResult.result}
                  <div class="mt-1 text-xs space-y-0.5">
                    <p>Inserted: {importResult.result.inserted}</p>
                    <p>Updated: {importResult.result.updated}</p>
                    {#if importResult.result.failed?.length > 0}
                      <p>Failed: {importResult.result.failed.length}</p>
                      <ul class="ml-4 text-red-600">
                        {#each importResult.result.failed as f}
                          <li>{f}</li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                {/if}
              {:else}
                ❌ {importResult.error}
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- ═══ CATEGORIES TAB ═════════════════════════════════════════════════════ -->
  {#if activeTab === "categories"}
    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Categories</h2>

      {#if errors.cat}
        <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.cat}</div>
      {/if}

      <form onsubmit={handleCategorySubmit} class="mb-6 flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <input type="text" bind:value={catName} placeholder="Category name"
            class="w-full rounded-lg border {errors.cat ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <input type="color" bind:value={catColor} class="h-9 w-14 rounded-lg border border-gray-300 cursor-pointer" />
        </div>
        <select bind:value={catType} class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          {editingCatId ? "Update" : "Add"}
        </button>
        {#if editingCatId}
          <button type="button" onclick={cancelEditCategory} class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
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
                <button onclick={() => startEditCategory(cat)} class="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                <button onclick={() => handleDeleteCategory(cat.id)} class="text-sm text-red-600 hover:text-red-800">Delete</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- ═══ Currency Change Confirmation Modal ═══════════════════════════════════ -->
{#if showCurrencyChangeModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Change Default Currency?</h3>
      <p class="text-sm text-gray-600 mb-4">
        You are about to change your default currency to <span class="font-medium">{selectedDefaultCurrency}</span>.
      </p>
      <div class="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800 mb-4">
        This will recalculate all {transactionCount} existing transactions.
        Make sure you have the correct exchange rates stored.
      </div>
      <div class="flex gap-3">
        <button onclick={confirmCurrencyChange} disabled={savingSettings}
          class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {savingSettings ? "Updating..." : "Confirm"}
        </button>
        <button onclick={cancelCurrencyChange}
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
