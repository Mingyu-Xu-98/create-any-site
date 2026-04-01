/**
 * PDF Parser — shared MinerU integration + fallback.
 * Used by both:
 *   - /api/kb/[baseId]/files  (KB uploads → wants raw markdown)
 *   - /api/analyze-source     (legacy uploads → feeds to AI extraction)
 */
import { logger } from "@/lib/logger";

const MINERU_BASE = "https://mineru.net/api/v4";

/**
 * Parse PDF via MinerU API → returns markdown text.
 * Falls back to basic text extraction if MinerU is unavailable or fails.
 *
 * @param buffer - PDF file buffer
 * @param filename - original filename (for logging)
 * @param opts.saveImage - optional callback to save extracted images
 */
export async function parsePdfWithMinerU(
  buffer: ArrayBuffer,
  filename: string,
  opts?: {
    saveImage?: (fileName: string, imgBuffer: Buffer, source: string) => Promise<string>;
  },
): Promise<string> {
  const apiKey = process.env.MINERU_API_KEY;
  if (!apiKey) {
    logger.warn("mineru", "MINERU_API_KEY not set, falling back to basic extraction");
    return basicPdfExtract(buffer);
  }

  logger.info("mineru", `Starting PDF parse for: ${filename}`, { size: buffer.byteLength });

  // Step 1: Request upload URL
  logger.info("mineru", "Requesting upload URL...");
  const batchRes = await fetch(`${MINERU_BASE}/file-urls/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      enable_formula: true,
      enable_table: true,
      language: "ch",
      files: [{ name: filename, is_ocr: true }],
    }),
  });

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    logger.error("mineru", `Failed to get upload URL: ${batchRes.status}`, { response: errText });
    throw new Error(`MinerU upload URL failed: ${batchRes.status}`);
  }

  const batchData = await batchRes.json();
  logger.info("mineru", "Upload URL response", { code: batchData.code, msg: batchData.msg });

  if (batchData.code !== 0) {
    logger.error("mineru", `MinerU API error: ${batchData.msg}`, { code: batchData.code });
    throw new Error(`MinerU error: ${batchData.msg}`);
  }

  const batchId = batchData.data?.batch_id;
  const uploadUrl = batchData.data?.file_urls?.[0];

  if (!uploadUrl || !batchId) {
    logger.error("mineru", "No upload URL or batch_id returned", { data: batchData.data });
    throw new Error("MinerU: no upload URL returned");
  }

  logger.info("mineru", `Got upload URL, batch_id: ${batchId}`);

  // Step 2: Upload file via PUT
  logger.info("mineru", `Uploading file (${(buffer.byteLength / 1024).toFixed(1)}KB)...`);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    logger.error("mineru", `File upload failed: ${uploadRes.status}`, { response: errText.slice(0, 500) });
    throw new Error(`MinerU upload failed: ${uploadRes.status}`);
  }

  logger.info("mineru", "File uploaded successfully");

  // Step 3: Poll for results
  logger.info("mineru", `Polling batch results: ${batchId}`);
  const maxWait = 300_000; // 5 min
  const pollInterval = 5_000;
  const startTime = Date.now();
  let resultUrl: string | null = null;

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(`${MINERU_BASE}/extract-results/batch/${batchId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) {
      logger.warn("mineru", `Poll request failed: ${pollRes.status}`);
      continue;
    }

    const pollData = await pollRes.json();
    const results = pollData.data?.extract_result || [];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (results.length > 0) {
      const r = results[0];
      logger.info("mineru", `Poll state: ${r.state}, elapsed: ${elapsed}s`, {
        pages: r.extract_progress?.extracted_pages,
        total: r.extract_progress?.total_pages,
      });

      if (r.state === "done" && r.full_zip_url) {
        resultUrl = r.full_zip_url;
        logger.info("mineru", `Parse complete! Elapsed: ${elapsed}s`, { url: resultUrl });
        break;
      } else if (r.state === "failed") {
        logger.error("mineru", `Parse failed: ${r.err_msg}`, { elapsed });
        throw new Error(`MinerU parse failed: ${r.err_msg}`);
      }
    }
  }

  if (!resultUrl) {
    logger.error("mineru", "Timeout waiting for parse result", { maxWait });
    throw new Error("MinerU: timeout waiting for result");
  }

  // Step 4: Download and extract result ZIP
  logger.info("mineru", "Downloading result ZIP...");
  const zipRes = await fetch(resultUrl);
  if (!zipRes.ok) {
    logger.error("mineru", `Result download failed: ${zipRes.status}`);
    throw new Error(`MinerU result download failed: ${zipRes.status}`);
  }

  const zipBuffer = await zipRes.arrayBuffer();
  logger.info("mineru", `Result ZIP downloaded: ${(zipBuffer.byteLength / 1024).toFixed(1)}KB`);

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(zipBuffer);
  const markdownFiles: string[] = [];
  const extractedImages: string[] = [];

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const fileName = filePath.split("/").pop() || filePath;

    // Extract text files (markdown from MinerU)
    if (ext === "md" || ext === "txt" || ext === "json") {
      try {
        const content = await entry.async("string");
        if (content.length > 0) {
          markdownFiles.push(content);
          logger.info("mineru", `Extracted text: ${filePath} (${content.length} chars)`);
        }
      } catch { /* skip */ }
    }

    // Extract images (optional — caller provides saveImage callback)
    const isImg = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(fileName);
    if (isImg && opts?.saveImage) {
      try {
        const imgBuffer = await entry.async("nodebuffer");
        if (imgBuffer.byteLength > 500) {
          const savedName = await opts.saveImage(fileName, imgBuffer, `mineru:${filename}`);
          extractedImages.push(savedName);
          logger.info("mineru", `Saved image: ${fileName} → ${savedName} (${(imgBuffer.byteLength / 1024).toFixed(1)}KB)`);
        }
      } catch { /* skip broken images */ }
    }
  }

  if (extractedImages.length > 0) {
    logger.info("mineru", `Extracted ${extractedImages.length} images from PDF`);
  }

  const result = markdownFiles.join("\n\n");
  logger.info("mineru", `PDF parse complete. Total content: ${result.length} chars from ${markdownFiles.length} files, ${extractedImages.length} images`);
  return result;
}

