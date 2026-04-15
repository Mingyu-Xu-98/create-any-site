/**
 * PDF Parser — self-hosted API integration + fallback.
 * Used by both:
 *   - /api/kb/[baseId]/files  (KB uploads → wants raw markdown)
 *   - /api/analyze-source     (legacy uploads → feeds to AI extraction)
 *
 * API protocol (V1 async):
 *   POST {PDF_PARSE_URL}?params=...&async=true  body=<pdf bytes> → { data: { id } }
 *   GET  {PDF_PARSE_URL}?task_id=xxx            → ZIP (done) or JSON (polling/error)
 */
import { logger } from "@/lib/logger";

const PDF_PARSE_URL = process.env.PDF_PARSE_URL?.trim() || "http://192.168.41.107:7004";

/**
 * Parse PDF via self-hosted parse API → returns markdown text.
 * Falls back to basic text extraction if the API is unavailable or fails.
 *
 * @param buffer - PDF file buffer
 * @param filename - original filename (for logging)
 * @param opts.saveImage - optional callback to save extracted images
 */
export async function parsePdfWithApi(
  buffer: ArrayBuffer,
  filename: string,
  opts?: {
    saveImage?: (fileName: string, imgBuffer: Buffer, source: string) => Promise<string>;
  },
): Promise<string> {
  logger.info("pdf-parse", `Starting PDF parse for: ${filename}`, { size: buffer.byteLength });

  // Build parse params — include images extraction when saveImage callback is provided
  const outputFiles: string[] = ["doc.md"];
  if (opts?.saveImage) {
    outputFiles.push("images");
  }
  const parseParams = JSON.stringify({
    use_llm: true,
    output_files: outputFiles,
  });

  // Step 1: Submit async task
  logger.info("pdf-parse", `Submitting async task to ${PDF_PARSE_URL}`);
  const submitUrl = new URL(PDF_PARSE_URL);
  submitUrl.searchParams.set("params", parseParams);
  submitUrl.searchParams.set("async", "true");

  const submitRes = await fetch(submitUrl.toString(), {
    method: "POST",
    body: buffer,
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => "");
    logger.error("pdf-parse", `Submit failed: ${submitRes.status}`, { response: errText.slice(0, 500) });
    throw new Error(`PDF parse submit failed: ${submitRes.status}`);
  }

  const submitData = await submitRes.json();
  const taskId = submitData?.data?.id;

  if (!taskId) {
    logger.error("pdf-parse", "Response missing task_id", { data: submitData });
    throw new Error("PDF parse: no task_id returned");
  }

  logger.info("pdf-parse", `Task submitted, task_id=${taskId}`);

  // Step 2: Poll for results
  const maxWait = 300_000; // 5 min
  const pollInterval = 3_000; // 3s (matching Python implementation)
  const startTime = Date.now();
  let zipBuffer: ArrayBuffer | null = null;

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    let pollRes: Response;
    try {
      const pollUrl = new URL(PDF_PARSE_URL);
      pollUrl.searchParams.set("task_id", taskId);
      pollRes = await fetch(pollUrl.toString());
    } catch (err) {
      logger.warn("pdf-parse", `Poll request failed: ${err instanceof Error ? err.message : "unknown"}, retrying...`);
      continue;
    }

    if (!pollRes.ok) {
      logger.warn("pdf-parse", `Poll returned ${pollRes.status}, retrying...`);
      continue;
    }

    // Non-JSON response (ZIP file) → task complete
    const contentType = pollRes.headers.get("content-type") || "";
    if (!contentType.startsWith("application/json")) {
      zipBuffer = await pollRes.arrayBuffer();
      logger.info("pdf-parse", `Task complete! Elapsed: ${elapsed}s, ZIP size: ${(zipBuffer.byteLength / 1024).toFixed(1)}KB`);
      break;
    }

    // JSON response → check status
    try {
      const statusData = await pollRes.json();
      const status = statusData?.status;

      if (status === "failed" || status === "error") {
        const errMsg = statusData?.error || statusData?.message || "unknown error";
        logger.error("pdf-parse", `Task failed: ${errMsg}`, { elapsed });
        throw new Error(`PDF parse failed: ${errMsg}`);
      }

      logger.info("pdf-parse", `Polling... status=${status || "unknown"}, elapsed=${elapsed}s`);
    } catch (err) {
      // JSON parse error — might be the ZIP starting to arrive, treat as not-ready
      if (err instanceof SyntaxError) {
        logger.warn("pdf-parse", `Poll response not valid JSON, retrying...`);
        continue;
      }
      throw err; // Re-throw actual task failures
    }
  }

  if (!zipBuffer) {
    logger.error("pdf-parse", "Timeout waiting for parse result", { maxWait });
    throw new Error("PDF parse: timeout waiting for result");
  }

  // Step 3: Extract doc.md + images from ZIP
  logger.info("pdf-parse", "Extracting content from result ZIP...");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(zipBuffer);
  const markdownFiles: string[] = [];
  const extractedImages: string[] = [];

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const fileName = filePath.split("/").pop() || filePath;

    // Extract text files (markdown output)
    if (ext === "md" || ext === "txt" || ext === "json") {
      try {
        const content = await entry.async("string");
        if (content.length > 0) {
          markdownFiles.push(content);
          logger.info("pdf-parse", `Extracted text: ${filePath} (${content.length} chars)`);
        }
      } catch { /* skip */ }
    }

    // Extract images (optional — caller provides saveImage callback)
    const isImg = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(fileName);
    if (isImg && opts?.saveImage) {
      try {
        const imgBuffer = await entry.async("nodebuffer");
        if (imgBuffer.byteLength > 500) {
          const savedName = await opts.saveImage(fileName, imgBuffer, `pdf-parse:${filename}`);
          extractedImages.push(savedName);
          logger.info("pdf-parse", `Saved image: ${fileName} → ${savedName} (${(imgBuffer.byteLength / 1024).toFixed(1)}KB)`);
        }
      } catch { /* skip broken images */ }
    }
  }

  if (extractedImages.length > 0) {
    logger.info("pdf-parse", `Extracted ${extractedImages.length} images from PDF`);
  }

  const result = markdownFiles.join("\n\n");
  logger.info("pdf-parse", `PDF parse complete. Total content: ${result.length} chars from ${markdownFiles.length} files, ${extractedImages.length} images`);
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
 * Safe wrapper: self-hosted API first, basic fallback on error.
 */
export async function parsePdfSafe(
  buffer: ArrayBuffer,
  name: string,
  opts?: {
    saveImage?: (fileName: string, imgBuffer: Buffer, source: string) => Promise<string>;
  },
): Promise<string> {
  try {
    return await parsePdfWithApi(buffer, name, opts);
  } catch (err) {
    logger.warn("pdf", `PDF parse API failed for ${name}: ${err instanceof Error ? err.message : "unknown"}, falling back to basic extraction`);
    return basicPdfExtract(buffer);
  }
}

// Backward compatibility aliases
export { parsePdfWithApi as parsePdfWithMinerU };
