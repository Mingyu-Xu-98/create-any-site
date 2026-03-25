"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useLocale, LocaleSwitcher } from "@/components/LocaleProvider";

export default function Navbar() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            CreateAnySite
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <Link href="/templates" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            {t("nav.templates")}
          </Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                {t("nav.dashboard")}
              </Link>
              {role === "admin" && (
                <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  {t("nav.admin")}
                </Link>
              )}
              <LocaleSwitcher className="!bg-gray-100 !text-gray-500 hover:!bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs text-white font-medium">
                  {session.user.name?.[0] || session.user.email?.[0] || "U"}
                </div>
                <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  {t("nav.logout")}
                </button>
              </div>
            </>
          ) : (
            <>
              <LocaleSwitcher className="!bg-gray-100 !text-gray-500 hover:!bg-gray-200" />
              <Link href="/login" className="text-sm px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors">
                {t("nav.login")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
