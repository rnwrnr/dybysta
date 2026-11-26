"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { AlertCircle, Bell, CalendarDays, Check, Clock, MapPin, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDialogs } from "@/components/app/dialogs";
import { SnoozeMenu } from "@/components/app/notification-center";
import { useReminderActions } from "@/components/app/reminder-actions";
import { formatDateTime, formatDue, formatTime, isReminderDue, isTaskOverdue, repeatLabel } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { CalendarEvent, Reminder, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AiBadge, CategoryBadge, PriorityFlag } from "./meta";

export function TaskRow({ task, showDate = true, compact }: { task: Task; showDate?: boolean; compact?: boolean }) {
  const { update, remove } = useData();
  const { open } = useDialogs();
  const { t } = useT();
  const done = task.status === "done";
  const overdue = isTaskOverdue(task);

  const toggle = (checked: boolean) =>
    update("tasks", task.id, { status: checked ? "done" : "todo", completed_at: checked ? new Date().toISOString() : null }, { silent: true });

  return (
    <div className={cn("group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60", compact && "py-1.5")}>
      <Checkbox checked={done} onCheckedChange={(c) => toggle(c === true)} className="mt-0.5" aria-label={done ? t('Mark "{title}" as not done', { title: task.title }) : t('Complete "{title}"', { title: task.title })} />
      <button className="min-w-0 flex-1 text-left" onClick={() => open({ type: "task", editing: task })}>
        <p className={cn("text-[15px] leading-snug", done && "text-muted-foreground line-through")}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {showDate && task.due_date && (
            <span className={cn("inline-flex items-center gap-1 text-[12.5px]", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {overdue ? <AlertCircle className="size-3" /> : <CalendarDays className="size-3" />}
              {overdue && `${t("Overdue")} · `}
              {formatDue(task.due_date, task.due_time)}
            </span>
          )}
          {!showDate && task.due_time && (
            <span className={cn("inline-flex items-center gap-1 text-[12.5px]", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              <Clock className="size-3" /> {formatTime(task.due_time)}
            </span>
          )}
          {!done && task.priority !== "medium" && <PriorityFlag priority={task.priority} showLabel />}
          <CategoryBadge id={task.category_id} />
          {task.status === "in_progress" && <span className="text-[12.5px] text-blue-600">{t("In progress")}</span>}
          <AiBadge source={task.source} />
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={t("Task actions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => open({ type: "task", editing: task })}>
            <Pencil /> {t("Edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              open({
                type: "reminder",
                initial: { title: task.title, task_id: task.id, category_id: task.category_id, remind_at: task.due_date ? new Date(`${task.due_date}T${task.due_time?.slice(0, 5) ?? "09:00"}`).toISOString() : undefined },
              })
            }
          >
            <Bell /> {t("Add reminder")}
          </DropdownMenuItem>
          {task.status !== "in_progress" && !done && (
            <DropdownMenuItem onClick={() => update("tasks", task.id, { status: "in_progress" }, { silent: true })}>
              <Clock /> {t("Mark in progress")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => remove("tasks", task.id)}>
            <Trash2 /> {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ReminderRow({ reminder: r }: { reminder: Reminder }) {
  const { open } = useDialogs();
  const { remove } = useData();
  const a = useReminderActions();
  const { t } = useT();
  const due = isReminderDue(r);
  const inactive = r.status === "done" || r.status === "dismissed";
  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60">
      <span className={cn("mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full", due ? "bg-destructive/10 text-destructive" : inactive ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-600")}>
        <Bell className="size-3" />
      </span>
      <button className="min-w-0 flex-1 text-left" onClick={() => open({ type: "reminder", editing: r })}>
        <p className={cn("text-[15px] leading-snug", inactive && "text-muted-foreground line-through")}>{r.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", due && "font-medium text-destructive")}>
            <Clock className="size-3" />
            {due ? `${t("Due")} · ` : ""}
            {formatDateTime(r.remind_at)}
          </span>
          {r.status === "snoozed" && <span className="text-amber-600">{t("Snoozed")}</span>}
          {r.repeat !== "none" && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" /> {repeatLabel(r.repeat)}
            </span>
          )}
          <CategoryBadge id={r.category_id} />
          <AiBadge source={r.source} />
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        {!inactive && (
          <>
            <Button variant="ghost" size="icon-xs" onClick={() => a.done(r)} aria-label={t("Mark done")} title={t("Done")}>
              <Check />
            </Button>
            <SnoozeMenu r={r}>
              <Button variant="ghost" size="icon-xs" aria-label={t("Snooze")} title={t("Snooze")}>
                <Clock />
              </Button>
            </SnoozeMenu>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t("Reminder actions")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => open({ type: "reminder", editing: r })}>
              <Pencil /> {t("Edit")}
            </DropdownMenuItem>
            {inactive ? (
              <DropdownMenuItem onClick={() => a.reopen(r)}>
                <Repeat /> {t("Reactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => a.dismiss(r)}>{t("Dismiss")}</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => remove("reminders", r.id)}>
              <Trash2 /> {t("Delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function EventRow({ event: e, showDate = true }: { event: CalendarEvent; showDate?: boolean }) {
  const { open } = useDialogs();
  const { t } = useT();
  return (
    <button onClick={() => open({ type: "event", editing: e })} className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60">
      <span className="mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <CalendarDays className="size-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{e.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12.5px] text-muted-foreground">
          <span>
            {showDate ? formatDue(e.start_date, e.start_time) : e.start_time ? formatTime(e.start_time) : t("All day")}
            {e.end_time && ` – ${formatTime(e.end_time)}`}
          </span>
          {e.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {e.location}
            </span>
          )}
          <CategoryBadge id={e.category_id} />
          <AiBadge source={e.source} />
        </span>
      </span>
    </button>
  );
}
