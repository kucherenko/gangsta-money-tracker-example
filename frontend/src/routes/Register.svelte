<script lang="ts">
  import { auth } from "../state/auth.svelte";
  import { api } from "../lib/api";

  let username = $state("");
  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);
  let registrationEnabled = $state(false);

  interface Props {
    onRegister?: () => void;
  }

  let { onRegister }: Props = $props();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      await auth.register(username, password, email || undefined);
      onRegister?.();
    } catch (err: any) {
      error = err.message || "Registration failed";
    } finally {
      loading = false;
    }
  }

  api.getRegistrationStatus().then((d: any) => {
    registrationEnabled = d.allowRegistration;
  }).catch(() => {});
</script>

<div class="min-h-[80vh] flex items-center justify-center">
  <div class="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
    <div class="flex flex-col items-center mb-6">
      <img src="/favicon.png" alt="Money Tracker" class="h-12 w-12 mb-2" />
      <h1 class="text-2xl font-bold text-gray-900">Create Account</h1>
    </div>

    {#if !registrationEnabled}
      <div class="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
        Registration is currently disabled. Contact your administrator.
      </div>
    {:else}
      {#if error}
        <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            bind:value={username}
            required
            minlength="3"
            maxlength="30"
            pattern="[a-zA-Z0-9_]+"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="3-30 chars, letters/numbers/underscore"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="reg-email">Email (optional)</label>
          <input
            id="reg-email"
            type="email"
            bind:value={email}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            bind:value={password}
            required
            minlength="8"
            maxlength="128"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="reg-confirm">Confirm Password</label>
          <input
            id="reg-confirm"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="8"
            maxlength="128"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Re-enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || password !== confirmPassword}
          class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    {/if}

    <div class="mt-4 text-center">
      <a href="#/login" class="text-sm text-blue-600 hover:text-blue-800">Already have an account? Sign in</a>
    </div>
  </div>
</div>