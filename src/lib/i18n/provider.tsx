"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { type Lang, LANG_COOKIE, setCurrentLang, translate, translatePlural } from "./core";

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tp: (n: number, one: string, other: string, vars?: Record<string, string | number>) => string;
}

const Ctx = React.createContext<I18nValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(initialLang);
  const router = useRouter();
  setCurrentLang(lang); // keep non-React helpers (dates) in sync during render

  const setLang = React.useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setCurrentLang(l);
    setLangState(l);
    router.refresh(); // re-render server components (landing page, <html lang>, titles)
  }, [router]);

  const value = React.useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (k, v) => translate(lang, k, v),
      tp: (n, one, other, v) => translatePlural(lang, n, one, other, v),
    }),
    [lang, setLang]
  );
  // Re-mount on language change so every component (including date helpers) re-renders.
  return (
    <Ctx.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </Ctx.Provider>
  );
}

export function useT() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useT must be used inside <I18nProvider>");
  return v;
}

export function LanguageSwitch({ className, beforeChange }: { className?: string; beforeChange?: (l: Lang) => Promise<unknown> }) {
  const { lang, setLang } = useT();
  const [busy, setBusy] = React.useState(false);
  return (
    <div role="radiogroup" aria-label="Language" className={`inline-flex h-7 items-center rounded-md bg-muted p-0.5 ${className ?? ""}`}>
      {(["en", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          disabled={busy}
          onClick={async () => {
            if (l === lang) return;
            setBusy(true);
            try {
              await beforeChange?.(l);
            } finally {
              setBusy(false);
              setLang(l);
            }
          }}
          className={`h-6 rounded px-2 text-[12.5px] font-semibold transition-all ${lang === l ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "en" ? "EN" : "RU"}
        </button>
      ))}
    </div>
  );
}
