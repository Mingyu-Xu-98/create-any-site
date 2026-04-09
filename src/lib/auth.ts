import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";

// Login brute-force limits. Two keys layered:
//   login:ip:<ip>         — caps credential spray from a single host
//   login:email:<email>   — caps targeted attacks on one account
// First hit wins. Both counters are checked BEFORE bcrypt.compare so an
// attacker cannot exhaust CPU by sending hundreds of wrong passwords.
// Env-overridable for ops tuning.
const LOGIN_RL_IP_PER_MIN = Number(process.env.LOGIN_RL_IP_PER_MIN || 10);
const LOGIN_RL_EMAIL_PER_MIN = Number(process.env.LOGIN_RL_EMAIL_PER_MIN || 5);
const LOGIN_RL_IP_PER_HOUR = Number(process.env.LOGIN_RL_IP_PER_HOUR || 60);

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0].trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    // headers() throws outside a request scope (e.g. during build). In
    // that case there is no login attempt to rate-limit, so "unknown"
    // is safe.
    return "unknown";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // ─── Rate limit BEFORE bcrypt ──────────────────────────────────
        // Order matters: we want to reject spray attacks without doing
        // the expensive bcrypt.compare. Three counters, first hit rejects:
        //   1. per-IP per minute
        //   2. per-IP per hour  (slow-burn catch)
        //   3. per-email per minute
        // Rejected attempts still increment the counter (no free pass).
        // We return null rather than throwing so NextAuth surfaces a
        // generic "invalid credentials" error — never reveal rate-limit
        // state to the client, that's an enumeration oracle.
        const ip = await getClientIp();
        const rlChecks = [
          { key: `login:ip-min:${ip}`, limit: LOGIN_RL_IP_PER_MIN, windowMs: 60_000, layer: "ip-per-minute" },
          { key: `login:ip-hour:${ip}`, limit: LOGIN_RL_IP_PER_HOUR, windowMs: 3_600_000, layer: "ip-per-hour" },
          { key: `login:email:${email}`, limit: LOGIN_RL_EMAIL_PER_MIN, windowMs: 60_000, layer: "email-per-minute" },
        ];
        for (const check of rlChecks) {
          const result = checkRateLimit(check.key, check.limit, check.windowMs);
          if (!result.ok) {
            console.warn(
              `[auth] login rate-limited layer=${check.layer} ip=${ip} email=${email.slice(0, 3)}*** retryAfter=${result.retryAfterSec}s`,
            );
            return null;
          }
        }

        const user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) || "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
