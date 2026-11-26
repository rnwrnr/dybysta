"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Bell, CalendarDays, CheckCircle2, FolderOpen, Lightbulb, Loader2, Mic, Pencil, StickyNote, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type AgentResult, useAgent } from "@/components/app/agent";
import { SimulatedBadge } from "@/components/items/meta";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useData } from "@/lib/data/store";
import { useT } from "@/lib/i18n/provider";
import type { AgentTable } from "@/lib/ai/agent-types";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./voice-controls";

const TABLE_META: Record<AgentTable, { icon: React.ElementType; label: string; href: string; tint: string }> = {
  tasks: { icon: CheckCircle2, label: "Task", href: "/tasks", tint: "text-blue-600" },
  reminders: { icon: Bell, label: "Reminder", href: "/reminders", tint: "text-amber-600" },
  notes: { icon: StickyNote, label: "Note", href: "/notes", tint: "text-emerald-600" },
  ideas: { icon: Lightbulb, label: "Idea", href: "/ideas", tint: "text-sand-700" },
  events: { icon: CalendarDays, label: "Event", href: "/calendar", tint: "text-rose-600" },
  categories: { icon: FolderOpen, label: "Category", href: "/settings#categories", tint: "text-sand-700" },
};

export function BigMic({ state, level, onClick, size = "lg", disabled }: { state: "idle" | "listening" | "transcribing" | "thinking"; level: number; onClick: () => void; size?: "lg" | "md"; disabled?: boolean }) {
  const { t } = useT();
  const dim = size === "lg" ? "size-28 sm:size-32" : "size-20";
  const busy = state === "transcribing" || state === "thinking";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-pressed={state === "listening"}
      aria-label={state === "listening" ? t("Stop and save") : t("Start voice input")}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-all focus-visible:ring-[6px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-wait",
        dim,
        state === "listening" ? "bg-destructive text-white shadow-2xl shadow-destructive/30" : "bg-primary text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.03] hover:bg-primary/90"
      )}
    >
      {state === "listening" && (
        <>
          <span className="absolute inset-0 rounded-full bg-destructive/30 transition-transform duration-100" style={{ transform: `scale(${1 + level * 0.45})` }} />
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-destructive/25" />
        </>
      )}
      {busy ? <Loader2 className={cn("relative animate-spin", size === "lg" ? "size-11" : "size-8")} /> : <Mic className={cn("relative", size === "lg" ? "size-12 sm:size-14" : "size-8")} strokeWidth={2.2} />}
    </button>
  );
}

