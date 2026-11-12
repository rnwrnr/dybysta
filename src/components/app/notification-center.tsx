"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, BellOff, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime, isActiveReminder, isReminderDue } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Reminder } from "@/lib/types";
import { useNow } from "@/hooks/use-now";
import { useReminderActions } from "./reminder-actions";

export function SnoozeMenu({ r, children }: { r: Reminder; children: React.ReactNode }) {
  const a = useReminderActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => a.snooze(r, 10)}>10 minutes</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.snooze(r, 30)}>30 minutes</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.snooze(r, 60)}>1 hour</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.snooze(r, 180)}>3 hours</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.snoozeUntilTomorrow(r)}>Tomorrow 09:00</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotificationCenter() {
  const { reminders, preferences } = useData();
  const now = useNow(15_000);
  const a = useReminderActions();
  const due = reminders.filter((r) => isReminderDue(r, now)).sort((x, y) => x.remind_at.localeCompare(y.remind_at));
  const soon = reminders
    .filter((r) => isActiveReminder(r) && new Date(r.remind_at) > now && new Date(r.remind_at).getTime() - now.getTime() < 86_400_000)
    .sort((x, y) => x.remind_at.localeCompare(y.remind_at));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${due.length ? `, ${due.length} due` : ""}`}>
          {preferences.notifications_enabled === false ? <BellOff /> : <Bell />}
          {due.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">{due.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Link href="/settings#notifications" className="text-[12px] text-muted-foreground hover:text-foreground">
            Settings
          </Link>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {due.length === 0 && soon.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">You&apos;re all caught up.</p>}
          {due.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Due now</p>}
          {due.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-destructive" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(r.remind_at)}</p>
                <div className="mt-1.5 flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => a.done(r)}>
                    <Check /> Done
                  </Button>
                  <SnoozeMenu r={r}>
                    <Button size="xs" variant="outline">
                      <Clock /> Snooze
                    </Button>
                  </SnoozeMenu>
                  <Button size="xs" variant="ghost" onClick={() => a.dismiss(r)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {soon.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Next 24 hours</p>}
          {soon.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2">
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate text-[13px]">{r.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(r.remind_at)}</span>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-2">
          <Link href="/reminders" className="text-[12px] font-medium text-primary hover:underline">
            View all reminders →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
