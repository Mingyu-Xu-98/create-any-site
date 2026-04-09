import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listFlags, setFlag, deleteFlag } from "@/lib/flags";
import { internalError } from "@/lib/api-errors";

/** GET /api/admin/flags — list all feature flags */
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ flags: listFlags() });
  } catch (err) {
    return internalError(err, "admin-flags-list");
  }
}

/** POST /api/admin/flags — create or update a flag */
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { key, enabled, description, allowList } = await req.json() as {
      key?: string;
      enabled?: boolean;
      description?: string;
      allowList?: string[];
    };

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    setFlag(key, enabled ?? false, { description, allowList });
    return NextResponse.json({ ok: true, flag: { key, enabled: enabled ?? false } });
  } catch (err) {
    return internalError(err, "admin-flags-set");
  }
}

/** DELETE /api/admin/flags — delete a flag */
export async function DELETE(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { key } = await req.json() as { key?: string };
    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    deleteFlag(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, "admin-flags-delete");
  }
}
