"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, Loader2, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListeningBars } from "@/components/capture/voice-controls";
import { BigMic } from "@/components/capture/capture-composer";
import { type AppliedChange, useAgent } from "@/components/app/agent";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Markdown } from "@/components/capture/markdown";
import { useDialogs } from "@/components/app/dialogs";
import { KIND_META, SimulatedBadge } from "@/components/items/meta";
import { useData } from "@/lib/data/store";
import type { AssistantMessage, CaptureKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUGGESTIONS = {
  en: ["Create a category called Entertainment", "What do I need to do tomorrow?", "What tasks have I forgotten?", "What was that business idea I mentioned last week?", "What should I prioritize today?"],
  ru: ["Создай категорию Развлечения", "Что мне нужно сделать завтра?", "Какие задачи я забыл?", "Какая была бизнес-идея на прошлой неделе?", "Что мне сделать в первую очередь сегодня?"],
};
const STORE_KEY = "dybysta:assistant:chat";

export default function AssistantPage() {
  const data = useData();
  const { open } = useDialogs();
  const router = useRouter();
  const { t, lang: uiLang } = useT();
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const agent = useAgent();
  const [changesByMsg, setChangesByMsg] = React.useState<Record<number, AppliedChange[]>>({});
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const voice = useVoiceInput((spoken) => ask(spoken));
  React.useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
      voice.clearError();
    }
  }, [voice.error, voice]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    const next: AssistantMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await agent.send(question, { history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })) });
      setMessages((m) => {
        const idx = m.length;
        if (r.changes.length) setChangesByMsg((c) => ({ ...c, [idx]: r.changes }));
        return [...m, { role: "assistant", content: r.reply, simulated: r.simulated }];
      });
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : t("Something went wrong.")}` }]);
    } finally {
      setLoading(false);
    }
  };

  const openRef = (type: CaptureKind, id: string) => {
    if (type === "task") {
      const t = data.tasks.find((x) => x.id === id);
      if (t) return open({ type: "task", editing: t });
    }
    if (type === "reminder") {
      const r = data.reminders.find((x) => x.id === id);
      if (r) return open({ type: "reminder", editing: r });
    }
    if (type === "event") {
      const e = data.events.find((x) => x.id === id);
      if (e) return open({ type: "event", editing: e });
    }
    if (type === "idea") {
      const i = data.ideas.find((x) => x.id === id);
      if (i) return open({ type: "idea", editing: i });
    }
    if (type === "note") return router.push(`/notes?id=${id}`);
    toast.error(t("That item no longer exists."));
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-3xl flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            {t("Assistant")} {!data.ai.configured && <SimulatedBadge />}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" /> {t("Tell me what to do — I'll do it. Ask anything about your saved items.")}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="xs" onClick={() => setMessages([])}>
            <RotateCcw /> {t("New chat")}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sand-500 to-sand-700 text-white shadow-lg shadow-primary/20">
              <Bot className="size-5" />
            </span>
            <p className="font-medium">{t("Ask about your tasks, notes, ideas and plans")}</p>
            <p className="mt-1 max-w-sm text-[14.5px] text-muted-foreground">
              {t("I can see {tasks} tasks, {reminders} reminders, {events} events, {notes} notes and {ideas} ideas.", {
                tasks: data.tasks.length,
                reminders: data.reminders.length,
                events: data.events.length,
                notes: data.notes.length,
                ideas: data.ideas.length,
              })}
            </p>
            <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS[uiLang].map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-lg border bg-background px-3 py-2.5 text-left text-[14.5px] transition-colors hover:border-primary/30 hover:bg-accent/40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15.5px] text-primary-foreground">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-[15.5px]">
                    <Markdown text={m.content} />
                    {m.references && m.references.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.references.slice(0, 8).map((r) => {
                          const M = KIND_META[r.type];
                          return (
                            <button key={`${r.type}-${r.id}`} onClick={() => openRef(r.type, r.id)} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[13px] hover:border-primary/30">
                              <M.icon className={cn("size-3 shrink-0", M.tint.split(" ")[0])} />
                              <span className="truncate">{r.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {changesByMsg[i] && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {changesByMsg[i].map((c) => (
                          <span key={`${c.table}-${c.id}-${c.kind}`} className="rounded-md border bg-background px-2 py-1 text-[13.5px]">
                            {c.kind === "created" ? "+ " : c.kind === "deleted" ? "− " : "✎ "}
                            {c.title}
                          </span>
                        ))}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={async () => {
                            await agent.undo(changesByMsg[i]);
                            setChangesByMsg((c) => {
                              const n = { ...c };
                              delete n[i];
                              return n;
                            });
                            toast(t("Undone"));
                          }}
                        >
                          {t("Undo")}
                        </Button>
                      </div>
                    )}
                    {m.simulated && <p className="mt-2 text-[12.5px] text-muted-foreground">{t("Simulated AI")}</p>}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex items-center gap-3 text-[14.5px] text-muted-foreground">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                </span>
                {t("Looking through your saved items…")}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-3 flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary/40"
      >
        <div className="shrink-0">
          <BigMic state={loading ? "thinking" : voice.state} level={voice.level} onClick={voice.toggle} size="md" disabled={!voice.supported} />
        </div>
        <div className="min-w-0 flex-1">
          {voice.state !== "idle" && (
            <p className="flex items-center gap-2 px-1 text-[14px] text-muted-foreground">
              <ListeningBars /> <span className="truncate italic">{voice.interim || (voice.state === "transcribing" ? t("Recognizing speech…") : t("Listening… tap to finish"))}</span>
            </p>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder={t("Ask about your tasks, ideas, notes…")}
            aria-label={t("Ask the assistant")}
            className="block max-h-32 min-h-10 w-full resize-none bg-transparent px-1 py-2.5 text-[15.5px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <Button type="submit" size="icon" className="rounded-xl" disabled={!input.trim() || loading} aria-label={t("Send")}>
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
