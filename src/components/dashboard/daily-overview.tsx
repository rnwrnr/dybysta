"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildContext } from "@/lib/ai/context";
import { useData } from "@/lib/data/store";

const CACHE_KEY = "dybysta:overview:v2";

/** Cheap fingerprint so the overview only regenerates when relevant data changes. */
function signature(s: ReturnType<typeof useData>) {
  const parts = [
    new Date().toDateString(),
    s.preferences.ai_language,
    document.documentElement.lang,
    ...s.tasks.map((t) => `${t.id}${t.status}${t.due_date}${t.due_time}${t.priority}`),
    ...s.reminders.map((r) => `${r.id}${r.remind_at}${r.status}`),
    ...s.events.map((e) => `${e.id}${e.start_date}${e.start_time}`),
  ].join("|");
  let h = 0;
  for (let i = 0; i < parts.length; i++) h = (h * 31 + parts.charCodeAt(i)) | 0;
  return String(h);
}

export function DailyOverview() {
  const data = useData();
  const { t, lang } = useT();
  const [state, setState] = React.useState<{ text: string; simulated: boolean } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sig = signature(data);

  const generate = React.useCallback(
    async (force = false) => {
      if (!force) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
          if (cached?.sig === sig) {
            setState(cached.value);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: buildContext(data), language: data.preferences.ai_language === "auto" || !data.preferences.ai_language ? lang : data.preferences.ai_language }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? t("Could not generate overview"));
        const value = { text: json.text as string, simulated: Boolean(json.simulated) };
        setState(value);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ sig, value }));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Could not generate overview"));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig]
  );

  React.useEffect(() => {
    if (data.preferences.daily_overview_enabled !== false) generate();
  }, [generate, data.preferences.daily_overview_enabled]);

  if (data.preferences.daily_overview_enabled === false) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-sand-50 via-card to-card p-5">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <p className="text-sm font-semibold">{t("Your day at a glance")}</p>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={() => generate(true)} disabled={loading} aria-label={t("Regenerate overview")}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      <div className="relative mt-3 text-[15.5px] leading-relaxed text-foreground/85">
        {loading && !state ? (
          <div className="grid gap-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : error ? (
          <p className="text-[14.5px] text-muted-foreground">{error}</p>
        ) : (
          <p>{state?.text}</p>
        )}
      </div>
      <p className="relative mt-3 text-[12.5px] text-muted-foreground">{t("AI summary of your saved items — it doesn't change anything.")}</p>
    </div>
  );
}
