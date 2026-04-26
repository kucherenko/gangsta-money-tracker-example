<script lang="ts">
  let isOnline = $state(navigator.onLine);

  window.addEventListener("online", () => isOnline = true);
  window.addEventListener("offline", () => isOnline = false);
</script>

{#if !isOnline}
  <div class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
    No connection — some features are unavailable
  </div>
{/if}
