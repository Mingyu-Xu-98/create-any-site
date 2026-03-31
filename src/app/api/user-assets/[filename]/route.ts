import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

const ASSETS_ROOT = path.join(process.cwd(), "data", "user-assets");

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const filePath = path.join(ASSETS_ROOT, session.user.id, filename);

  // Prevent path traversal
  if (!filePath.startsWith(path.join(ASSETS_ROOT, session.user.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
