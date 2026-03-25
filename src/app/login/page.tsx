"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLocale();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) setError(t("login.error")); else if (res?.ok) router.push("/dashboard");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gray-50">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{t("login.title")}<span className="text-accent">CreateAnySite</span></h1>
            <p className="text-sm text-gray-500 mt-2">{t("login.subtitle")}</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">{error}</div>}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("login.email")}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("login.password")}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder="••••••" />
            </div>
            <button type="submit" disabled={loading} className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20">
              {loading ? t("login.loading") : t("login.submit")}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-6">
            {t("login.noAccount")} <Link href="/register" className="text-accent hover:text-accent/80">{t("login.register")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
