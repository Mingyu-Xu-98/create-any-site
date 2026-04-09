import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAuth, unauthorized } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { internalError } from "@/lib/api-errors";
import { siteRoot, siteCurrentLink } from "@/lib/site-paths";

const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/images/generations";
const API_KEY = process.env.SILICONFLOW_API_KEY || "";
const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
const DRAFTS_SEGMENT = "drafts";

// siteId format: accept alnum + dash + underscore, 8–64 chars. Rejects
// anything that could be a path segment (`..`, `/`, `\`, null bytes).
// This is a belt-and-braces check on top of the ownership lookup below —
// even if an attacker somehow gets past the DB check, the regex blocks
// every path traversal primitive at the door.
const SITE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

// Raster-only whitelist. SVG is excluded on purpose — it can carry inline
// <script> and would be served straight from public/ with no sanitization.
const ALLOWED_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const DEFAULT_IMAGE_MODELS = "black-forest-labs/FLUX.1-schnell,Kwai-Kolors/Kolors";
const IMAGE_MODELS = (process.env.SILICONFLOW_IMAGE_MODELS?.trim() || process.env.SILICONFLOW_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODELS)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

/**
 * Generate an image via SiliconFlow (FLUX.1-schnell) and save to either:
 * - sites-data/<siteId>/public/images/
 * - public/images/ (fallback for local app assets)
 * Body: { prompt: string; filename: string; style: string; siteId?: string }
 */
export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  try {
    const { prompt, filename, siteId } = (await req.json()) as {
      prompt: string;
      filename: string;
      style: string;
      siteId?: string;
    };

    if (!API_KEY) {
      return NextResponse.json(
        { error: "SILICONFLOW_API_KEY not configured" },
        { status: 500 },
      );
    }

    if (IMAGE_MODELS.length === 0) {
      return NextResponse.json(
        { error: "Image generation is not enabled. Set SILICONFLOW_IMAGE_MODEL or SILICONFLOW_IMAGE_MODELS to an available model." },
        { status: 400 },
      );
    }

    // ─── Input validation ──────────────────────────────────────────────
    if (typeof filename !== "string" || !filename.trim()) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    // Normalize filename: strip any directory components, then enforce a
    // raster-image extension. basename alone is not enough — we also need
    // to reject `shell.png\0.svg` style tricks and anything without one
    // of our whitelisted extensions.
    const safeFilename = path.basename(filename).replace(/\0/g, "");
    const ext = path.extname(safeFilename).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported image extension. Allowed: ${[...ALLOWED_IMAGE_EXTS].join(", ")}` },
        { status: 400 },
      );
    }

    // ─── siteId handling ───────────────────────────────────────────────
    // Two branches:
    //   (a) siteId provided — must pass regex AND belong to the current
    //       user. Writes into sites-data/<siteId>/...
    //   (b) siteId missing  — writes to the app's own public/images/,
    //       which is a shared app-level asset dir. Only admins may do
    //       this; normal users can never write outside their own site.
    if (siteId !== undefined && siteId !== null && siteId !== "") {
      if (typeof siteId !== "string" || !SITE_ID_RE.test(siteId)) {
        return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
      }
      const site = await db
        .select({ userId: sites.userId })
        .from(sites)
        .where(eq(sites.id, siteId))
        .get();
      if (!site) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
      if (site.userId !== userId) {
        // Don't leak existence — same 404 as above.
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
    } else {
      const adminId = await requireAdmin();
      if (!adminId) {
        return NextResponse.json(
          { error: "siteId is required for non-admin users" },
          { status: 403 },
        );
      }
    }

    // Determine image size per model
    // Kolors only supports: 1024x1024, 960x1280, 768x1024, 720x1440, 720x1280
    // Qwen-Image: use 1024x1024 as safe default
    // FLUX and other models support arbitrary sizes including 1024x576
    const isSquare = filename === "avatar.png" || filename === "chatbot-spirit.png";

    function getImageSize(model: string): string {
      if (isSquare) return "1024x1024";
      const m = model.toLowerCase();
      if (m.includes("kolors")) return "768x1024";
      if (m.includes("qwen")) return "1024x1024";
      return "1024x576";
    }

    let imageResponse: Response | null = null;
    let lastError = "";
    for (const model of IMAGE_MODELS) {
      const imageSize = getImageSize(model);
      console.log(`[generate-image] trying model=${model}, size=${imageSize}`);
      const response = await fetch(SILICONFLOW_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          image_size: imageSize,
          num_inference_steps: 20,
        }),
      });

      if (response.ok) {
        imageResponse = response;
        break;
      }

      const errText = await response.text();
      lastError = `${model}: ${response.status} ${errText.slice(0, 300)}`;
      console.error("SiliconFlow image error:", lastError);
    }

    if (!imageResponse) {
      return NextResponse.json(
        { error: `Image generation failed for all configured models. ${lastError}` },
        { status: 500 },
      );
    }

    const result = await imageResponse.json();
    const imageUrl = result.images?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL in response" },
        { status: 500 },
      );
    }

    // Download the generated image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: "Failed to download generated image" },
        { status: 500 },
      );
    }

    console.log("[generate-image] request", { filename: safeFilename, siteId: siteId || null });
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const targetDirs = new Set<string>();

    if (siteId) {
      targetDirs.add(path.join(siteRoot(siteId), "public", "images"));
      targetDirs.add(path.join(siteCurrentLink(siteId), "out", "images"));
      if (PREVIEW_PUBLISH_DIR) {
        targetDirs.add(path.join(PREVIEW_PUBLISH_DIR, DRAFTS_SEGMENT, siteId, "images"));
      }
    } else {
      targetDirs.add(path.join(process.cwd(), "public", "images"));
    }

    for (const imagesDir of targetDirs) {
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.writeFile(path.join(imagesDir, safeFilename), buffer);
    }

    return NextResponse.json({
      success: true,
      path: `/images/${safeFilename}`,
      size: buffer.length,
      filename: safeFilename,
      siteId: siteId || null,
    });
  } catch (err) {
    return internalError(err, "generate-image");
  }
}
