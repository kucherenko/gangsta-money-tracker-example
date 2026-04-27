import { spawn } from "node:child_process";
import path from "node:path";
import { renameSync } from "node:fs";

export async function renderPdfFirstPage(
  pdfPath: string,
  outputPngPath: string
): Promise<void> {
  const outputDir = path.dirname(outputPngPath);
  const outputBase = path.basename(outputPngPath, ".png");
  const outputPattern = path.join(outputDir, `${outputBase}-%d.png`);

  return new Promise((resolve, reject) => {
    const gs = spawn("gs", [
      "-dNOPAUSE",
      "-dBATCH",
      "-dSAFER",
      "-sDEVICE=png16m",
      "-r200",
      "-dFirstPage=1",
      "-dLastPage=1",
      `-sOutputFile=${outputPattern}`,
      pdfPath,
    ]);

    let stderr = "";
    gs.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    gs.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Ghostscript failed (code ${code}): ${stderr}`));
        return;
      }
      // Ghostscript produces name-1.png; rename to outputPngPath
      try {
        renameSync(path.join(outputDir, `${outputBase}-1.png`), outputPngPath);
        resolve();
      } catch (err: any) {
        reject(new Error(`Failed to rename rendered PDF page: ${err.message}`));
      }
    });

    gs.on("error", (err) => {
      reject(new Error(`Ghostscript spawn error: ${err.message}`));
    });
  });
}
