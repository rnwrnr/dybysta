"use client";
import * as React from "react";
import { AlertCircle, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategorySelect } from "@/components/items/category-select";
import { Field, PrioritySelect, RepeatSelect, TagInput } from "@/components/items/fields";
import { KIND_META } from "@/components/items/meta";
import type { CaptureKind, ExtractedItem, Priority, ReminderRepeat } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Draft {
  key: string;
  kind: CaptureKind;
  title: string;
  description: string;
  date: string;
  time: string;
  end_time: string;
  priority: Priority;
  priorityFromAi: boolean;
  category_id: string | null;
  tags: string[];
  repeat: ReminderRepeat;
  ai: ExtractedItem;
  touched: Set<string>;
}

export function missingFor(d: Draft): string | null {
  if (!d.title.trim()) return "Add a title";
  if (d.kind === "reminder" && (!d.date || !d.time)) return "A reminder needs a date and time";
  if (d.kind === "event" && !d.date) return "An event needs a date";
  if (d.kind === "event" && d.time && d.end_time && d.end_time <= d.time) return "End time must be after start time";
  return null;
}

function AiMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Sparkles className="size-3 text-primary" aria-label="Filled by AI" />
      </TooltipTrigger>
      <TooltipContent>Filled in by AI — please check</TooltipContent>
    </Tooltip>
  );
}

function L({ children, ai }: { children: React.ReactNode; ai: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {children}
      <AiMark show={ai} />
    </span>
  );
}

export function ReviewCard({
  draft,
  onChange,
  onSave,
  onDiscard,
  saving,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const touched = new Set(draft.touched);
    touched.add(k as string);
    onChange({ ...draft, [k]: v, touched });
  };
  const aiFilled = (k: string, has: boolean) => has && !draft.touched.has(k);
  const missing = missingFor(draft);
  const kinds: CaptureKind[] = ["task", "reminder", "event", "idea", "note"];
  const showDate = draft.kind === "task" || draft.kind === "reminder" || draft.kind === "event";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,16,32,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          AI suggests saving this as
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Item type">
          {kinds.map((k) => {
            const M = KIND_META[k];
            const Icon = M.icon;
            const active = draft.kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("kind", k)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-all",
                  active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-3.5", active && M.tint.split(" ")[0])} />
                {M.label}
                {active && k === draft.ai.kind && !draft.touched.has("kind") && <span className="text-[10px] text-primary">{Math.round(draft.ai.confidence * 100)}%</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 p-4">
        <Field label="Title">
          <Input value={draft.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!draft.title.trim()} className="font-medium" />
        </Field>

        {showDate && (
          <div className={cn("grid gap-3", draft.kind === "event" ? "grid-cols-3" : "grid-cols-2")}>
            <Field label={<L ai={aiFilled("date", !!draft.ai.date)}>{draft.kind === "task" ? "Due date" : "Date"}</L>}>
              <Input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} aria-invalid={draft.kind !== "task" && !draft.date} />
            </Field>
            <Field label={<L ai={aiFilled("time", !!draft.ai.time)}>{draft.kind === "event" ? "Starts" : "Time"}</L>}>
              <Input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} aria-invalid={draft.kind === "reminder" && !draft.time} />
            </Field>
            {draft.kind === "event" && (
              <Field label="Ends">
                <Input type="time" value={draft.end_time} onChange={(e) => set("end_time", e.target.value)} disabled={!draft.time} />
              </Field>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {draft.kind === "task" && (
            <Field
              label={<L ai={aiFilled("priority", draft.priorityFromAi)}>Priority</L>}
              hint={!draft.priorityFromAi && !draft.touched.has("priority") ? "Not mentioned — default" : undefined}
            >
              <PrioritySelect value={draft.priority} onChange={(p) => set("priority", p)} size="sm" />
            </Field>
          )}
          {draft.kind === "reminder" && (
            <Field label="Repeat">
              <RepeatSelect value={draft.repeat} onChange={(r) => set("repeat", r)} size="sm" />
            </Field>
          )}
          <Field label={<L ai={aiFilled("category_id", !!draft.category_id && !!draft.ai.category)}>Category</L>}>
            <CategorySelect value={draft.category_id} onChange={(c) => set("category_id", c)} size="sm" />
          </Field>
        </div>

        {(draft.kind === "idea" || draft.kind === "note") && (
          <Field label="Tags">
            <TagInput value={draft.tags} onChange={(t) => set("tags", t)} />
          </Field>
        )}

        <Field label={draft.kind === "note" ? "Content" : "Details"}>
          <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={draft.kind === "note" || draft.kind === "idea" ? 3 : 2} placeholder="Optional" />
        </Field>

        {draft.ai.interpretations.length > 0 && (
          <div className="rounded-lg bg-accent/60 px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-accent-foreground uppercase">
              <Sparkles className="size-3" /> How the AI interpreted this
            </p>
            <ul className="space-y-0.5 text-[12.5px] text-accent-foreground/90">
              {draft.ai.interpretations.map((i, idx) => (
                <li key={idx}>• {i}</li>
              ))}
            </ul>
          </div>
        )}
        {draft.ai.clarifications.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[oklch(0.5_0.13_60)] uppercase">
              <AlertCircle className="size-3" /> Needs your input
            </p>
            <ul className="space-y-0.5 text-[12.5px] text-foreground/80">
              {draft.ai.clarifications.map((c, idx) => (
                <li key={idx}>• {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        <p className={cn("text-[12px]", missing ? "text-[oklch(0.5_0.13_60)]" : "text-muted-foreground")}>{missing ?? "Nothing is saved until you approve."}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            <X /> Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={!!missing || saving}>
            <Check /> Save {KIND_META[draft.kind].label.toLowerCase()}
          </Button>
        </div>
      </div>
    </div>
  );
}
