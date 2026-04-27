import { readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEMP_DIR = path.resolve("data/temp_receipts");
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function cleanupOldTempReceipts(maxAgeMs = DEFAULT_MAX_AGE_MS): { deleted: number; errors: number } {
  let deleted = 0;
  let errors = 0;
  const now = Date.now();

  try {
    const files = readdirSync(TEMP_DIR);
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = statSync(filePath);
        if (now - stats.mtime.getTime() > maxAgeMs) {
          unlinkSync(filePath);
          deleted++;
        }
      } catch (err) {
        errors++;
        console.error("[tempCleanup] Failed to clean up file:", filePath, err);
      }
    }
  } catch (err) {
    console.error("[tempCleanup] Failed to read temp directory:", TEMP_DIR, err);
  }

  if (deleted > 0) {
    console.log(`[tempCleanup] Deleted ${deleted} old temp receipt(s)`);
  }

  return { deleted, errors };
}

export function startTempCleanupScheduler(): () => void {
  cleanupOldTempReceipts();

  const intervalId = setInterval(() => {
    cleanupOldTempReceipts();
  }, CLEANUP_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
