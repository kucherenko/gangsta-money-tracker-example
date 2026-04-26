<script lang="ts">
  import { transactions } from "../state/transactions.svelte";
  import { categories } from "../state/categories.svelte";
  import { onMount } from "svelte";
  import { insertTransactionSchema } from "@money-tracker/shared/schemas";
  import { api } from "../lib/api";

  onMount(() => {
    categories.load();
    const id = extractId();
    if (id) {
      loadTransaction(id);
    }
  });

  let id = $state<number | null>(null);
  let amount = $state("");
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
    description = tx.description || "";
    date = tx.date;
    type = tx.type;
    categoryId = tx.categoryId;
  }

  function validate(): boolean {
    errors = {};
    const result = insertTransactionSchema.safeParse({
      amount: Number(amount),
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
    const data = {
      amount: Number(amount),
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
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">{id ? "Edit Transaction" : "Add Transaction"}</h1>

  {#if errors.submit}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.submit}</div>
  {/if}

  <form onsubmit={handleSubmit} class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="type">Type</label>
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

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="amount">Amount</label>
      <input
        id="amount"
        type="number"
        step="0.01"
        min="0"
        bind:value={amount}
        placeholder="0.00"
        class="w-full rounded-lg border {errors.amount ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      {#if errors.amount}
        <p class="mt-1 text-xs text-red-600">{errors.amount}</p>
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="date">Date</label>
      <input
        id="date"
        type="date"
        bind:value={date}
        class="w-full rounded-lg border {errors.date ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      {#if errors.date}
        <p class="mt-1 text-xs text-red-600">{errors.date}</p>
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="category">Category</label>
      <select
        id="category"
        bind:value={categoryId}
        class="w-full rounded-lg border {errors.categoryId ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="">Select category...</option>
        {#each categories.items.filter(c => c.type === type) as cat}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
      {#if errors.categoryId}
        <p class="mt-1 text-xs text-red-600">{errors.categoryId}</p>
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description (optional)</label>
      <input
        id="description"
        type="text"
        bind:value={description}
        placeholder="What was this for?"
        maxlength="255"
        class="w-full rounded-lg border {errors.description ? 'border-red-300' : 'border-gray-300'} px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      {#if errors.description}
        <p class="mt-1 text-xs text-red-600">{errors.description}</p>
      {/if}
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={loading}
        class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : id ? "Update" : "Add Transaction"}
      </button>
      <button
        type="button"
        onclick={() => navigate("/transactions")}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  </form>
</div>
