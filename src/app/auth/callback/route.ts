import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Only allow same-site relative paths (no "//evil.com" open redirects).
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    if (!error) return NextResponse.redirect(`${origin}${safe}`);
  }
  const failed = next.startsWith("/reset-password") ? "/forgot-password?error=expired" : "/login?error=confirmation_failed";
  return NextResponse.redirect(`${origin}${failed}`);
}
