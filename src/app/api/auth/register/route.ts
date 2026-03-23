import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(users).values({
    id,
    name: name || email.split("@")[0],
    email,
    password: hashedPassword,
    role: "user",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true, id });
}
