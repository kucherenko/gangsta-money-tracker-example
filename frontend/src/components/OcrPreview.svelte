<script lang="ts">
  import type { ReceiptExtract } from "@money-tracker/shared/schemas";

  type Props = {
    suggestion: ReceiptExtract;
    onApply: () => void;
    onDiscard: () => void;
  };

  let { suggestion, onApply, onDiscard }: Props = $props();

  function confidenceColor(): string {
    switch (suggestion.confidence) {
      case "high": return "text-green-700 bg-green-50 border-green-200";
      case "medium": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "low": return "text-red-700 bg-red-50 border-red-200";
      default: return "text-gray-700 bg-gray-50 border-gray-200";
    }
  }
</script>

<div class="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
  <div class="flex items-center justify-between px-4 py-3">
    <h3 class="text-sm font-semibold text-gray-900">OCR Scan Preview</h3>
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border {confidenceColor()}"
    >
      {suggestion.confidence} confidence
    </span>
  </div>

  <div class="grid grid-cols-2 gap-4 px-4 py-4 text-sm">
    <div>
      <span class="block text-xs text-gray-500">Amount</span>
      <span class="font-medium text-gray-900">{suggestion.amount} <span class="text-gray-500">{suggestion.currency}</span></span>
    </div>
    <div>
      <span class="block text-xs text-gray-500">Date</span>
      <span class="font-medium text-gray-900">{suggestion.date}</span>
    </div>
    <div>
      <span class="block text-xs text-gray-500">Description</span>
      <span class="font-medium text-gray-900 truncate max-w-[200px] inline-block" title={suggestion.description || ""}>{suggestion.description || "—"}</span>
    </div>
    <div>
      <span class="block text-xs text-gray-500">Suggested Category</span>
      <span class="font-medium text-blue-700">{suggestion.category || "—"}</span>
    </div>
  </div>

  <div class="flex gap-2 px-4 py-3">
    <button
      onclick={onApply}
      class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >Apply Scan</button>
    <button
      onclick={onDiscard}
      class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >Discard</button>
  </div>
</div>
