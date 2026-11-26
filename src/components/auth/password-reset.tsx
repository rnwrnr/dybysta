"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/config";
import { useT } from "@/lib/i18n/provider";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Step 1: ask for the email and send a reset link. */
export function ForgotPasswordForm() {
  const { t } = useT();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(params.get("error") === "expired" ? t("That reset link is invalid or expired. Request a new one.") : null);

  if (!isSupabaseConfigured)
    return (
      <Card>
        <CardContent className="grid gap-3 py-8 text-center">
          <p className="font-medium">{t("Demo accounts don't have passwords.")}</p>
          <Link href="/login" className="text-primary hover:underline">
            {t("Back to sign in")}
          </Link>
        </CardContent>
      </Card>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) setError(/rate limit/i.test(error.message) ? t("Too many attempts. Please wait a moment and try again.") : error.message);
    else setSent(true);
  };

  if (sent)
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-3 py-10 text-center">
          <MailCheck className="size-9 text-primary" />
          <h1 className="text-xl font-semibold">{t("Check your inbox")}</h1>
          <p className="text-[15px] text-muted-foreground">{t("If an account exists for {email}, we sent a link to reset your password. Check the spam folder too.", { email })}</p>
          <Link href="/login" className="text-[15px] font-medium text-primary hover:underline">
            {t("Back to sign in")}
          </Link>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="grid gap-5 pt-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("Forgot your password?")}</h1>
          <p className="text-[15px] text-muted-foreground">{t("Enter your email and we'll send you a link to set a new one.")}</p>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t("Email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-[14px] text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {t("Send reset link")}
          </Button>
        </form>
        <Link href="/login" className="text-center text-[14.5px] text-muted-foreground hover:text-foreground">
          {t("Back to sign in")}
        </Link>
      </CardContent>
    </Card>
  );
}

/** Step 2: the user arrives from the email link (already signed in) and sets a new password. Also used for "Change password". */
export function ResetPasswordForm() {
  const { t } = useT();
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return setHasSession(false);
    getSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  if (hasSession === null)
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (!hasSession)
    return (
      <Card>
        <CardContent className="grid gap-3 py-8 text-center">
          <p className="font-medium">{t("That reset link is invalid or expired. Request a new one.")}</p>
          <Link href="/forgot-password" className="text-primary hover:underline">
            {t("Send reset link")}
          </Link>
        </CardContent>
      </Card>
    );

  const mismatch = confirm.length > 0 && confirm !== password;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError(t("Password must be at least 6 characters."));
    if (password !== confirm) return setError(t("The passwords don't match."));
    setLoading(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) setError(/different from the old/i.test(error.message) ? t("Choose a password different from your old one.") : error.message);
    else {
      toast.success(t("Password updated"));
      router.replace("/dashboard");
      router.refresh();
    }
  };

  return (
    <Card>
      <CardContent className="grid gap-5 pt-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <KeyRound className="size-5 text-primary" /> {t("Set a new password")}
          </h1>
          <p className="text-[15px] text-muted-foreground">{t("Choose a password with at least 6 characters.")}</p>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="password">{t("New password")}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">{t("Repeat new password")}</Label>
            <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
            {mismatch && <p className="text-[13.5px] text-destructive">{t("The passwords don't match.")}</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-[14px] text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || mismatch}>
            {loading && <Loader2 className="animate-spin" />}
            {t("Save new password")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