/**
 * Basic PDF text extraction fallback — no external API needed.
 * Tries to extract text operators from raw PDF binary.
 * Quality is poor for scanned PDFs or complex layouts.
 */
export function basicPdfExtract(buffer: ArrayBuffer): string {
  logger.info("pdf-basic", "Using basic PDF text extraction");
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  const segments: string[] = [];
  const matches = text.match(/\(([^)]+)\)/g);
  if (matches) {
    for (const m of matches) {
      const inner = m.slice(1, -1);
      if (inner.length > 2 && /[\w\u4e00-\u9fff]/.test(inner)) {
        segments.push(inner);
      }
    }
  }

  const result = segments.length > 0 ? segments.join(" ") : "[PDF - limited text extraction]";
  logger.info("pdf-basic", `Extracted ${segments.length} segments, ${result.length} chars`);
  return result;
}

/**
 * Safe wrapper: MinerU first, basic fallback on error.
 */
export async function parsePdfSafe(
  buffer: ArrayBuffer,
  name: string,
  opts?: {
    saveImage?: (fileName: string, imgBuffer: Buffer, source: string) => Promise<string>;
  },
): Promise<string> {
  try {
    return await parsePdfWithMinerU(buffer, name, opts);
  } catch (err) {
    logger.warn("pdf", `MinerU failed for ${name}: ${err instanceof Error ? err.message : "unknown"}, falling back to basic extraction`);
    return basicPdfExtract(buffer);
  }
}
