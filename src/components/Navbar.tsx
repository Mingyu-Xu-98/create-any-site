"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale, LocaleSwitcher } from "@/components/LocaleProvider";

export default function Navbar() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    ...(session?.user ? [
      { href: "/create", label: t("nav.create") },
    ] : []),
    { href: "/templates", label: t("nav.templates") },
    ...(session?.user ? [
      { href: "/knowledge", label: t("nav.knowledge") },
      { href: "/dashboard", label: t("nav.dashboard") },
    ] : []),
  ];

  const linkClass = (href: string) =>
    `relative text-sm transition-colors ${
      pathname === href ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            CreateAnySite
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
              <span className={`absolute left-0 -bottom-1 h-0.5 rounded-full bg-accent transition-all ${pathname === item.href ? "w-full" : "w-0"}`} />
            </Link>
          ))}
          {session?.user ? (
            <>
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

        <div className="flex md:hidden items-center gap-2">
          <LocaleSwitcher className="!bg-gray-100 !text-gray-600 hover:!bg-gray-200" />
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-black/5 bg-white/95 backdrop-blur-xl px-6 py-4 space-y-3 shadow-lg">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`block text-sm ${pathname === item.href ? "text-accent font-medium" : "text-gray-600"}`}>
              {item.label}
            </Link>
          ))}
          {session?.user ? (
            <button onClick={() => signOut()} className="block text-sm text-gray-500">
              {t("nav.logout")}
            </button>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)} className="inline-flex px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">
              {t("nav.login")}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
