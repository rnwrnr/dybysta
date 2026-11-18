import "server-only";
import { cookies, headers } from "next/headers";
import { type Lang, LANG_COOKIE, normalizeLang, translate, translatePlural } from "./core";

/** Language for server-rendered pages: cookie first, then the browser's Accept-Language. */
export async function getServerLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c) return normalizeLang(c);
  const accept = (await headers()).get("accept-language") ?? "";
  return /^(ru|kk)\b/i.test(accept.trim()) ? "ru" : "en";
}

export async function getServerT() {
  const lang = await getServerLang();
  return {
    lang,
    t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v),
    tp: (n: number, one: string, other: string, v?: Record<string, string | number>) => translatePlural(lang, n, one, other, v),
  };
}
