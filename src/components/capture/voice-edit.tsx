"use client";
import * as React from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { type AppliedChange, useAgent } from "@/components/app/agent";
import { useVoiceInput } from "@/hooks/use-voice-input";
import type { AgentFocus } from "@/lib/ai/agent-types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** "Change by voice": speak an instruction about the open task or note and it is applied directly. */
export function VoiceEdit({ focus, onApplied, className }: { focus: AgentFocus; onApplied?: (changes: AppliedChange[]) => void; className?: string }) {
  const { t } = useT();
  const agent = useAgent();
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  const apply = async (instruction: string) => {
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const r = await agent.send(instruction, { focus });
      onApplied?.(r.changes);
      if (r.changes.length) toast.success(r.reply, { action: { label: t("Undo"), onClick: () => agent.undo(r.changes).then(() => toast(t("Undone"))) } });
      else toast(r.reply || t("Nothing to change."));
      setTyped("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const voice = useVoiceInput(apply);
  React.useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
      voice.clearError();
    }
  }, [voice.error, voice]);

  const listening = voice.state === "listening";
  const working = busy || voice.state === "transcribing";
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-primary/25 bg-accent/60 p-2.5", className)}>
      <button
        type="button"
        onClick={voice.toggle}
        disabled={working}
        aria-label={listening ? t("Stop and apply") : t("Change by voice")}
        className={cn(
          "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all disabled:cursor-wait",
          listening ? "bg-destructive" : "bg-primary hover:bg-primary/90"
        )}
      >
        {listening && <span className="animate-pulse-ring absolute inset-0 rounded-full bg-destructive/30" />}
        {working ? <Loader2 className="relative size-5 animate-spin" /> : listening ? <Square className="relative size-4" fill="currentColor" /> : <Mic className="relative size-6" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium text-accent-foreground">
          {listening ? t("Listening… tap to apply") : working ? t("Applying your changes…") : t("Change by voice")}
        </p>
        {listening && voice.interim ? (
          <p className="truncate text-[13.5px] text-muted-foreground italic">{voice.interim}</p>
        ) : (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                apply(typed);
              }
            }}
            disabled={working}
            placeholder={t("e.g. “move it to Friday and add: bring the slides”")}
            aria-label={t("Change by voice")}
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/80"
          />
        )}
      </div>
    </div>
  );
}
