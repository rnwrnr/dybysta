"use client";
import * as React from "react";
import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { ArrowRight, CalendarClock, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaptureComposer } from "@/components/capture/capture-composer";
import { DailyOverview } from "@/components/dashboard/daily-overview";
import { EventRow, ReminderRow, TaskRow } from "@/components/items/rows";
import { eventStart, fmt, greeting, isActiveReminder, isTaskOverdue, toDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import { useT } from "@/lib/i18n/provider";
import { useNow } from "@/hooks/use-now";

const PR = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export default function DashboardPage() {
  const { profile, tasks, reminders, events } = useData();
  const { t, lang } = useT();
  const now = useNow(30_000);
  const today = toDateKey(now);
  const firstName = profile.full_name?.split(" ")[0];

  // Today: overdue first, then today's open tasks and events.
  const overdue = tasks.filter((x) => isTaskOverdue(x, now));
  const todayTasks = tasks.filter((x) => x.status !== "done" && x.due_date === today && !isTaskOverdue(x, now)).sort((a, b) => PR[a.priority] - PR[b.priority]);
  const todayEvents = events.filter((e) => e.start_date === today).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const todayCount = overdue.length + todayTasks.length + todayEvents.length;

  // Coming up: next reminders and events within a week.
  const weekEnd = addDays(startOfDay(now), 8);
  const upcoming = [
    ...reminders.filter((r) => isActiveReminder(r) && new Date(r.remind_at) < weekEnd).map((r) => ({ at: new Date(r.remind_at), node: <ReminderRow key={r.id} reminder={r} /> })),
    ...events.filter((e) => e.start_date > today && eventStart(e) < weekEnd).map((e) => ({ at: eventStart(e), node: <EventRow key={e.id} event={e} /> })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto grid max-w-4xl gap-8">
      <div className="text-center">
        <p className="text-[15px] text-muted-foreground">{fmt(now, lang === "ru" ? "EEEE, d MMMM" : "EEEE, MMMM d")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      <section aria-label={t("Capture")} className="rounded-3xl border bg-gradient-to-b from-sand-50 to-card px-4 py-8 sm:px-8">
        <CaptureComposer />
      </section>

      <DailyOverview />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[17px]">
              <Sun className="size-5 text-amber-600" /> {t("Today")}
            </CardTitle>
            <Link href="/tasks" className="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground">
              {t("All tasks")} <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-3">
            {todayCount === 0 ? (
              <p className="px-2 py-8 text-center text-[15px] text-muted-foreground">{t("Nothing due today. Enjoy the space — or capture something above.")}</p>
            ) : (
              <>
                {overdue.map((x) => (
                  <TaskRow key={x.id} task={x} />
                ))}
                {todayEvents.map((e) => (
                  <EventRow key={e.id} event={e} showDate={false} />
                ))}
                {todayTasks.map((x) => (
                  <TaskRow key={x.id} task={x} showDate={false} />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[17px]">
              <CalendarClock className="size-5 text-sand-700" /> {t("Coming up")}
            </CardTitle>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground">
              {t("Calendar")} <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-3">
            {upcoming.length === 0 ? <p className="px-2 py-8 text-center text-[15px] text-muted-foreground">{t("Nothing planned for the next 7 days.")}</p> : upcoming.map((u) => u.node)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
