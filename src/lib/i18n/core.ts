import { RU } from "./ru";

export type Lang = "en" | "ru";
export const LANG_COOKIE = "dybysta-lang";

type Vars = Record<string, string | number>;

function interpolate(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** English source strings are the keys; Russian comes from the RU dictionary (falls back to English). */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  if (lang === "ru") {
    const v = RU[key];
    if (typeof v === "string") return interpolate(v, vars);
  }
  return interpolate(key, vars);
}

function ruPluralIndex(n: number) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 2;
  if (b === 1) return 0;
  if (b >= 2 && b <= 4) return 1;
  return 2;
}

/** Plural-aware translation. `other` is the dictionary key; RU value is [one, few, many]. */
export function translatePlural(lang: Lang, n: number, one: string, other: string, vars?: Vars): string {
  const all = { n, ...vars };
  if (lang === "ru") {
    const v = RU[other];
    if (Array.isArray(v)) return interpolate(v[ruPluralIndex(n)], all);
    if (typeof v === "string") return interpolate(v, all);
  }
  return interpolate(n === 1 ? one : other, all);
}

// The active UI language, used by non-React helpers such as date formatting.
let current: Lang = "en";
export function setCurrentLang(l: Lang) {
  current = l;
}
export function getCurrentLang(): Lang {
  return current;
}
export const t = (key: string, vars?: Vars) => translate(current, key, vars);
export const tp = (n: number, one: string, other: string, vars?: Vars) => translatePlural(current, n, one, other, vars);

export function normalizeLang(v: unknown): Lang {
  return v === "ru" ? "ru" : "en";
}
