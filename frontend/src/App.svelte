<script lang="ts">
  import Login from "./routes/Login.svelte";
  import Dashboard from "./routes/Dashboard.svelte";
  import Transactions from "./routes/Transactions.svelte";
  import TransactionForm from "./routes/TransactionForm.svelte";
  import Settings from "./routes/Settings.svelte";
  import OfflineNotice from "./components/OfflineNotice.svelte";
  import { auth } from "./state/auth.svelte";

  let route = $state(window.location.hash || "#/login");
  window.addEventListener("hashchange", () => {
    route = window.location.hash;
  });

  // Redirect unauthenticated to login
  $effect(() => {
    if (!auth.isAuthenticated && route !== "#/login") {
      window.location.hash = "#/login";
    }
  });

  function navigate(path: string) {
    window.location.hash = `#${path}`;
  }

  function handleLogout() {
    auth.logout();
    navigate("/login");
  }
</script>

<OfflineNotice />

{#if auth.isAuthenticated}
  <nav class="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <a href="#/dashboard" class="flex items-center gap-2 text-lg font-bold text-gray-900" onclick={(e: Event) => { e.preventDefault(); navigate("/dashboard"); }}>
        <img src="/favicon.png" alt="Money Tracker" class="h-8 w-8" />
        Money Tracker
      </a>
      <div class="flex gap-4 items-center">
        <a href="#/dashboard" class="text-sm text-gray-600 hover:text-gray-900" onclick={(e: Event) => { e.preventDefault(); navigate("/dashboard"); }}>Dashboard</a>
        <a href="#/transactions" class="text-sm text-gray-600 hover:text-gray-900" onclick={(e: Event) => { e.preventDefault(); navigate("/transactions"); }}>Transactions</a>
        <a href="#/settings" class="text-sm text-gray-600 hover:text-gray-900" onclick={(e: Event) => { e.preventDefault(); navigate("/settings"); }}>Settings</a>
        <button onclick={handleLogout} class="text-sm text-red-600 hover:text-red-800">Logout</button>
      </div>
    </div>
  </nav>
{/if}

<main class="max-w-4xl mx-auto px-4 py-6">
  {#if route === "#/login" || !auth.isAuthenticated}
    <Login onLogin={() => navigate("/dashboard")} />
  {:else if route === "#/dashboard"}
    <Dashboard />
  {:else if route === "#/transactions"}
    <Transactions />
  {:else if route.startsWith("#/transaction")}
    <TransactionForm />
  {:else if route === "#/settings"}
    <Settings />
  {:else}
    <Dashboard />
  {/if}
</main>
