"use client";
import * as React from "react";
import Link from "next/link";
import { format, startOfDay, addDays } from "date-fns";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Lightbulb, Pin, Plus, StickyNote, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialogs } from "@/components/app/dialogs";
import { CaptureComposer } from "@/components/capture/capture-composer";
import { DailyOverview } from "@/components/dashboard/daily-overview";
import { EventRow, ReminderRow, TaskRow } from "@/components/items/rows";
import { eventStart, greeting, isActiveReminder, isTaskOverdue, relativeDayLabel, toDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import { useNow } from "@/hooks/use-now";

const PR = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function Stat({ label, value, icon: Icon, tone, href }: { label: string; value: number; icon: React.ElementType; tone: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:border-primary/25 hover:shadow-sm">
      <span className={`inline-flex size-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-lg leading-none font-semibold tabular-nums">{value}</span>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { profile, tasks, reminders, events, notes, ideas } = useData();
  const { open } = useDialogs();
  const now = useNow(30_000);
  const today = toDateKey(now);
  const firstName = profile.full_name?.split(" ")[0];

  const overdue = tasks.filter((t) => isTaskOverdue(t, now)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const todayTasks = tasks
    .filter((t) => t.due_date === today && !isTaskOverdue(t, now))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || PR[a.priority] - PR[b.priority] || (a.due_time ?? "99").localeCompare(b.due_time ?? "99"));
  const openToday = todayTasks.filter((t) => t.status !== "done").length;

  const weekEnd = addDays(startOfDay(now), 8);
  const upcomingReminders = reminders
    .filter((r) => isActiveReminder(r) && new Date(r.remind_at) < weekEnd)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
    .slice(0, 5);
  const commitments = [
    ...events.filter((e) => eventStart(e) >= startOfDay(now) && eventStart(e) < weekEnd).map((e) => ({ kind: "event" as const, at: eventStart(e), e })),
    ...tasks
      .filter((t) => t.status !== "done" && t.due_date && t.due_date > today && new Date(t.due_date) < weekEnd && (t.priority === "high" || t.priority === "urgent"))
      .map((t) => ({ kind: "task" as const, at: new Date(`${t.due_date}T${t.due_time?.slice(0, 5) ?? "23:59"}`), t })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 6);
  const recentNotes = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  const recentIdeas = ideas.filter((i) => i.status !== "archived").slice(0, 3);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[13px] text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      <section aria-label="Quick capture">
        <CaptureComposer />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due today" value={openToday} icon={Sun} tone="bg-blue-50 text-blue-600" href="/tasks" />
        <Stat label="Overdue" value={overdue.length} icon={AlertCircle} tone="bg-red-50 text-red-600" href="/tasks?filter=overdue" />
        <Stat label="Reminders this week" value={upcomingReminders.length} icon={CalendarClock} tone="bg-amber-50 text-amber-600" href="/reminders" />
        <Stat label="Ideas" value={ideas.filter((i) => i.status !== "archived").length} icon={Lightbulb} tone="bg-violet-50 text-violet-600" href="/ideas" />
      </div>

      <DailyOverview />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid content-start gap-6 lg:col-span-3">
          {overdue.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive">
                  <AlertCircle className="size-4" /> Overdue
                  <span className="rounded bg-destructive/10 px-1.5 text-[11px]">{overdue.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                {overdue.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
                {overdue.length > 5 && (
                  <Link href="/tasks?filter=overdue" className="block px-2 pt-1 text-[12px] text-muted-foreground hover:text-foreground">
                    +{overdue.length - 5} more
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <Sun className="size-4 text-blue-600" /> Today
                <span className="text-[12px] font-normal text-muted-foreground">
                  {todayTasks.length - openToday}/{todayTasks.length} done
                </span>
              </CardTitle>
              <Button variant="ghost" size="xs" onClick={() => open({ type: "task", initial: { due_date: today } })}>
                <Plus /> Add
              </Button>
            </CardHeader>
            <CardContent className="px-3">
              {todayTasks.length === 0 ? (
                <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">Nothing due today. Enjoy the space — or capture something above.</p>
              ) : (
                todayTasks.map((t) => <TaskRow key={t.id} task={t} showDate={false} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <StickyNote className="size-4 text-emerald-600" /> Recent notes
              </CardTitle>
              <Link href="/notes" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                All notes <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {recentNotes.length === 0 && <p className="py-4 text-[13px] text-muted-foreground">No notes yet.</p>}
              {recentNotes.map((n) => (
                <Link key={n.id} href={`/notes?id=${n.id}`} className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/25">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    {n.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                    {n.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{n.content}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <CalendarClock className="size-4 text-amber-600" /> Upcoming reminders
              </CardTitle>
              <Button variant="ghost" size="xs" onClick={() => open({ type: "reminder" })}>
                <Plus /> Add
              </Button>
            </CardHeader>
            <CardContent className="px-3">
              {upcomingReminders.length === 0 ? (
                <p className="px-2 py-4 text-[13px] text-muted-foreground">No reminders in the next 7 days.</p>
              ) : (
                upcomingReminders.map((r) => <ReminderRow key={r.id} reminder={r} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <CheckCircle2 className="size-4 text-rose-600" /> Upcoming commitments
              </CardTitle>
              <Link href="/calendar" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                Calendar <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="px-3">
              {commitments.length === 0 ? (
                <p className="px-2 py-4 text-[13px] text-muted-foreground">No events or important deadlines this week.</p>
              ) : (
                commitments.map((c) =>
                  c.kind === "event" ? (
                    <EventRow key={c.e.id} event={c.e} />
                  ) : (
                    <div key={c.t.id}>
                      <TaskRow task={c.t} />
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <Lightbulb className="size-4 text-violet-600" /> Latest ideas
              </CardTitle>
              <Link href="/ideas" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                All ideas <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="grid gap-1">
              {recentIdeas.length === 0 && <p className="py-2 text-[13px] text-muted-foreground">No ideas yet — they&apos;ll show up here.</p>}
              {recentIdeas.map((i) => (
                <button key={i.id} onClick={() => open({ type: "idea", editing: i })} className="rounded-md px-2 py-1.5 text-left hover:bg-muted/60">
                  <p className="truncate text-[13px] font-medium">{i.title}</p>
                  <p className="text-[11px] text-muted-foreground">{relativeDayLabel(new Date(i.created_at))}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
