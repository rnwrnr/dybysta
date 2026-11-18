import { addDays, addMonths, addWeeks, format, isSameDay, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { getCurrentLang, t } from "./i18n/core";
import type { CalendarEvent, Reminder, ReminderRepeat, Task } from "./types";

/** date-fns options for the active UI language. */
export function dfOpts() {
  return getCurrentLang() === "ru" ? { locale: ru } : {};
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Locale-aware format; Russian weekday/month names are capitalized at the start. */
export function fmt(d: Date, pattern: string) {
  return cap(format(d, pattern, dfOpts()));
}

/** Local calendar date → "YYYY-MM-DD" */
export function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** "YYYY-MM-DD" (+ optional "HH:mm") → local Date */
export function fromDateKey(key: string, time?: string | null): Date {
  const [y, m, d] = key.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh || 0, mm || 0, 0, 0);
}

export function hhmm(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

export function formatTime(time: string | null | undefined): string {
  const t = hhmm(time);
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, "HH:mm");
}

export function relativeDayLabel(d: Date): string {
  if (isToday(d)) return t("Today");
  if (isTomorrow(d)) return t("Tomorrow");
  if (isYesterday(d)) return t("Yesterday");
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  const isRu = getCurrentLang() === "ru";
  if (diff > 0 && diff < 7) return fmt(d, "EEEE");
  if (d.getFullYear() === new Date().getFullYear()) return fmt(d, isRu ? "EEEEEE, d MMM" : "EEE, MMM d");
  return fmt(d, isRu ? "d MMM yyyy" : "MMM d, yyyy");
}

export function formatDue(date: string | null, time: string | null): string {
  if (!date) return "";
  const d = fromDateKey(date, time);
  const day = relativeDayLabel(d);
  return time ? `${day}, ${formatTime(time)}` : day;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${relativeDayLabel(d)}, ${format(d, "HH:mm")}`;
}

/** Task is overdue when not done and its due moment (end of day if no time) has passed. */
export function isTaskOverdue(t: Task, now = new Date()): boolean {
  if (t.status === "done" || !t.due_date) return false;
  if (t.due_time) return fromDateKey(t.due_date, t.due_time) < now;
  return fromDateKey(t.due_date) < startOfDay(now);
}

export function taskDueDate(t: Task): Date | null {
  return t.due_date ? fromDateKey(t.due_date, t.due_time) : null;
}

export function eventStart(e: CalendarEvent): Date {
  return fromDateKey(e.start_date, e.start_time);
}

export function isActiveReminder(r: Reminder) {
  return r.status === "pending" || r.status === "snoozed";
}

export function isReminderDue(r: Reminder, now = new Date()) {
  return isActiveReminder(r) && new Date(r.remind_at) <= now;
}

export function nextOccurrence(from: Date, repeat: ReminderRepeat, now = new Date()): Date | null {
  if (repeat === "none") return null;
  let next = new Date(from);
  const step = (d: Date) => {
    switch (repeat) {
      case "daily":
        return addDays(d, 1);
      case "weekdays": {
        let n = addDays(d, 1);
        while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1);
        return n;
      }
      case "weekly":
        return addWeeks(d, 1);
      case "monthly":
        return addMonths(d, 1);
      default:
        return d;
    }
  };
  let guard = 0;
  do {
    next = step(next);
    guard++;
  } while (next <= now && guard < 1000);
  return next;
}

export function sameDay(a: Date, b: Date) {
  return isSameDay(a, b);
}

/** Value for <input type="datetime-local"> */
export function toLocalInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return t("Good night");
  if (h < 12) return t("Good morning");
  if (h < 18) return t("Good afternoon");
  return t("Good evening");
}

const REPEAT_EN: Record<ReminderRepeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
};
export const REPEAT_KEYS = Object.keys(REPEAT_EN) as ReminderRepeat[];
export function repeatLabel(r: ReminderRepeat) {
  return t(REPEAT_EN[r]);
}

export function inQuietHours(start: string, end: string, now = new Date()): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}
