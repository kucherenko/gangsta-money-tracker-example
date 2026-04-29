<script lang="ts">
  import { auth } from "../state/auth.svelte";

  let username = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSetup() {
    error = "";
    loading = true;
    try {
      await auth.completeSetup({ username, password, confirmPassword });
      window.location.hash = "#/dashboard";
    } catch (e: any) {
      error = e.message || "Setup failed";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="max-w-md w-full">
    <div class="bg-white rounded-lg shadow-md p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Welcome to Money Tracker</h1>
        <p class="mt-2 text-sm text-gray-600">Create your admin account to get started</p>
      </div>

      {#if error}
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      {/if}

      <form on:submit|preventDefault={handleSetup} class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            required
            minlength="3"
            maxlength="30"
            pattern="[a-zA-Z0-9_]+"
            placeholder="admin"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="mt-1 text-xs text-gray-500">3-30 characters, letters, numbers, and underscores</p>
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            minlength="8"
            maxlength="128"
            placeholder="••••••••"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="mt-1 text-xs text-gray-500">At least 8 characters</p>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="8"
            maxlength="128"
            placeholder="••••••••"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password || !confirmPassword}
          class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if loading}
            Creating...
          {:else}
            Create Admin Account
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>