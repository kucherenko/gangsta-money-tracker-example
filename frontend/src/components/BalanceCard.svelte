<script lang="ts">
  interface Props {
    title: string;
    amount: number;
    color?: string;
  }

  let { title, amount, color = "text-gray-900" }: Props = $props();

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }
</script>

<div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
  <p class="text-sm font-medium text-gray-500 mb-1">{title}</p>
  <p class="text-2xl font-bold {color}">{formatCurrency(amount)}</p>
</div>
