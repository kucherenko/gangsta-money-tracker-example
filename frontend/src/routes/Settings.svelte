<script lang="ts">
  import { categories } from "../state/categories.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    categories.load();
  });

  let newName = $state("");
  let newColor = $state("#64748b");
  let newType = $state<"income" | "expense">("expense");
  let editingId = $state<number | null>(null);
  let errors = $state<Record<string, string>>({});

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

  async function handleSubmit(e: SubmitEvent) {
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

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold text-gray-900">Settings</h1>

  <!-- Categories -->
  <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Categories</h2>

    {#if errors.submit}
      <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errors.submit}</div>
    {/if}

    <form onsubmit={handleSubmit} class="mb-6 flex flex-wrap items-end gap-3">
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
