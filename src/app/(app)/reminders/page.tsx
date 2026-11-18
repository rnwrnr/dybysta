"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { Bell, BellRing, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDialogs } from "@/components/app/dialogs";
import { EmptyState, PageHeader } from "@/components/items/meta";
import { ReminderRow } from "@/components/items/rows";
import { isActiveReminder, isReminderDue, relativeDayLabel } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import { useNow } from "@/hooks/use-now";
import Link from "next/link";

export default function RemindersPage() {
  const { reminders, preferences } = useData();
  const { open } = useDialogs();
  const now = useNow(15_000);
  const { t } = useT();
  const [tab, setTab] = React.useState<"upcoming" | "past">("upcoming");

  const due = reminders.filter((r) => isReminderDue(r, now)).sort((a, b) => a.remind_at.localeCompare(b.remind_at));
  const upcoming = reminders.filter((r) => isActiveReminder(r) && new Date(r.remind_at) > now).sort((a, b) => a.remind_at.localeCompare(b.remind_at));
  const past = reminders.filter((r) => !isActiveReminder(r)).sort((a, b) => b.remind_at.localeCompare(a.remind_at));

  const byDay = new Map<string, typeof upcoming>();
  for (const r of upcoming) {
    const label = relativeDayLabel(new Date(r.remind_at));
    byDay.set(label, [...(byDay.get(label) ?? []), r]);
  }

  return (
    <div>
      <PageHeader
        title={t("Reminders")}
        description={t("You decide when and how often you're notified.")}
        actions={
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
              <TabsList>
                <TabsTrigger value="upcoming">{t("Upcoming")}</TabsTrigger>
                <TabsTrigger value="past">{t("Done & dismissed")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={() => open({ type: "reminder" })}>
              <Plus /> {t("New reminder")}
            </Button>
          </>
        }
      />

      {!preferences.notifications_enabled && (
        <div className="mb-5 rounded-lg border border-warning/30 bg-warning/8 px-4 py-2.5 text-[13px]">
          {t("Notifications are turned off — reminders will only appear here and in the bell menu.")}{" "}
          <Link href="/settings#notifications" className="font-medium text-primary hover:underline">
            {t("Change in Settings")}
          </Link>
        </div>
      )}

      {tab === "upcoming" ? (
        <div className="grid gap-5">
          {due.length > 0 && (
            <section>
              <p className="mb-1 flex items-center gap-1.5 px-2 text-[12px] font-semibold text-destructive">
                <BellRing className="size-3.5" /> {t("Due now")}
              </p>
              <div className="rounded-xl border border-destructive/20 bg-card p-1.5">
                {due.map((r) => (
                  <ReminderRow key={r.id} reminder={r} />
                ))}
              </div>
            </section>
          )}
          {[...byDay.entries()].map(([label, list]) => (
            <section key={label}>
              <p className="mb-1 px-2 text-[12px] font-semibold text-muted-foreground">{label}</p>
              <div className="rounded-xl border bg-card p-1.5">
                {list.map((r) => (
                  <ReminderRow key={r.id} reminder={r} />
                ))}
              </div>
            </section>
          ))}
          {due.length === 0 && upcoming.length === 0 && (
            <EmptyState
              icon={Bell}
              title={t("No upcoming reminders")}
              description={t('Try Quick capture: "Remind me to call mom tomorrow at 7pm". You approve every reminder before it is created.')}
              action={
                <Button size="sm" onClick={() => open({ type: "reminder" })}>
                  <Plus /> {t("New reminder")}
                </Button>
              }
            />
          )}
        </div>
      ) : past.length ? (
        <div className="rounded-xl border bg-card p-1.5">
          {past.map((r) => (
            <ReminderRow key={r.id} reminder={r} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title={t("Nothing here yet")} description={t("Reminders you complete or dismiss will appear here.")} />
      )}
    </div>
  );
}
