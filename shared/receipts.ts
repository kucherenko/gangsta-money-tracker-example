export const RECEIPT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const RECEIPT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const RECEIPT_ACCEPTED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
] as const;

export type ReceiptMimeType = (typeof RECEIPT_ACCEPTED_MIME_TYPES)[number];
export type ReceiptExtension = (typeof RECEIPT_ACCEPTED_EXTENSIONS)[number];
