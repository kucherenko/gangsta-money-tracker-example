<script lang="ts">
  import { admin } from "../state/admin.svelte";
  import { settings } from "../state/settings.svelte";
  import { auth } from "../state/auth.svelte";
  import { onMount } from "svelte";

  let activeSection = $state<"stats" | "registration" | "users" | "system">("stats");
  let showDeleteConfirm = $state<number | null>(null);
  let showCreateForm = $state<boolean>(false);
  let newUsername = $state("");
  let newPassword = $state("");
  let newRole = $state("user");
  let createError = $state("");
  let cleanupConfirm = $state<{ scope: string; typedScope: string } | null>(null);

  onMount(() => {
    if (auth.user?.role === "admin") {
      admin.loadAll();
      settings.loadRegistrationStatus();
    }
  });

  async function handleDeleteUser(id: number) {
    try {
      await admin.deleteUser(id);
      showDeleteConfirm = null;
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  }

  async function handleCreateUser() {
    createError = "";
    try {
      await api.createUser({ username: newUsername, password: newPassword, role: newRole });
      showCreateForm = false;
      newUsername = "";
      newPassword = "";
      newRole = "user";
      await admin.loadUsers();
    } catch (err: any) {
      createError = err.message || "Failed to create user";
    }
  }

  async function handleToggleRegistration(value: boolean) {
    try {
      await settings.toggleRegistration(value);
    } catch (err: any) {
      alert(err.message || "Failed to update registration setting");
    }
  }

  function startCleanup(scope: string) {
    cleanupConfirm = { scope, typedScope: "" };
  }

  async function confirmCleanup() {
    if (!cleanupConfirm) return;
    const scope = cleanupConfirm.scope;
    if (cleanupConfirm.typedScope !== scope.toUpperCase()) {
      alert(`Please type "${scope.toUpperCase()}" to confirm`);
      return;
    }
    try {
      const { token } = await admin.requestCleanupToken(scope);
      const result = await admin.executeCleanup(token, scope);
      alert(`Successfully deleted ${result.affected_rows} row(s).`);
      cleanupConfirm = null;
    } catch (err: any) {
      alert(err.message || "Cleanup failed");
      cleanupConfirm = null;
    }
  }

  import { api } from "../lib/api";
</script>

{#if auth.user?.role === "admin"}
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Admin Settings</h1>

    <div class="flex gap-2 border-b border-gray-200 pb-2">
      <button class="px-4 py-2 rounded-t text-sm font-medium {activeSection === 'stats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" onclick={() => activeSection = "stats"}>Stats</button>
      <button class="px-4 py-2 rounded-t text-sm font-medium {activeSection === 'registration' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" onclick={() => activeSection = "registration"}>Registration</button>
      <button class="px-4 py-2 rounded-t text-sm font-medium {activeSection === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" onclick={() => activeSection = "users"}>Users</button>
      <button class="px-4 py-2 rounded-t text-sm font-medium {activeSection === 'system' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" onclick={() => activeSection = "system"}>System</button>
    </div>

    {#if activeSection === "stats"}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow p-4 text-center">
          <div class="text-3xl font-bold text-blue-600">{admin.stats.users}</div>
          <div class="text-sm text-gray-500">Users</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 text-center">
          <div class="text-3xl font-bold text-green-600">{admin.stats.transactions}</div>
          <div class="text-sm text-gray-500">Transactions</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 text-center">
          <div class="text-3xl font-bold text-purple-600">{admin.stats.categories}</div>
          <div class="text-sm text-gray-500">Categories</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 text-center">
          <div class="text-3xl font-bold text-orange-600">{admin.stats.exchange_rates}</div>
          <div class="text-sm text-gray-500">Exchange Rates</div>
        </div>
      </div>
    {/if}

    {#if activeSection === "registration"}
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Registration</h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-700">Allow new users to register</p>
            <p class="text-sm text-gray-500">When disabled, only admins can create new user accounts.</p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {settings.allowRegistration ? 'bg-blue-600' : 'bg-gray-200'}"
            onclick={() => handleToggleRegistration(!settings.allowRegistration)}
          >
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {settings.allowRegistration ? 'translate-x-6' : 'translate-x-1'}" />
          </button>
        </div>
        <p class="mt-2 text-sm {settings.allowRegistration ? 'text-green-600' : 'text-red-600'}">
          Registration is currently {settings.allowRegistration ? 'enabled' : 'disabled'}
        </p>
      </div>
    {/if}

    {#if activeSection === "users"}
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Users</h2>
          <button class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700" onclick={() => showCreateForm = !showCreateForm}>
            {showCreateForm ? "Cancel" : "Create User"}
          </button>
        </div>

        {#if showCreateForm}
          <form class="mb-4 p-4 bg-gray-50 rounded-lg space-y-3" onsubmit={(e) => { e.preventDefault(); handleCreateUser(); }}>
            {#if createError}
              <p class="text-red-600 text-sm">{createError}</p>
            {/if}
            <div class="flex gap-3">
              <input type="text" bind:value={newUsername} placeholder="Username" class="flex-1 border rounded px-3 py-2 text-sm" required minlength={3} />
              <input type="password" bind:value={newPassword} placeholder="Password" class="flex-1 border rounded px-3 py-2 text-sm" required minlength={8} />
              <select bind:value={newRole} class="border rounded px-3 py-2 text-sm">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Create</button>
            </div>
          </form>
        {/if}

        {#if admin.loading}
          <p class="text-gray-500 text-sm">Loading users...</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-600">
                  <th class="pb-2 pr-4">ID</th>
                  <th class="pb-2 pr-4">Username</th>
                  <th class="pb-2 pr-4">Email</th>
                  <th class="pb-2 pr-4">Role</th>
                  <th class="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each admin.users as user}
                  <tr class="border-b hover:bg-gray-50">
                    <td class="py-2 pr-4 text-gray-500">{user.id}</td>
                    <td class="py-2 pr-4 font-medium">{user.username}</td>
                    <td class="py-2 pr-4 text-gray-500">{user.email || "-"}</td>
                    <td class="py-2 pr-4">
                      <span class="px-2 py-0.5 rounded text-xs font-medium {user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
                        {user.role}
                      </span>
                    </td>
                    <td class="py-2">
                      {#if user.id !== auth.user?.id}
                        <button class="text-red-600 hover:text-red-800 text-sm" onclick={() => showDeleteConfirm = user.id}>
                          Delete
                        </button>
                      {:else}
                        <span class="text-gray-400 text-sm">Current user</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if admin.usersTotal > admin.usersLimit}
            <p class="mt-2 text-sm text-gray-500">Showing {admin.users.length} of {admin.usersTotal} users</p>
          {/if}
        {/if}

        {#if showDeleteConfirm !== null}
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showDeleteConfirm = null}>
            <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4" onclick={(e: Event) => e.stopPropagation()}>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Confirm Deletion</h3>
              <p class="text-gray-600 mb-4">Are you sure you want to delete this user? This will also delete all their transactions, categories, and settings. This action cannot be undone.</p>
              <div class="flex gap-3 justify-end">
                <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" onclick={() => showDeleteConfirm = null}>Cancel</button>
                <button class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700" onclick={() => handleDeleteUser(showDeleteConfirm!)}>Delete</button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if activeSection === "system"}
      <div class="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 class="text-lg font-semibold text-gray-900">System Cleanup</h2>
        <p class="text-sm text-gray-500">These operations are irreversible. A confirmation token will be requested before execution.</p>

        <div class="space-y-3">
          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900">Purge All Transactions</h3>
              <p class="text-sm text-gray-500">Delete all transaction records from the database. {admin.stats.transactions} transactions will be removed.</p>
            </div>
            <button class="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700" onclick={() => startCleanup("transactions")}>
              Purge Transactions
            </button>
          </div>

          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900">Purge Orphaned Data</h3>
              <p class="text-sm text-gray-500">Delete consumed expired refresh tokens and orphaned non-predefined categories.</p>
            </div>
            <button class="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700" onclick={() => startCleanup("orphaned")}>
              Purge Orphaned
            </button>
          </div>
        </div>

        {#if cleanupConfirm}
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 class="text-lg font-semibold text-red-600 mb-2">Confirm: {cleanupConfirm.scope === "transactions" ? "Purge All Transactions" : "Purge Orphaned Data"}</h3>
              <p class="text-gray-600 mb-4">This action is irreversible. Type <strong class="font-mono bg-gray-100 px-1">{cleanupConfirm.scope.toUpperCase()}</strong> to confirm.</p>
              <input
                type="text"
                class="w-full border rounded px-3 py-2 text-sm mb-4"
                placeholder={`Type ${cleanupConfirm.scope.toUpperCase()} to confirm`}
                bind:value={cleanupConfirm.typedScope}
              />
              <div class="flex gap-3 justify-end">
                <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" onclick={() => cleanupConfirm = null}>Cancel</button>
                <button
                  class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 {cleanupConfirm.typedScope !== cleanupConfirm.scope.toUpperCase() ? 'opacity-50 cursor-not-allowed' : ''}"
                  onclick={confirmCleanup}
                  disabled={cleanupConfirm.typedScope !== cleanupConfirm.scope.toUpperCase()}
                >
                  Confirm Purge
                </button>
              </div>
            </div>
          </div>
        {/if}

        {#if admin.error}
          <p class="text-red-600 text-sm">{admin.error}</p>
        {/if}

        <div class="mt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Audit Log</h3>
          {#if admin.auditLog.length === 0}
            <p class="text-sm text-gray-500">No audit entries.</p>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-gray-600">
                    <th class="pb-2 pr-4">Time</th>
                    <th class="pb-2 pr-4">Action</th>
                    <th class="pb-2 pr-4">Scope</th>
                    <th class="pb-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {#each admin.auditLog as entry}
                    <tr class="border-b hover:bg-gray-50">
                      <td class="py-2 pr-4 text-gray-500 text-xs">{new Date(entry.created_at * 1000).toLocaleString()}</td>
                      <td class="py-2 pr-4 font-medium">{entry.action}</td>
                      <td class="py-2 pr-4 text-gray-500">{entry.scope || "-"}</td>
                      <td class="py-2 text-gray-500 text-xs max-w-xs truncate">{entry.details || "-"}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}