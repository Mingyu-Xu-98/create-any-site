import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAuth, unauthorized } from "@/lib/require-auth";

const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/images/generations";
const API_KEY = process.env.SILICONFLOW_API_KEY || "";
const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
const DRAFTS_SEGMENT = "drafts";
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

    const safeFilename = path.basename(filename);
    console.log("[generate-image] request", { filename: safeFilename, siteId: siteId || null });
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const targetDirs = new Set<string>();

    if (siteId) {
      targetDirs.add(path.join(process.cwd(), "sites-data", siteId, "public", "images"));
      targetDirs.add(path.join(process.cwd(), "sites-data", siteId, "out", "images"));
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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Image generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
