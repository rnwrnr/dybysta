"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/config";
import { startDemoSession } from "@/lib/data/demo-backend";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function friendly(msg: string, t: (k: string) => string) {
  if (/invalid login credentials/i.test(msg)) return t("Email or password is incorrect.");
  if (/email not confirmed/i.test(msg)) return t("Please confirm your email first — check your inbox.");
  if (/already registered/i.test(msg)) return t("An account with this email already exists. Try signing in.");
  if (/password should be at least/i.test(msg)) return t("Password must be at least 6 characters.");
  if (/rate limit/i.test(msg)) return t("Too many attempts. Please wait a moment and try again.");
  return msg;
}

function DemoEntry({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { t, lang } = useT();
  const [name, setName] = React.useState("");
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{mode === "login" ? t("Welcome back") : t("Create your space")}</h1>
          <p className="text-[14.5px] text-muted-foreground">{t("Try DYBYSTA instantly — no account needed.")}</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-3 text-[14px] leading-relaxed">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-[oklch(0.5_0.13_60)]">
            <FlaskConical className="size-3.5" /> {t("Demo mode")}
          </p>
          {t("Supabase isn't configured on this server, so your data is stored only in this browser (with some sample items to explore). Add Supabase keys to enable real accounts.")}
        </div>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startDemoSession(name.trim() || t("Guest"), lang);
            router.replace("/dashboard");
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t("What should I call you?")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Your name")} autoFocus maxLength={60} />
          </div>
          <Button type="submit">{t("Enter demo")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useT();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(params.get("error") === "confirmation_failed" ? t("That confirmation link is invalid or expired.") : null);
  const [sent, setSent] = React.useState(false);

  if (!isSupabaseConfigured) return <DemoEntry mode={mode} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sb = getSupabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(params.get("next") || "/dashboard");
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim(), lang }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else setSent(true);
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : t("Something went wrong"), t));
    } finally {
      setLoading(false);
    }
  };

  if (sent)
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-3 py-10 text-center">
          <MailCheck className="size-8 text-primary" />
          <h1 className="text-lg font-semibold">{t("Check your inbox")}</h1>
          <p className="text-[14.5px] text-muted-foreground">{t("We sent a confirmation link to {email}. Click it to activate your account.", { email })}</p>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="grid gap-5 pt-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{mode === "login" ? t("Welcome back") : t("Create your account")}</h1>
          <p className="text-[14.5px] text-muted-foreground">{mode === "login" ? t("Sign in to your personal assistant.") : t("Start organizing your life in seconds.")}</p>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          {mode === "signup" && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("Name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Your name")} autoComplete="name" maxLength={60} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t("Email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("Password")}</Label>
              {mode === "login" && (
                <Link href="/forgot-password" className="text-[13.5px] font-medium text-primary hover:underline">
                  {t("Forgot password?")}
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-[14px] text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading && <Loader2 className="animate-spin" />}
            {mode === "login" ? t("Sign in") : t("Create account")}
          </Button>
        </form>
        <p className="text-center text-[14.5px] text-muted-foreground">
          {mode === "login" ? t("New to DYBYSTA?") : t("Already have an account?")}{" "}
          <Link href={mode === "login" ? "/signup" : "/login"} className="font-medium text-primary hover:underline">
            {mode === "login" ? t("Create an account") : t("Sign in")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
