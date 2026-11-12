"use client";
import * as React from "react";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDialogs } from "@/components/app/dialogs";
import { CATEGORY_COLORS } from "@/components/items/meta";
import { formatTime, fromDateKey, isTaskOverdue, toDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { CalendarEvent, Reminder, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CalKind = "task" | "event" | "reminder";
type Entry =
  | { kind: "task"; id: string; title: string; time: string | null; item: Task; category: string | null; done: boolean; overdue: boolean }
  | { kind: "event"; id: string; title: string; time: string | null; item: CalendarEvent; category: string | null; done: false; overdue: false }
  | { kind: "reminder"; id: string; title: string; time: string | null; item: Reminder; category: string | null; done: boolean; overdue: false };

const KIND_STYLE: Record<CalKind, string> = {
  task: "bg-blue-50 text-blue-800 hover:bg-blue-100",
  event: "bg-rose-50 text-rose-800 hover:bg-rose-100",
  reminder: "bg-amber-50 text-amber-800 hover:bg-amber-100",
};
const KIND_ICON = { task: CheckCircle2, event: CalendarDays, reminder: Bell };

export function CalendarView({ kinds, categoryId }: { kinds: CalKind[]; categoryId: string | null }) {
  const { tasks, events, reminders, preferences, categoryById } = useData();
  const { open } = useDialogs();
  const [mode, setMode] = React.useState<"month" | "week">("month");
  const [cursor, setCursor] = React.useState(() => new Date());
  const weekStartsOn = (preferences.week_starts_on ?? 1) as 0 | 1;

  const byDay = React.useMemo(() => {
    const map = new Map<string, Entry[]>();
    const push = (key: string, e: Entry) => {
      if (categoryId && e.category !== categoryId) return;
      map.set(key, [...(map.get(key) ?? []), e]);
    };
    if (kinds.includes("task"))
      tasks.forEach((t) => t.due_date && push(t.due_date, { kind: "task", id: t.id, title: t.title, time: t.due_time, item: t, category: t.category_id, done: t.status === "done", overdue: isTaskOverdue(t) }));
    if (kinds.includes("event")) events.forEach((e) => push(e.start_date, { kind: "event", id: e.id, title: e.title, time: e.start_time, item: e, category: e.category_id, done: false, overdue: false }));
    if (kinds.includes("reminder"))
      reminders.forEach((r) => {
        const d = new Date(r.remind_at);
        push(toDateKey(d), { kind: "reminder", id: r.id, title: r.title, time: format(d, "HH:mm"), item: r, category: r.category_id, done: r.status === "done" || r.status === "dismissed", overdue: false });
      });
    for (const list of map.values()) list.sort((a, b) => (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));
    return map;
  }, [tasks, events, reminders, kinds, categoryId]);

  const days = React.useMemo(() => {
    const start = mode === "month" ? startOfWeek(startOfMonth(cursor), { weekStartsOn }) : startOfWeek(cursor, { weekStartsOn });
    const end = mode === "month" ? endOfWeek(endOfMonth(cursor), { weekStartsOn }) : endOfWeek(cursor, { weekStartsOn });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, mode, weekStartsOn]);

  const openEntry = (e: Entry) => {
    if (e.kind === "task") open({ type: "task", editing: e.item });
    else if (e.kind === "event") open({ type: "event", editing: e.item });
    else open({ type: "reminder", editing: e.item });
  };

  const createOn = (key: string, kind: CalKind) => {
    if (kind === "task") open({ type: "task", initial: { due_date: key } });
    if (kind === "event") open({ type: "event", initial: { start_date: key } });
    if (kind === "reminder") open({ type: "reminder", initial: { remind_at: fromDateKey(key, "09:00").toISOString() } });
  };

  const title = mode === "month" ? format(cursor, "MMMM yyyy") : `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;
  const prev = () => setCursor((c) => (mode === "month" ? subMonths(c, 1) : subWeeks(c, 1)));
  const next = () => setCursor((c) => (mode === "month" ? addMonths(c, 1) : addWeeks(c, 1)));

  const Chip = ({ e }: { e: Entry }) => {
    const Icon = KIND_ICON[e.kind];
    const cat = categoryById(e.category);
    return (
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          openEntry(e);
        }}
        title={`${e.title}${e.time ? " · " + formatTime(e.time) : ""}`}
        className={cn(
          "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors",
          KIND_STYLE[e.kind],
          e.done && "opacity-50 line-through",
          e.overdue && "ring-1 ring-destructive/40"
        )}
      >
        {cat ? <span className={cn("size-1.5 shrink-0 rounded-full", CATEGORY_COLORS[cat.color])} /> : <Icon className="size-2.5 shrink-0" />}
        {e.time && <span className="shrink-0 tabular-nums opacity-70">{formatTime(e.time)}</span>}
        <span className="truncate">{e.title}</span>
      </button>
    );
  };

  const AddMenu = ({ dayKey, className }: { dayKey: string; className?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100", className)} aria-label={`Add item on ${dayKey}`}>
          <Plus className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => createOn(dayKey, "task")}>
          <CheckCircle2 /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => createOn(dayKey, "event")}>
          <CalendarDays /> Event
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => createOn(dayKey, "reminder")}>
          <Bell /> Reminder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={prev} aria-label="Previous">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={next} aria-label="Next">
            <ChevronRight />
          </Button>
          <h2 className="ml-1 text-[15px] font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "month" | "week")}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
      <div className="min-w-[640px]">
      <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="px-2 py-1.5">
            {format(d, "EEE")}
          </div>
        ))}
      </div>

      {mode === "month" ? (
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = toDateKey(d);
            const entries = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                onDoubleClick={() => createOn(key, "task")}
                className={cn("group min-h-[104px] border-b p-1.5", i % 7 !== 6 && "border-r", !isSameMonth(d, cursor) && "bg-muted/25")}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[12px]",
                      isToday(d) ? "bg-primary font-semibold text-primary-foreground" : isSameMonth(d, cursor) ? "text-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  <AddMenu dayKey={key} />
                </div>
                <div className="grid gap-0.5">
                  {entries.slice(0, 3).map((e) => (
                    <Chip key={`${e.kind}-${e.id}`} e={e} />
                  ))}
                  {entries.length > 3 && (
                    <button onClick={() => { setCursor(d); setMode("week"); }} className="px-1.5 text-left text-[10.5px] text-muted-foreground hover:text-foreground">
                      +{entries.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = toDateKey(d);
            const entries = byDay.get(key) ?? [];
            return (
              <div key={key} className={cn("group min-h-[420px] p-2", i !== 6 && "border-r", isToday(d) && "bg-accent/30")}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-[13px] font-medium", isToday(d) && "bg-primary text-primary-foreground")}>{format(d, "d")}</span>
                  <AddMenu dayKey={key} />
                </div>
                <div className="grid gap-1">
                  {entries.map((e) => (
                    <Chip key={`${e.kind}-${e.id}`} e={e} />
                  ))}
                  {entries.length === 0 && <p className="pt-2 text-center text-[11px] text-muted-foreground/50">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
