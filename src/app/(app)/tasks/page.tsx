"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { addDays, endOfWeek } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronDown, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDialogs } from "@/components/app/dialogs";
import { CalendarView } from "@/components/calendar/calendar-view";
import { CategorySelect } from "@/components/items/category-select";
import { EmptyState, PageHeader, PRIORITIES, priorityLabel } from "@/components/items/meta";
import { TaskRow } from "@/components/items/rows";
import { isTaskOverdue, toDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Priority, Task } from "@/lib/types";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "overdue" | "done" | "all";
type SortBy = "due" | "priority" | "created";
const PR = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function Group({ title, tasks, tone, defaultOpen = true }: { title: string; tasks: Task[]; tone?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (!tasks.length) return null;
  return (
    <section>
      <button onClick={() => setOpen((o) => !o)} className="mb-1 flex items-center gap-1.5 px-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        <span className={tone}>{title}</span>
        <span className="font-normal">{tasks.length}</span>
      </button>
      {open && (
        <div className="rounded-xl border bg-card p-1.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function TasksPageInner() {
  const { tasks } = useData();
  const { open } = useDialogs();
  const params = useSearchParams();
  const now = useNow(60_000);
  const [view, setView] = React.useState<"list" | "calendar">("list");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>(params.get("filter") === "overdue" ? "overdue" : "active");
  const [priority, setPriority] = React.useState<Priority | "all">("all");
  const [category, setCategory] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<SortBy>("due");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (category && t.category_id !== category) return false;
      if (status === "active" && t.status === "done") return false;
      if (status === "done" && t.status !== "done") return false;
      if (status === "overdue" && !isTaskOverdue(t, now)) return false;
      return true;
    });
  }, [tasks, query, priority, category, status, now]);

  const sorted = React.useMemo(() => {
    const s = [...filtered];
    if (sort === "priority") s.sort((a, b) => PR[a.priority] - PR[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    else if (sort === "created") s.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else s.sort((a, b) => `${a.due_date ?? "9999"}${a.due_time ?? "99"}`.localeCompare(`${b.due_date ?? "9999"}${b.due_time ?? "99"}`) || PR[a.priority] - PR[b.priority]);
    return s;
  }, [filtered, sort]);

  const today = toDateKey(now);
  const tomorrow = toDateKey(addDays(now, 1));
  const weekEnd = toDateKey(endOfWeek(now, { weekStartsOn: 1 }));
  const active = sorted.filter((t) => t.status !== "done");
  const groups = {
    overdue: active.filter((t) => isTaskOverdue(t, now)),
    today: active.filter((t) => t.due_date === today && !isTaskOverdue(t, now)),
    tomorrow: active.filter((t) => t.due_date === tomorrow),
    week: active.filter((t) => t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd),
    later: active.filter((t) => t.due_date && t.due_date > weekEnd && t.due_date > tomorrow),
    nodate: active.filter((t) => !t.due_date),
    done: sorted.filter((t) => t.status === "done"),
  };
  const grouped = sort === "due";

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${tasks.filter((t) => t.status !== "done").length} open · ${tasks.filter((t) => isTaskOverdue(t, now)).length} overdue`}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
              <TabsList>
                <TabsTrigger value="list">
                  <List /> List
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarDays /> Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={() => open({ type: "task" })}>
              <Plus /> New task
            </Button>
          </>
        }
      />

      {view === "calendar" ? (
        <div className="grid gap-3">
          <div className="flex justify-end">
            <CategorySelect allLabel="All categories" value={category} onChange={setCategory} size="sm" className="w-44" />
          </div>
          <CalendarView kinds={["task"]} categoryId={category} />
          <p className="text-[12px] text-muted-foreground">Tasks without a due date aren&apos;t shown in the calendar. Use + on a day to add one.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="h-8 pl-8 text-[13px]" aria-label="Search tasks" />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger size="sm" className="w-32" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="all">All tasks</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority | "all")}>
              <SelectTrigger size="sm" className="w-36" aria-label="Priority filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any priority</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CategorySelect allLabel="All categories" value={category} onChange={setCategory} size="sm" className="w-40" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortBy)}>
              <SelectTrigger size="sm" className="w-36" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Sort: Due date</SelectItem>
                <SelectItem value="priority">Sort: Priority</SelectItem>
                <SelectItem value="created">Sort: Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={tasks.length ? "No tasks match these filters" : "No tasks yet"}
              description={tasks.length ? "Try clearing the search or changing filters." : "Create a task, or use Quick capture to add one by voice."}
              action={
                <Button size="sm" onClick={() => open({ type: "task" })}>
                  <Plus /> New task
                </Button>
              }
            />
          ) : grouped ? (
            <div className="grid gap-5">
              <Group title="Overdue" tasks={groups.overdue} tone="text-destructive" />
              <Group title="Today" tasks={groups.today} />
              <Group title="Tomorrow" tasks={groups.tomorrow} />
              <Group title="This week" tasks={groups.week} />
              <Group title="Later" tasks={groups.later} />
              <Group title="No due date" tasks={groups.nodate} />
              <Group title="Completed" tasks={groups.done} defaultOpen={status === "done"} />
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-1.5">
              {sorted.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <React.Suspense>
      <TasksPageInner />
    </React.Suspense>
  );
}
