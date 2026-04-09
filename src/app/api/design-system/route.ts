import { NextRequest, NextResponse } from "next/server";
import { generateDesignSystem } from "@/lib/design-intelligence";
import { requireAuth, unauthorized } from "@/lib/require-auth";
import { internalError } from "@/lib/api-errors";

export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  try {
    const { query } = (await req.json()) as { query: string };

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Please provide a description of your website" },
        { status: 400 },
      );
    }

    const designSystem = await generateDesignSystem(query.trim());
    return NextResponse.json(designSystem);
  } catch (err) {
    return internalError(err, "design-system");
  }
}
