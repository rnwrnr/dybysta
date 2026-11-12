"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/items/meta";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { localNow } from "@/lib/ai/context";
import { fromDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { CaptureKind, CaptureResponse, VoiceLanguage } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { type Draft, missingFor, ReviewCard } from "./review-card";
import { LanguageToggle, ListeningBars, MicButton } from "./voice-controls";

const EXAMPLES: Record<VoiceLanguage, string[]> = {
  "en-US": [
    "Remind me to call my professor tomorrow at 3",
    "I have an idea for a university marketplace",
    "I need to finish my presentation before Friday",
    "Remember that Assem prefers meetings in the afternoon",
  ],
  "ru-RU": ["Напомни мне позвонить маме завтра в 7 вечера", "Нужно сдать отчёт до пятницы, срочно", "У меня идея: приложение для студентов", "Встреча с Асем в среду в 14:00"],
};

const ROUTE_FOR: Record<CaptureKind, string> = { task: "/tasks", reminder: "/reminders", idea: "/ideas", note: "/notes", event: "/calendar" };

export function CaptureComposer({ autoFocus, compact, onComplete }: { autoFocus?: boolean; compact?: boolean; onComplete?: () => void }) {
  const data = useData();
  const router = useRouter();
  const { preferences, categories } = data;
  const lang: VoiceLanguage = preferences.voice_language ?? "en-US";
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [meta, setMeta] = React.useState<{ simulated: boolean; error?: string; model?: string } | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechRecognition({
    lang,
    onFinal: (t) => setText((prev) => (prev ? prev.replace(/\s*$/, " ") : "") + t),
  });

  React.useEffect(() => {
    if (speech.error) toast.error(speech.error);
  }, [speech.error]);

  const setLang = (v: VoiceLanguage) => data.savePreferences({ voice_language: v });

  const toDraft = (item: CaptureResponse["items"][number]): Draft => {
    const cat = item.category ? categories.find((c) => c.name.toLowerCase() === item.category!.toLowerCase()) : undefined;
    return {
      key: uid(),
      kind: item.kind,
      title: item.title,
      description: item.description ?? "",
      date: item.date ?? "",
      time: item.time ?? "",
      end_time: item.end_time ?? "",
      priority: item.priority ?? "medium",
      priorityFromAi: Boolean(item.priority),
      category_id: cat?.id ?? null,
      tags: item.tags ?? [],
      repeat: item.repeat ?? "none",
      ai: item,
      touched: new Set(),
    };
  };

  const analyze = async () => {
    const input = text.trim();
    if (!input || loading) return;
    if (speech.listening) speech.stop();
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch("/api/ai/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, now: localNow(now), weekday: now.toLocaleDateString("en-US", { weekday: "long" }), categories: categories.map((c) => c.name) }),
      });
      const json = (await res.json()) as CaptureResponse;
      if (!res.ok) throw new Error(json.error ?? "The AI couldn't process that.");
      if (!json.items.length) throw new Error("I couldn't find anything to save in that. Try rephrasing.");
      setDrafts(json.items.map(toDraft));
      setMeta({ simulated: json.simulated, error: json.error, model: json.model });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finishIfEmpty = (next: Draft[]) => {
    if (next.length === 0) {
      setText("");
      setMeta(null);
      onComplete?.();
    }
  };

  const save = async (d: Draft) => {
    if (missingFor(d)) return;
    setSavingKey(d.key);
    const common = { title: d.title.trim(), category_id: d.category_id, source: "ai" as const };
    const desc = d.description.trim() || null;
    let ok = false;
    switch (d.kind) {
      case "task":
        ok = !!(await data.create("tasks", { ...common, description: desc, due_date: d.date || null, due_time: d.date && d.time ? d.time : null, priority: d.priority, status: "todo", completed_at: null }, { silent: true }));
        break;
      case "reminder":
        ok = !!(await data.create("reminders", { ...common, description: desc, remind_at: fromDateKey(d.date, d.time).toISOString(), repeat: d.repeat, status: "pending", last_notified_at: null, task_id: null }, { silent: true }));
        break;
      case "event":
        ok = !!(await data.create("events", { ...common, description: desc, start_date: d.date, start_time: d.time || null, end_time: d.time && d.end_time ? d.end_time : null, location: null }, { silent: true }));
        break;
      case "idea":
        ok = !!(await data.create("ideas", { ...common, description: desc, tags: d.tags, status: "new", converted_task_id: null }, { silent: true }));
        break;
      case "note":
        ok = !!(await data.create("notes", { ...common, content: desc ?? d.title, folder: null, tags: d.tags, pinned: false }, { silent: true }));
        break;
    }
    setSavingKey(null);
    if (ok) {
      toast.success(`${d.kind[0].toUpperCase() + d.kind.slice(1)} saved`, {
        description: d.title,
        action: { label: "View", onClick: () => router.push(ROUTE_FOR[d.kind]) },
      });
      const next = drafts.filter((x) => x.key !== d.key);
      setDrafts(next);
      finishIfEmpty(next);
    }
  };

  const discard = (key: string) => {
    const next = drafts.filter((x) => x.key !== key);
    setDrafts(next);
    finishIfEmpty(next);
  };

  const reviewing = drafts.length > 0;

  if (reviewing) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <WandSparkles className="size-4 shrink-0 text-primary" />
            <p className="truncate text-[13px] text-muted-foreground">
              From: <span className="text-foreground">&ldquo;{text.trim()}&rdquo;</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {meta?.simulated && <SimulatedBadge />}
            <Button variant="ghost" size="xs" onClick={() => setDrafts([])}>
              <RotateCcw /> Edit text
            </Button>
          </div>
        </div>
        {meta?.error && <p className="rounded-lg bg-warning/10 px-3 py-2 text-[12.5px] text-[oklch(0.45_0.12_60)]">{meta.error}</p>}
        {drafts.map((d) => (
          <ReviewCard
            key={d.key}
            draft={d}
            saving={savingKey === d.key}
            onChange={(nd) => setDrafts((list) => list.map((x) => (x.key === d.key ? nd : x)))}
            onSave={() => save(d)}
            onDiscard={() => discard(d.key)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "group relative rounded-2xl border bg-card shadow-[0_1px_3px_rgba(16,16,32,0.05)] transition-all focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_10%,transparent)]",
          speech.listening && "border-destructive/40"
        )}
      >
        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
              e.preventDefault();
              analyze();
            }
          }}
          rows={compact ? 3 : 3}
          maxLength={2000}
          placeholder={lang === "ru-RU" ? "Напишите или скажите что угодно — задачу, идею, напоминание…" : "Type or say anything — a task, an idea, a reminder…"}
          aria-label="Quick capture"
          className="block w-full resize-none bg-transparent px-4 pt-4 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
        />
        {speech.listening && (
          <div className="flex items-center gap-2 px-4 pb-1 text-[13px] text-muted-foreground" aria-live="polite">
            <ListeningBars />
            <span className="truncate italic">{speech.interim || (lang === "ru-RU" ? "Слушаю…" : "Listening…")}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-3">
          <div className="flex items-center gap-2">
            <MicButton listening={speech.listening} supported={speech.supported} onClick={() => (speech.listening ? speech.stop() : speech.start())} />
            <LanguageToggle value={lang} onChange={setLang} />
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{speech.listening ? "Speak naturally — you can edit the text after" : "Enter to analyze · Shift+Enter for new line"}</span>
          </div>
          <Button onClick={analyze} disabled={!text.trim() || loading} size="sm" className="rounded-lg">
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Thinking…" : "Organize"}
            {!loading && <ArrowUp className="hidden sm:block" />}
          </Button>
        </div>
      </div>
      {!compact && !text && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES[lang].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                textareaRef.current?.focus();
              }}
              className="rounded-full border bg-card px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      {!data.ai.configured && !compact && (
        <p className="text-[11px] text-muted-foreground">
          <Sparkles className="mr-1 inline size-3 text-warning" />
          Demo AI: no OpenAI key is configured, so a built-in rule-based parser is used. <Link href="/settings#privacy" className="underline underline-offset-2">Learn more</Link>
        </p>
      )}
    </div>
  );
}
