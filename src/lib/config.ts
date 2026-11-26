/**
 * Accepts common copy-paste variants of the Supabase address and turns them into
 * the plain project URL, e.g. "https://abcd.supabase.co/rest/v1/" or the dashboard
 * link "https://supabase.com/dashboard/project/abcd" → "https://abcd.supabase.co".
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!u) return "";
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return u.replace(/\/+$/, "");
  }
}

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().replace(/^["']|["']$/g, "");

/** When Supabase env vars are missing the app runs in demo mode (browser-local data). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_ROUTES = ["/dashboard", "/tasks", "/reminders", "/calendar", "/ideas", "/notes", "/assistant", "/settings"];
