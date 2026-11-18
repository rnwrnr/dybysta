import Link from "next/link";
import { ArrowRight, Bell, Bot, Check, Lightbulb, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/lib/i18n/provider";
import { getServerT } from "@/lib/i18n/server";

const FEATURES = [
  { icon: Mic, title: "Speak or type naturally", body: "“Remind me to call my professor tomorrow at 3” — in English or Russian. Live transcription you can edit." },
  { icon: Sparkles, title: "AI organizes it", body: "Tasks, reminders, ideas, notes and events — with dates, times and priority extracted for you." },
  { icon: ShieldCheck, title: "You stay the boss", body: "Nothing is saved until you approve it. Every AI interpretation is shown, nothing is invented." },
  { icon: Bell, title: "Smart reminders", body: "Notifications with snooze, repeat schedules and quiet hours — fully under your control." },
  { icon: Lightbulb, title: "Ideas & notes", body: "Capture sparks of inspiration, tag them, pin notes, and turn any of them into tasks." },
  { icon: Bot, title: "Ask your assistant", body: "“What should I prioritize today?” — answers come only from what you've saved." },
];

export default async function Landing() {
  const { t } = await getServerT();
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("Sign in")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t("Get started")}</Link>
          </Button>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-3xl rounded-full bg-gradient-to-b from-violet-200/50 via-purple-100/30 to-transparent blur-3xl" />
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground shadow-sm">
          <Sparkles className="size-3.5 text-primary" /> {t("AI should be proactive — but you stay the boss")}
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {t("Say it once.")} <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">DYBYSTA</span> {t("remembers.")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
          {t("Your personal assistant for tasks, reminders, ideas and notes. Speak or type the way you think — it sorts everything out and asks before saving.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              {t("Start for free")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t("I have an account")}</Link>
          </Button>
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border bg-card p-4 text-left shadow-xl shadow-primary/5">
          <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
              <Mic className="size-4" />
            </span>
            <p className="text-[14px]">{t("Remind me to call my professor tomorrow at 3")}</p>
          </div>
          <div className="mt-3 grid gap-2 rounded-xl bg-accent/50 p-4 text-[13px]">
            <div className="flex items-center gap-2 font-medium">
              <Bell className="size-4 text-amber-600" /> {t("Reminder")} · {t("Call my professor")}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
              <span>{t("Tomorrow")}, 15:00</span>
              <span>
                {t("Category")}: {t("Study")}
              </span>
            </div>
            <p className="text-[12px] text-accent-foreground">
              <Sparkles className="mr-1 inline size-3" />
              {t('Interpreted "{n}" as {time} — change it if you meant the morning.', { n: 3, time: "15:00" })}
            </p>
            <div className="mt-1 flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-white">
                <Check className="size-3.5" /> {t("Save {kind}", { kind: t("Reminder").toLowerCase() })}
              </span>
              <span className="rounded-md px-2.5 py-1 text-[12px] text-muted-foreground">{t("Discard")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5">
            <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
              <f.icon className="size-4" />
            </span>
            <p className="font-medium">{t(f.title)}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t(f.body)}</p>
          </div>
        ))}
      </section>
      <footer className="border-t py-8 text-center text-[12px] text-muted-foreground">© {new Date().getFullYear()} DYBYSTA · {t("Your data stays yours.")}</footer>
    </div>
  );
}
