import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if the current session user is an admin.
 * Returns the user id if admin, null otherwise.
 */
export async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).get();
  if (!user || user.role !== "admin") return null;

  return session.user.id;
}
