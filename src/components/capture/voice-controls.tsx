"use client";
import { useT } from "@/lib/i18n/provider";
import { Mic, Square } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VoiceLanguage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MicButton({ listening, supported, onClick, size = "md" }: { listening: boolean; supported: boolean; onClick: () => void; size?: "md" | "lg" }) {
  const { t } = useT();
  const dim = size === "lg" ? "size-12" : "size-10";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={listening}
          aria-label={listening ? t("Stop voice input") : t("Start voice input")}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-full transition-all focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
            dim,
            listening ? "bg-destructive text-white shadow-lg shadow-destructive/25" : "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:scale-[1.04] hover:bg-primary/90",
            !supported && "opacity-60"
          )}
        >
          {listening && <span className="animate-pulse-ring absolute inset-0 rounded-full bg-destructive/40" />}
          {listening ? <Square className="relative size-4" fill="currentColor" /> : <Mic className={cn("relative", size === "lg" ? "size-5" : "size-[18px]")} />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{!supported ? t("Voice input isn't supported in this browser") : listening ? t("Stop listening") : t("Speak instead of typing")}</TooltipContent>
    </Tooltip>
  );
}

export function LanguageToggle({ value, onChange }: { value: VoiceLanguage; onChange: (v: VoiceLanguage) => void }) {
  const { t } = useT();
  const opts: { v: VoiceLanguage; label: string; full: string }[] = [
    { v: "en-US", label: "EN", full: "English" },
    { v: "ru-RU", label: "RU", full: "Русский" },
  ];
  return (
    <div role="radiogroup" aria-label={t("Voice language")} className="inline-flex h-7 items-center rounded-md bg-muted p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          title={o.full}
          onClick={() => onChange(o.v)}
          className={cn(
            "h-6 rounded px-2 text-[11px] font-semibold tracking-wide transition-all",
            value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ListeningBars() {
  return (
    <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="w-[3px] animate-pulse rounded-full bg-destructive" style={{ height: `${[60, 100, 45, 80][i]}%`, animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}
