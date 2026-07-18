"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";

const STORAGE_KEY = "lang";

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nState | null>(null);

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "ko";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "ko" || saved === "en") return saved;
  // 브라우저 언어 감지: 한국어면 ko, 그 외에는 영어
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("ko") ? "ko" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR/최초 렌더는 ko로 시작하고, 마운트 후 실제 언어로 보정한다.
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const initial = detectInitialLang();
    setLangState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.ko[key] ?? key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n은 I18nProvider 안에서만 사용 가능합니다");
  return ctx;
}
