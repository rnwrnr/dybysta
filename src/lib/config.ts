export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** When Supabase env vars are missing the app runs in demo mode (browser-local data). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_ROUTES = ["/dashboard", "/tasks", "/reminders", "/calendar", "/ideas", "/notes", "/assistant", "/settings"];
