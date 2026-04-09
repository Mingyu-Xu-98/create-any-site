import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { runBackupNow } from "@/lib/db-backup";
import { internalError } from "@/lib/api-errors";

/** POST /api/admin/backup — trigger an immediate DB backup */
export async function POST() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const backupPath = await runBackupNow();
    return NextResponse.json({ ok: true, path: backupPath });
  } catch (err) {
    return internalError(err, "admin-backup");
  }
}
