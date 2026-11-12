"use client";
import { addMinutes, setHours, setMinutes, startOfDay, addDays } from "date-fns";
import { toast } from "sonner";
import { formatDateTime, nextOccurrence } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Reminder } from "@/lib/types";

export function useReminderActions() {
  const { update } = useData();

  const snooze = async (r: Reminder, minutes: number) => {
    const at = addMinutes(new Date(), minutes);
    const ok = await update("reminders", r.id, { remind_at: at.toISOString(), status: "snoozed", last_notified_at: null }, { silent: true });
    if (ok) toast(`Snoozed until ${formatDateTime(at.toISOString())}`, { description: r.title });
  };

  const snoozeUntilTomorrow = async (r: Reminder) => {
    const at = setMinutes(setHours(startOfDay(addDays(new Date(), 1)), 9), 0);
    const ok = await update("reminders", r.id, { remind_at: at.toISOString(), status: "snoozed", last_notified_at: null }, { silent: true });
    if (ok) toast(`Snoozed until tomorrow 09:00`, { description: r.title });
  };

  /** Closes the current occurrence. Repeating reminders move to their next occurrence. */
  const close = async (r: Reminder, status: "dismissed" | "done") => {
    if (r.repeat !== "none") {
      const next = nextOccurrence(new Date(r.remind_at), r.repeat);
      if (next) {
        const ok = await update("reminders", r.id, { remind_at: next.toISOString(), status: "pending", last_notified_at: null }, { silent: true });
        if (ok) toast(`Next reminder: ${formatDateTime(next.toISOString())}`, { description: r.title });
        return;
      }
    }
    const ok = await update("reminders", r.id, { status }, { silent: true });
    if (ok) toast(status === "done" ? "Marked as done" : "Reminder dismissed", { description: r.title });
  };

  const reopen = (r: Reminder) => update("reminders", r.id, { status: "pending", last_notified_at: null }, { silent: true });

  return { snooze, snoozeUntilTomorrow, dismiss: (r: Reminder) => close(r, "dismissed"), done: (r: Reminder) => close(r, "done"), reopen };
}
