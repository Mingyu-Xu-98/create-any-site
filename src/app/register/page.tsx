"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export default function RegisterPage() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const router = useRouter(); const { t, locale } = useLocale();
  const passwordStrength = password.length >= 10 ? 3 : password.length >= 8 ? 2 : password.length >= 6 ? 1 : 0;
  const passwordLabel = passwordStrength === 3 ? "Strong" : passwordStrength === 2 ? "Medium" : passwordStrength === 1 ? "Basic" : "Too Short";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password !== confirmPassword) { setError(t("register.mismatch")); return; }
    if (password.length < 6) { setError(t("register.tooShort")); return; }
    setLoading(true);
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed"); setLoading(false); return; }
    const loginRes = await signIn("credentials", { email, password, redirect: false });
    if (loginRes?.ok) router.push("/dashboard"); else { setError("Registration succeeded but login failed."); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gray-50">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{t("register.title")}<span className="text-accent">{t("register.titleHighlight")}</span></h1>
            <p className="text-sm text-gray-500 mt-2">{t("register.subtitle")}</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">{error}</div>}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.name")}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.namePlaceholder")} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("login.email")}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.password")}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.passwordPlaceholder")} />
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((level) => (
                    <div key={level} className={`h-1.5 flex-1 rounded-full ${passwordStrength >= level ? (level === 1 ? "bg-amber-400" : level === 2 ? "bg-sky-500" : "bg-emerald-500") : "bg-gray-200"}`} />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{locale === "zh" ? `密码强度：${passwordLabel === "Strong" ? "强" : passwordLabel === "Medium" ? "中" : passwordLabel === "Basic" ? "基础" : "过短"}` : `Password strength: ${passwordLabel}`}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.confirmPassword")}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.confirmPlaceholder")} />
            </div>
            <button type="submit" disabled={loading} className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20">
              <span className="inline-flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? t("register.loading") : t("register.submit")}
              </span>
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-6">
            {t("register.hasAccount")} <Link href="/login" className="text-accent hover:text-accent/80">{t("register.login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
