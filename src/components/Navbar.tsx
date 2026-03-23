"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            CreateAnySite
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/templates" className="text-sm text-white/60 hover:text-white transition-colors">
            Templates
          </Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors">
                Dashboard
              </Link>
              {role === "admin" && (
                <Link href="/admin" className="text-sm text-white/60 hover:text-white transition-colors">
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                    {session.user.name?.[0] || session.user.email?.[0] || "U"}
                  </div>
                )}
                <button
                  onClick={() => signOut()}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
