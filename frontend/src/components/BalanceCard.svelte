<script lang="ts">
  import { settings } from "../state/settings.svelte";

  interface Props {
    title: string;
    amount: number;
    color?: string;
    currency?: string;
  }

  let { title, amount, color = "text-gray-900", currency }: Props = $props();

  function formatCurrency(value: number, currencyCode?: string): string {
    const defaultCurrency = currency || settings.data?.defaultCurrency || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: defaultCurrency,
    }).format(value);
  }
</script>

<div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
  <p class="text-sm font-medium text-gray-500 mb-1">{title}</p>
  <p class="text-2xl font-bold {color}">{formatCurrency(amount, currency)}</p>
</div>
