<script lang="ts">
  type Props = {
    onSelect?: (file: File) => void;
    onCancel?: () => void;
  };

  let { onSelect, onCancel }: Props = $props();

  let preview = $state<string | null>(null);
  let error = $state<string | null>(null);
  let dragOver = $state(false);
  let selectedFile = $state<File | null>(null);

  const allowedMime = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  function isPdf(file: File): boolean {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  function handleFile(file: File) {
    error = null;
    preview = null;
    selectedFile = null;

    if (!allowedMime.includes(file.type)) {
      error = `Unsupported file type: ${file.type}. Only JPG, PNG, WEBP, and PDF are allowed.`;
      return;
    }

    selectedFile = file;
    if (!isPdf(file)) {
      preview = URL.createObjectURL(file);
    }
    onSelect?.(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() {
    dragOver = false;
  }

  function onFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
    input.value = "";
  }

  function onCancelClick() {
    preview = null;
    error = null;
    selectedFile = null;
    onCancel?.();
  }

  async function onCameraCapture() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.style.display = "none";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) handleFile(file);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  }
</script>

{#if preview}
  <div class="space-y-3">
    <img src={preview} alt="Receipt preview" class="w-full max-h-64 object-contain rounded-lg border border-gray-200" />
    <div class="flex gap-2">
      <button
        onclick={onCancelClick}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >Retake / Choose Another</button>
    </div>
  </div>
{:else if selectedFile && isPdf(selectedFile)}
  <div class="space-y-3">
    <div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4z"/>
      </svg>
      <div class="min-w-0">
        <p class="font-medium text-gray-900 truncate">{selectedFile.name}</p>
        <p class="text-xs text-gray-500">PDF document</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button
        onclick={onCancelClick}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >Choose Another</button>
    </div>
  </div>
{:else}
  <div
    class="rounded-xl border-2 border-dashed p-6 text-center transition-colors
      {dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
      {error ? 'border-red-300 bg-red-50' : ''}"
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    role="button"
    tabindex="0"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
    <p class="mt-2 text-sm text-gray-600">Drag & drop a receipt here</p>
    <p class="text-xs text-gray-500 mt-1">or</p>
    <div class="flex justify-center gap-3 mt-3">
      <label
        class="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 inline-block"
      >
        Choose File
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="sr-only" onchange={onFileInput} />
      </label>
      <button
        onclick={onCameraCapture}
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Camera
      </button>
    </div>
    {#if error}
      <p class="mt-3 text-xs text-red-600">{error}</p>
    {/if}
  </div>
{/if}
