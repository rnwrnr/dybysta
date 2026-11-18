"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { Bell, CalendarDays, CheckCircle2, Flag, Lightbulb, Sparkles, StickyNote, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useData } from "@/lib/data/store";
import type { CaptureKind, ItemSource, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS: Record<string, string> = {
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};
export const COLOR_OPTIONS = Object.keys(CATEGORY_COLORS);

export const KIND_META: Record<CaptureKind, { label: string; icon: LucideIcon; tint: string }> = {
  task: { label: "Task", icon: CheckCircle2, tint: "text-blue-600 bg-blue-50" },
  reminder: { label: "Reminder", icon: Bell, tint: "text-amber-600 bg-amber-50" },
  idea: { label: "Idea", icon: Lightbulb, tint: "text-violet-600 bg-violet-50" },
  note: { label: "Note", icon: StickyNote, tint: "text-emerald-600 bg-emerald-50" },
  event: { label: "Event", icon: CalendarDays, tint: "text-rose-600 bg-rose-50" },
};

export function useKindLabel() {
  const { t } = useT();
  return (k: CaptureKind) => t(KIND_META[k].label);
}

export function KindIcon({ kind, className }: { kind: CaptureKind; className?: string }) {
  const m = KIND_META[kind];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", m.tint, className)}>
      <Icon className="size-3.5" />
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "text-red-600" },
  high: { label: "High", cls: "text-orange-500" },
  medium: { label: "Medium", cls: "text-blue-500" },
  low: { label: "Low", cls: "text-slate-400" },
};
export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

export function PriorityFlag({ priority, showLabel }: { priority: Priority; showLabel?: boolean }) {
  const { t } = useT();
  const p = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", p.cls)} title={t("{p} priority", { p: t(p.label) })}>
      <Flag className="size-3" fill={priority === "urgent" || priority === "high" ? "currentColor" : "none"} />
      {showLabel && t(p.label)}
    </span>
  );
}
export function priorityLabel(p: Priority) {
  return PRIORITY_STYLE[p].label;
}

export function CategoryBadge({ id }: { id: string | null | undefined }) {
  const { categoryById } = useData();
  const c = categoryById(id);
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", CATEGORY_COLORS[c.color] ?? "bg-slate-400")} />
      {c.name}
    </span>
  );
}

export function AiBadge({ source, label = "AI" }: { source?: ItemSource; label?: string }) {
  const { t } = useT();
  if (source && source !== "ai") return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium text-primary/80 ring-1 ring-primary/15">
          <Sparkles className="size-2.5" />
          {t(label)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("Created from AI capture and approved by you")}</TooltipContent>
    </Tooltip>
  );
}

export function SimulatedBadge({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" className={cn("cursor-help", className)}>
          <Sparkles /> {t("Simulated AI")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t("No OpenAI key configured (or the AI service failed). This result comes from DYBYSTA's built-in rule-based parser.")}</TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
