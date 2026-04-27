<script lang="ts">
  import { auth } from "../state/auth.svelte";
  import { api } from "../lib/api";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  interface Props {
    onLogin?: () => void;
  }

  let { onLogin }: Props = $props();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      await auth.login(username, password);
      onLogin?.();
    } catch (err: any) {
      error = err.message || "Login failed";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-[80vh] flex items-center justify-center">
  <div class="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
    <div class="flex flex-col items-center mb-6">
      <img src="/favicon.png" alt="Money Tracker" class="h-12 w-12 mb-2" />
      <h1 class="text-2xl font-bold text-gray-900">Money Tracker</h1>
    </div>

    {#if error}
      <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
    {/if}

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="admin"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="admin"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  </div>
</div>
