"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { repeatLabel, REPEAT_KEYS } from "@/lib/dates";
import type { Priority, ReminderRepeat } from "@/lib/types";
import { PRIORITIES, PriorityFlag, priorityLabel } from "./meta";

export function Field({ label, children, hint, className }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PrioritySelect({ value, onChange, size }: { value: Priority; onChange: (p: Priority) => void; size?: "sm" | "default" }) {
  const { t } = useT();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="flex items-center gap-2">
              <PriorityFlag priority={p} /> {t(priorityLabel(p))}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RepeatSelect({ value, onChange, size }: { value: ReminderRepeat; onChange: (r: ReminderRepeat) => void; size?: "sm" | "default" }) {
  useT();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReminderRepeat)}>
      <SelectTrigger size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REPEAT_KEYS.map((r) => (
          <SelectItem key={r} value={r}>
            {repeatLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const { t: tr } = useT();
  const [draft, setDraft] = React.useState("");
  const commit = () => {
    const parts = draft.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])].slice(0, 15));
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
          #{t}
          <button type="button" aria-label={`× #${t}`} className="opacity-60 hover:opacity-100" onClick={() => onChange(value.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "" : (placeholder ?? tr("Add tags…"))}
        className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}
