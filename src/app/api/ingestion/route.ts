import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestionTasks } from "@/lib/db/schema";
import { eq, or, gte } from "drizzle-orm";
import { runIngestionTask } from "@/lib/ingestion-worker";

/**
 * POST /api/ingestion — Submit a file for background processing.
 * Returns immediately with a taskId. Client polls GET /api/ingestion/[taskId] for status.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  let fileName: string;
  let fileType: string;
  let fileBuffer: ArrayBuffer | null = null;
  let url: string | null = null;
  let urlType: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const typeMap: Record<string, string> = { pdf: "pdf", docx: "docx", doc: "docx", txt: "txt", md: "md", zip: "zip", png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image" };
    fileType = typeMap[ext] || "txt";
    fileBuffer = await file.arrayBuffer();
  } else {
    const body = await req.json();
    if (!body.url || !body.type) return NextResponse.json({ error: "URL and type required" }, { status: 400 });
    fileName = body.url;
    fileType = body.type;
    url = body.url;
    urlType = body.type;
  }

  // Create task record
  const taskId = crypto.randomUUID();
  await db.insert(ingestionTasks).values({
    id: taskId,
    userId: session.user.id,
    fileName,
    fileType,
    status: "queued",
    progress: "排队中...",
  });

  // Run in background (non-blocking)
  runIngestionTask(taskId, session.user.id, {
    fileName,
    fileType,
    fileBuffer: fileBuffer ? Buffer.from(fileBuffer) : null,
    url,
    urlType,
  }).catch(() => {});

  return NextResponse.json({ taskId, status: "queued" });
}

/**
 * GET /api/ingestion — List active + recent tasks for the current user.
 * Returns: all queued/processing tasks + done/error tasks from the last hour.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const tasks = await db
    .select()
    .from(ingestionTasks)
    .where(eq(ingestionTasks.userId, session.user.id))
    .orderBy(ingestionTasks.createdAt);

  // Return active tasks + recently completed ones (not full history)
  const filtered = tasks.filter(t =>
    t.status === "queued" || t.status === "processing" ||
    (t.updatedAt && t.updatedAt >= oneHourAgo)
  );

  return NextResponse.json({ tasks: filtered });
}
