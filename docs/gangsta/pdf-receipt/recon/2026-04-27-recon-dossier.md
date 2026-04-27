---
heist: pdf-receipt
phase: reconnaissance
status: pending-review
---

# Reconnaissance Dossier: PDF Receipt Recognition

## Objective
Add the ability to recognize PDF receipts alongside existing image-based OCR. Users should be able to upload PDF files, which are converted to images and processed by the existing Ollama vision model pipeline.

## Codebase Overview

### Existing OCR Infrastructure (from completed `ocr-receipt` Heist)
- **Backend service**: `backend/services/ocr.ts` — `OllamaOcrService` and `MockOcrService` interfaces. Accepts a `filePath`, reads image via `Bun.file()`, base64-encodes, and sends to Ollama qwen3-vl:235b-cloud.
- **Backend route**: `backend/routes/ocr.ts` — `POST /api/ocr` accepts multipart form with "image" field, validates MIME type (`image/jpeg`, `image/png`, `image/webp`), validates extension, writes to `data/temp_receipts/`, calls `ocrService.extractReceipt()`, returns `{ suggestion, tempId, tempExt }`.
- **Frontend component**: `frontend/src/components/ImageUpload.svelte` — drag-and-drop, file picker (accepts `image/jpeg,image/png,image/webp`), camera capture. Allowed MIME whitelist: `["image/jpeg", "image/png", "image/webp"]`.
- **API client**: `frontend/src/lib/api.ts` — `uploadReceipt(file: File)` sends `FormData` with "image" field to `POST /api/ocr`.
- **Receipt serving**: `backend/routes/transactions.ts` — `GET /transactions/:id/receipt` serves files from `data/receipts/` with extensions `jpg`, `jpeg`, `png`, `webp`.
- **Transaction creation**: `backend/routes/transactions.ts` `POST /transactions` accepts `receiptTempId` and `receiptTempExt`, moves file from `data/temp_receipts/` to `data/receipts/{id}.{ext}`.
- **Schemas**: `shared/schemas.ts` — `receiptExtractSchema`, `receiptUploadResponseSchema`.
- **Frontend preview**: `frontend/src/components/OcrPreview.svelte` — displays extracted suggestion with confidence.
- **Transaction form**: `frontend/src/routes/TransactionForm.svelte` — OCR mode toggle, snapshot/restore form state, Apply Scan / Discard flow.

### Tech Stack
- Backend: Bun + Hono + raw SQL + Zod
- Frontend: Svelte 5 (runes) + Vite + Tailwind CSS
- Database: SQLite (`bun:sqlite`)
- Deployment: Local-first, single-user assumed

### Key Files
- `backend/services/ocr.ts` — OCR service contract
- `backend/routes/ocr.ts` — upload endpoint
- `backend/routes/transactions.ts` — receipt serving + creation
- `frontend/src/components/ImageUpload.svelte` — upload UI
- `frontend/src/lib/api.ts` — API client
- `frontend/src/routes/TransactionForm.svelte` — form + OCR integration
- `shared/schemas.ts` — shared Zod schemas

## Existing Test Coverage
- Single test file: `backend/tests/api.test.ts`
- Covers: Auth, Currencies, Settings, Transactions (create/list), Rates (refresh/cross-rate), Dashboard, Protected routes
- **No tests currently cover OCR upload endpoint** — this gap existed after the previous Heist as well
- Test framework: `bun:test`
- Run command: `bun run test:backend`

## Dependencies
- Backend: `hono`, `zod`, `drizzle-orm`, `bcryptjs`
- No PDF processing library currently installed
- Bun runtime provides native `Bun.file()` and `fetch()`

## Relevant Ledger Entries

### Applicable Insights (from `ocr-receipt` Heist)
- OCR pipeline is already working with `qwen3-vl:235b-cloud` via Ollama
- `extractReceipt()` takes a `filePath` string — good abstraction boundary for PDF→image conversion
- Confirmation barrier (Apply Scan preview) already built — reuse unchanged
- Snapshot/restore form state on OCR cancel already built — reuse unchanged
- Filesystem-only persistence with no DB migrations already established
- Dedicated multipart upload method (`uploadReceipt`) already isolated from JSON API client

### Applicable Negative Constraints (from `ocr-receipt` contract)
- NEVER introduce database schema migrations for this feature
- NEVER auto-populate the transaction form with OCR values without explicit user action (Apply Scan button)
- NEVER expose Ollama URL or model configuration to the frontend
- Receipt image route ordering safety: `GET /transactions/:id/receipt` must come before `GET /:id` in Hono router (already satisfied)

## Risks and Unknowns

1. **PDF→Image conversion library**: Need a lightweight Node/Bun-compatible library. Options:
   - `pdf2pic` (ImageMagick/GraphicsMagick wrapper via `gm`) — heavy dependency
   - `pdf-poppler` — native bindings, may be hard to install
   - **Bun-native or Node.js child-process approach**: Use system `pdftoppm`/`gs` if available, or `pdfjs-dist` (pure JS, no native deps) to render to canvas and save PNG
   - **Recommended**: `pdfjs-dist` (Mozilla PDF.js) — pure TypeScript, works in Bun, can render pages to image buffers

2. **Multi-page PDFs**: Need consensus on whether to:
   - Process only the first page
   - Merge all pages into one tall image
   - Allow user to select a page

3. **File size**: PDFs may be large; no file size limit exists yet (consistent with previous Heist risk acceptance)

4. **Vision model compatibility**: Ollama vision model expects base64 images — PNG/JPEG output from PDF renderer is fine

5. **No existing OCR tests**: Adding backend tests for PDF upload will require mocking the OCR service + providing a test PDF or mocking the PDF renderer

## Recommended Scope (MVP)

1. Accept `application/pdf` MIME type and `.pdf` extension in upload endpoint
2. Render the **first page** of the PDF to a PNG image using `pdfjs-dist` (lightweight, no native dependencies)
3. Save the rendered PNG to `data/temp_receipts/` alongside existing image flow
4. Forward the PNG path to existing `OllamaOcrService.extractReceipt()` — zero changes to OCR prompt or model interaction
5. Frontend: extend `allowedMime` in `ImageUpload.svelte` to include `application/pdf`, update file picker `accept` attribute
6. Update receipt serving route to recognize `.pdf` uploads (stored as `.png` after conversion, so no change needed to serving logic if we save the rendered image)
7. Add backend tests for PDF upload path with mocked OCR service and mocked PDF render
8. All existing tests must continue to pass

## Out of Scope (for this Heist)
- Multi-page PDF selection/merging
- Password-protected PDFs
- OCR on every page of a multi-page PDF
- PDF text extraction bypassing vision model (pure text layer extraction)

---

**Status**: Pending Don approval to proceed to Phase 2 (The Grilling).
