import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteBuilds } from "@/lib/db/schema";
import { scheduleBuildJob, shouldInlineBuildJobs } from "@/lib/build-queue";
import { ensureStaticServer } from "@/lib/build-runtime";

export async function GET(_req: NextRequest, context: { params: Promise<unknown> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params as { id: string };
  const job = await db.select().from(siteBuilds)
    .where(and(eq(siteBuilds.id, id), eq(siteBuilds.userId, session.user.id)))
    .get();

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (shouldInlineBuildJobs() && (job.status === "queued" || job.status === "building")) {
    scheduleBuildJob(job.id);
  }

  // Ensure preview server is running when a build completes
  if (job.status === "ready") {
    void ensureStaticServer();
  }

  return NextResponse.json({
    job: {
      id: job.id,
      siteId: job.siteId,
      status: job.status,
      previewUrl: job.previewUrl,
      error: job.error,
      logs: job.logs ? JSON.parse(job.logs) : [],
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  });
}
