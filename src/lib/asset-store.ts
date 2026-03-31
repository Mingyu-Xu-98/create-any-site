/**
 * Asset Store — manages user-uploaded images and files.
 * Images extracted from PDFs/ZIPs are stored per-user and can be
 * copied into generated site's public/images/ during build.
 */
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const ASSETS_ROOT = path.join(process.cwd(), "data", "user-assets");
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tiff"]);

/** Get the asset directory for a user */
function userDir(userId: string): string {
  return path.join(ASSETS_ROOT, userId);
}

/** Ensure user's asset directory exists */
async function ensureUserDir(userId: string): Promise<string> {
  const dir = userDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Check if a filename is an image */
export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.has(ext);
}

/** Save an image buffer to user's asset store. Returns the relative path. */
export async function saveUserImage(
  userId: string,
  originalName: string,
  buffer: Buffer | Uint8Array,
  sourceLabel?: string,
): Promise<string> {
  const dir = await ensureUserDir(userId);
  const ext = originalName.split(".").pop()?.toLowerCase() || "png";
  // Use content hash to deduplicate
  const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
  const safeName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80);
  const filename = `${hash}_${safeName}`;
  const filePath = path.join(dir, filename);

  try {
    await fs.access(filePath);
    // Already exists (dedup by hash)
  } catch {
    await fs.writeFile(filePath, buffer);
  }

  return filename;
}

/** List all images for a user */
export async function listUserImages(userId: string): Promise<Array<{ filename: string; path: string; size: number }>> {
  const dir = userDir(userId);
  try {
    const files = await fs.readdir(dir);
    const results: Array<{ filename: string; path: string; size: number }> = [];
    for (const file of files) {
      if (!isImageFile(file)) continue;
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      results.push({ filename: file, path: filePath, size: stat.size });
    }
    return results;
  } catch {
    return [];
  }
}

/** Copy all user images into a site's public/images/ directory */
export async function copyUserImagesToSite(userId: string, siteDir: string): Promise<number> {
  const images = await listUserImages(userId);
  if (images.length === 0) return 0;

  const targetDir = path.join(siteDir, "public", "images");
  await fs.mkdir(targetDir, { recursive: true });

  let count = 0;
  for (const img of images) {
    const target = path.join(targetDir, img.filename);
    try {
      await fs.copyFile(img.path, target);
      count++;
    } catch { /* skip broken files */ }
  }

  return count;
}

/** Get the public URL path for a user image (used in generated sites) */
export function getImagePublicPath(filename: string): string {
  return `/images/${filename}`;
}

/** Delete all assets for a user */
export async function deleteUserAssets(userId: string): Promise<void> {
  try {
    await fs.rm(userDir(userId), { recursive: true, force: true });
  } catch { /* ignore */ }
}
