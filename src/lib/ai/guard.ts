import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseServer } from "@/lib/supabase/server";
import { LANG_COOKIE, normalizeLang, translate } from "@/lib/i18n/core";

function reqLang(req: Request) {
  const m = req.headers.get("cookie")?.match(new RegExp(`${LANG_COOKIE}=(\\w+)`));
  return normalizeLang(m?.[1]);
}

const hits = new Map<string, { count: number; reset: number }>();

/** Requires a signed-in user when Supabase is configured, plus a simple per-user rate limit. */
export async function guardAiRequest(req: Request): Promise<NextResponse | null> {
  let key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isSupabaseConfigured) {
    const sb = await getSupabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: translate(reqLang(req), "Please sign in to use AI features.") }, { status: 401 });
    key = data.user.id;
  }
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + 60_000 });
  else if (++entry.count > 30) return NextResponse.json({ error: translate(reqLang(req), "Too many AI requests — please wait a minute.") }, { status: 429 });
  return null;
}
