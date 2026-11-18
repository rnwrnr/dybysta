"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { toast } from "sonner";
import { inQuietHours, isReminderDue } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Reminder } from "@/lib/types";
import { useReminderActions } from "./reminder-actions";

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {
    /* audio not available */
  }
}

/**
 * Checks for due reminders every 15s while the app is open and notifies the user
 * according to their notification preferences.
 */
export function ReminderScheduler() {
  const { reminders, preferences, update, loading } = useData();
  const actions = useReminderActions();
  const { t } = useT();
  const tRef = React.useRef(t);
  tRef.current = t;
  const fired = React.useRef(new Set<string>());
  const stateRef = React.useRef({ reminders, preferences, actions });
  stateRef.current = { reminders, preferences, actions };

  const notify = React.useCallback(
    (r: Reminder) => {
      const { preferences: p, actions: a } = stateRef.current;
      const t = tRef.current;
      update("reminders", r.id, { last_notified_at: new Date().toISOString() }, { silent: true });
      if (!p.notifications_enabled) return;
      const quiet = p.quiet_hours_enabled && inQuietHours(p.quiet_hours_start, p.quiet_hours_end);
      if (quiet) return; // stays visible in the notification center
      toast(r.title, {
        id: `reminder-${r.id}`,
        description: r.description ?? t("Reminder"),
        duration: 30_000,
        icon: "🔔",
        action: { label: t("Snooze {n} min", { n: p.default_snooze_minutes }), onClick: () => a.snooze(r, p.default_snooze_minutes) },
        cancel: { label: t("Dismiss"), onClick: () => a.dismiss(r) },
      });
      if (p.notification_sound) beep();
      if (p.browser_notifications && typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        try {
          const n = new Notification(r.title, { body: r.description ?? t("DYBYSTA reminder"), tag: r.id, icon: "/icon.svg" });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* some browsers require a service worker for notifications */
        }
      }
    },
    [update]
  );

  React.useEffect(() => {
    if (loading) return;
    const tick = () => {
      const now = new Date();
      for (const r of stateRef.current.reminders) {
        const key = `${r.id}@${r.remind_at}`;
        if (!isReminderDue(r, now) || fired.current.has(key)) continue;
        if (r.last_notified_at && new Date(r.last_notified_at) >= new Date(r.remind_at)) {
          fired.current.add(key);
          continue;
        }
        fired.current.add(key);
        notify(r);
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [loading, notify]);

  return null;
}
