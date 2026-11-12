"use client";
import * as React from "react";
import { Bell, CalendarDays, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/app/dialogs";
import { type CalKind, CalendarView } from "@/components/calendar/calendar-view";
import { CategorySelect } from "@/components/items/category-select";
import { PageHeader } from "@/components/items/meta";
import { cn } from "@/lib/utils";

const TOGGLES: { kind: CalKind; label: string; icon: React.ElementType; on: string }[] = [
  { kind: "event", label: "Events", icon: CalendarDays, on: "bg-rose-50 text-rose-700 border-rose-200" },
  { kind: "task", label: "Tasks", icon: CheckCircle2, on: "bg-blue-50 text-blue-700 border-blue-200" },
  { kind: "reminder", label: "Reminders", icon: Bell, on: "bg-amber-50 text-amber-700 border-amber-200" },
];

export default function CalendarPage() {
  const { open } = useDialogs();
  const [kinds, setKinds] = React.useState<CalKind[]>(["event", "task", "reminder"]);
  const [category, setCategory] = React.useState<string | null>(null);
  const toggle = (k: CalKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Tasks, events and reminders in one place. Hover a day and press + to add."
        actions={
          <Button size="sm" onClick={() => open({ type: "event" })}>
            <Plus /> New event
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TOGGLES.map((t) => {
          const active = kinds.includes(t.kind);
          return (
            <button
              key={t.kind}
              onClick={() => toggle(t.kind)}
              aria-pressed={active}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors", active ? t.on : "bg-card text-muted-foreground hover:text-foreground")}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <CategorySelect allLabel="All categories" value={category} onChange={setCategory} size="sm" className="w-44" />
        </div>
      </div>
      <CalendarView kinds={kinds} categoryId={category} />
    </div>
  );
}
