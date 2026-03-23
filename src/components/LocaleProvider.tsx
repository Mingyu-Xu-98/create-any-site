"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Locale } from "@/lib/i18n";
import { t as translate } from "@/lib/i18n";

interface LocaleContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("locale") as Locale) || "zh";
    }
    return "zh";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", l);
    }
  }, []);

  const t = useCallback((key: string) => translate(key, locale), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <button
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      className={`px-2 py-1 rounded text-[10px] font-medium transition-all bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 ${className || ""}`}
    >
      {locale === "zh" ? "EN" : "中文"}
    </button>
  );
}