function ResultCard({ result, onUndo, onClose }: { result: AgentResult; onUndo: () => void; onClose: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const visible = result.changes.filter((c) => !(c.table === "categories" && c.kind === "created" && result.changes.some((x) => x.category === c.title && x.table !== "categories")));
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-2xl border bg-card p-5 text-left shadow-sm duration-300">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] leading-relaxed">{result.reply}</p>
        {result.simulated && <SimulatedBadge />}
      </div>
      {result.error && <p className="mt-2 text-[13.5px] text-[oklch(0.45_0.12_60)]">{result.error}</p>}
      {result.failed.length > 0 && (
        <div className="mt-3 rounded-xl bg-destructive/8 px-3.5 py-2.5 text-[14px] text-destructive">
          <p className="font-medium">{t("Couldn't save:")}</p>
          <ul className="mt-1 list-disc pl-5">
            {result.failed.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {visible.length > 0 && (
        <ul className="mt-4 grid gap-1.5">
          {visible.map((c) => {
            const m = TABLE_META[c.table];
            const Icon = c.kind === "deleted" ? Trash2 : c.kind === "updated" ? Pencil : m.icon;
            return (
              <li key={`${c.table}-${c.id}-${c.kind}`}>
                <button
                  onClick={() => c.kind !== "deleted" && router.push(c.table === "notes" ? `/notes?id=${c.id}` : m.href)}
                  className="flex w-full items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <Icon className={cn("size-[18px] shrink-0", m.tint)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{c.title}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {t(c.kind === "created" ? "{kind} added" : c.kind === "updated" ? "{kind} updated" : "{kind} deleted", { kind: t(m.label) })}
                      {c.category && c.kind === "created" && c.table !== "categories" ? ` · ${t("in {folder}", { folder: c.category })}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        {result.changes.length > 0 && (
          <Button variant="outline" size="sm" onClick={onUndo}>
            <Undo2 /> {t("Undo")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("Close")}
        </Button>
      </div>
    </div>
  );
}

/** The main voice-first input. Everything said or typed is executed and organized right away. */
export function CaptureComposer({ autoFocus, compact, onComplete }: { autoFocus?: boolean; compact?: boolean; onComplete?: () => void }) {
  const data = useData();
  const { t } = useT();
  const agent = useAgent();
  const [text, setText] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [result, setResult] = React.useState<AgentResult | null>(null);
  const [heard, setHeard] = React.useState("");

  const run = async (input: string) => {
    const q = input.trim();
    if (!q || thinking) return;
    setThinking(true);
    setHeard(q);
    setResult(null);
    try {
      const r = await agent.send(q);
      setResult(r);
      setText("");
      if (compact && r.changes.length) {
        toast.success(r.reply, { action: { label: t("Undo"), onClick: () => agent.undo(r.changes).then(() => toast(t("Undone"))) } });
        onComplete?.();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setThinking(false);
    }
  };

  const voice = useVoiceInput((spoken) => run(spoken));
  React.useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
      voice.clearError();
    }
  }, [voice.error, voice]);

  const micState = thinking ? "thinking" : voice.state;
  const status =
    micState === "listening"
      ? t("Listening… tap to finish")
      : micState === "transcribing"
        ? t("Recognizing speech…")
        : micState === "thinking"
          ? t("Understanding and organizing…")
          : t("Tap and speak — I'll save and organize it");

  return (
    <div className={cn("grid gap-5", !compact && "py-2")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <BigMic state={micState} level={voice.level} onClick={voice.toggle} size={compact ? "md" : "lg"} disabled={!voice.supported} />
        <div className="grid gap-1" aria-live="polite">
          <p className={cn("font-medium", compact ? "text-[16px]" : "text-[18px]")}>{status}</p>
          {micState === "listening" && voice.mode === "server" && <p className="text-[14px] tabular-nums text-muted-foreground">0:{String(voice.seconds).padStart(2, "0")}</p>}
          {micState === "listening" && voice.interim && <p className="max-w-xl text-[15px] text-muted-foreground italic">{voice.interim}</p>}
          {(micState === "thinking" || micState === "transcribing") && heard && <p className="max-w-xl text-[15px] text-muted-foreground">&ldquo;{heard}&rdquo;</p>}
          {micState === "idle" &&
            (voice.mode === "server" ? (
              <p className="text-[13.5px] text-muted-foreground">{t("Kazakh, Russian and English — even mixed in one sentence")}</p>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[13.5px] text-muted-foreground">
                {t("Voice language")}: <LanguageToggle value={data.preferences.voice_language ?? "en-US"} onChange={(v) => data.savePreferences({ voice_language: v })} />
              </div>
            ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(text);
        }}
        className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border bg-card p-1.5 pl-4 shadow-sm focus-within:border-primary/50"
      >
        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("…or type: “Call Assem tomorrow at 3”, “Create a category Entertainment”")}
          aria-label={t("Quick capture")}
          maxLength={4000}
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-muted-foreground/70"
        />
        <Button type="submit" size="icon" className="size-10 rounded-xl" disabled={!text.trim() || thinking} aria-label={t("Send")}>
          {thinking ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>

      {result && !compact && (
        <div className="mx-auto w-full max-w-2xl">
          <ResultCard
            result={result}
            onClose={() => setResult(null)}
            onUndo={async () => {
              await agent.undo(result.changes);
              setResult(null);
              toast(t("Undone"));
            }}
          />
        </div>
      )}
      {!data.ai.configured && !compact && (
        <p className="text-center text-[13px] text-muted-foreground">
          {t("Demo AI: no OpenAI key is configured, so a built-in rule-based parser is used.")}{" "}
          <Link href="/settings#privacy" className="underline underline-offset-2">
            {t("Learn more")}
          </Link>
        </p>
      )}
    </div>
  );
}
