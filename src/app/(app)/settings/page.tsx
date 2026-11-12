"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Database, Download, Globe, KeyRound, Lock, Palette, Plus, ShieldCheck, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_COLORS, COLOR_OPTIONS, PageHeader } from "@/components/items/meta";
import { resetDemoData } from "@/lib/data/demo-backend";
import { useData } from "@/lib/data/store";
import type { UserPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{title}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: React.ElementType; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="flex-col items-start gap-0.5 pb-1">
        <CardTitle>
          <Icon className="size-4 text-primary" /> {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="divide-y">{children}</CardContent>
    </Card>
  );
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ConfirmDialog({ open, onOpenChange, title, description, word, action, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; word: string; action: string; onConfirm: () => Promise<void> }) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setTyped(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <p className="text-[13px]">
            Type <span className="font-mono font-semibold">{word}</span> to confirm.
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Confirmation" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={typed !== word || busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onOpenChange(false);
            }}
          >
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  const data = useData();
  const { preferences: p, profile, categories, mode, ai } = data;
  const router = useRouter();
  const [name, setName] = React.useState(profile.full_name ?? "");
  const [newCat, setNewCat] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | "data" | "account">(null);
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("default");

  React.useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const save = async (patch: Partial<UserPreferences>) => {
    if (await data.savePreferences(patch)) toast.success("Settings saved");
  };

  const toggleBrowser = async (on: boolean) => {
    if (!on) return save({ browser_notifications: false });
    if (typeof Notification === "undefined") return toast.error("This browser doesn't support notifications.");
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return toast.error("Notification permission was denied. Enable it in your browser's site settings.");
    save({ browser_notifications: true });
  };

  const exportJson = () => {
    const { tasks, reminders, notes, ideas, events, categories: cats, preferences, profile: prof } = data;
    download(
      `dybysta-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ exported_at: new Date().toISOString(), profile: prof, preferences, categories: cats, tasks, reminders, events, notes, ideas }, null, 2),
      "application/json"
    );
    toast.success("Export downloaded");
  };
  const exportCsv = () => {
    const cols = ["title", "description", "due_date", "due_time", "priority", "status", "category", "created_at"] as const;
    const rows = data.tasks.map((t) => cols.map((c) => csvEscape(c === "category" ? data.categoryById(t.category_id)?.name : t[c])).join(","));
    download(`dybysta-tasks-${new Date().toISOString().slice(0, 10)}.csv`, [cols.join(","), ...rows].join("\n"), "text/csv");
    toast.success("Tasks CSV downloaded");
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n) return;
    if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return toast.error("That category already exists.");
    const color = COLOR_OPTIONS[categories.length % COLOR_OPTIONS.length];
    if (await data.create("categories", { name: n, color })) setNewCat("");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Everything here is in your control." />
      <nav className="mb-6 flex flex-wrap gap-1.5 text-[12px]">
        {[
          ["profile", "Profile"],
          ["language", "Language"],
          ["notifications", "Notifications"],
          ["privacy", "AI & privacy"],
          ["categories", "Categories"],
          ["data", "Data"],
          ["account", "Account"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border bg-card px-3 py-1 text-muted-foreground hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-5">
        <Section id="profile" icon={User} title="Profile">
          <Row title="Display name" description="Used in your greeting.">
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await data.saveProfile({ full_name: name.trim() || null })) toast.success("Profile saved");
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48 text-[13px]" maxLength={60} aria-label="Display name" />
              <Button size="sm" variant="outline" type="submit" disabled={name === (profile.full_name ?? "")}>
                Save
              </Button>
            </form>
          </Row>
          <Row title="Email" description={mode === "demo" ? "Demo accounts don't have an email." : "Your sign-in email."}>
            <span className="text-[13px] text-muted-foreground">{mode === "demo" ? "—" : profile.email}</span>
          </Row>
        </Section>

        <Section id="language" icon={Globe} title="Language" description="Voice recognition and AI response language.">
          <Row title="Voice input language" description="Used for speech-to-text. You can also switch it next to the microphone.">
            <Select value={p.voice_language} onValueChange={(v) => save({ voice_language: v as UserPreferences["voice_language"] })}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English</SelectItem>
                <SelectItem value="ru-RU">Русский</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row title="AI response language" description="Language for the assistant and the daily overview.">
            <Select value={p.ai_language} onValueChange={(v) => save({ ai_language: v as UserPreferences["ai_language"] })}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Match my question</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row title="Week starts on">
            <Select value={String(p.week_starts_on)} onValueChange={(v) => save({ week_starts_on: Number(v) as 0 | 1 })}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section id="notifications" icon={Bell} title="Notifications" description="Reminders notify you while DYBYSTA is open in a tab.">
          <Row title="Reminder notifications" description="Show a pop-up when a reminder is due. Turned off, reminders still appear in the bell menu.">
            <Switch checked={p.notifications_enabled} onCheckedChange={(v) => save({ notifications_enabled: v })} aria-label="Reminder notifications" />
          </Row>
          <Row
            title="Browser notifications"
            description={
              permission === "denied"
                ? "Blocked by your browser — allow notifications for this site to enable."
                : permission === "unsupported"
                  ? "Not supported in this browser."
                  : "System notifications when DYBYSTA is in a background tab."
            }
          >
            <div className="flex items-center gap-2">
              {p.browser_notifications && permission === "granted" && (
                <Button size="xs" variant="ghost" onClick={() => new Notification("DYBYSTA", { body: "Notifications are working 🎉", icon: "/icon.svg" })}>
                  Test
                </Button>
              )}
              <Switch checked={p.browser_notifications && permission === "granted"} disabled={!p.notifications_enabled || permission === "unsupported"} onCheckedChange={toggleBrowser} aria-label="Browser notifications" />
            </div>
          </Row>
          <Row title="Sound" description="Play a soft chime when a reminder is due.">
            <Switch checked={p.notification_sound} disabled={!p.notifications_enabled} onCheckedChange={(v) => save({ notification_sound: v })} aria-label="Sound" />
          </Row>
          <Row title="Default snooze" description="Used by the Snooze button on reminder pop-ups.">
            <Select value={String(p.default_snooze_minutes)} onValueChange={(v) => save({ default_snooze_minutes: Number(v) })}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 30, 60, 120].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row title="Quiet hours" description="No pop-ups or sounds during this window. Reminders wait in the bell menu.">
            <div className="flex items-center gap-2">
              <Input type="time" value={p.quiet_hours_start} disabled={!p.quiet_hours_enabled} onChange={(e) => e.target.value && save({ quiet_hours_start: e.target.value })} className="h-8 w-28 text-[13px]" aria-label="Quiet hours start" />
              <span className="text-muted-foreground">–</span>
              <Input type="time" value={p.quiet_hours_end} disabled={!p.quiet_hours_enabled} onChange={(e) => e.target.value && save({ quiet_hours_end: e.target.value })} className="h-8 w-28 text-[13px]" aria-label="Quiet hours end" />
              <Switch checked={p.quiet_hours_enabled} onCheckedChange={(v) => save({ quiet_hours_enabled: v })} aria-label="Quiet hours" />
            </div>
          </Row>
          <p className="pt-3 text-[12px] text-muted-foreground">Repeat frequency is set per reminder (daily, weekdays, weekly, monthly) when you create or edit it.</p>
        </Section>

        <Section id="privacy" icon={ShieldCheck} title="AI & privacy">
          <Row title="AI daily overview" description="Show an AI summary of your day on the dashboard.">
            <Switch checked={p.daily_overview_enabled} onCheckedChange={(v) => save({ daily_overview_enabled: v })} aria-label="AI daily overview" />
          </Row>
          <Row title="AI engine" description={ai.configured ? `OpenAI (${ai.model}) — configured by the server.` : "Simulated: no OpenAI key is configured, so a built-in rule-based parser runs on the server. Results are labeled “Simulated AI”."}>
            <span className={cn("rounded-md px-2 py-1 text-[12px] font-medium", ai.configured ? "bg-success/12 text-[oklch(0.45_0.12_155)]" : "bg-warning/15 text-[oklch(0.5_0.13_60)]")}>{ai.configured ? "Live" : "Demo"}</span>
          </Row>
          <div className="grid gap-2 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <p className="flex gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" />
              AI never saves anything on its own. Every task, reminder, idea, note and event from Quick capture waits for your approval.
            </p>
            <p className="flex gap-2">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {ai.configured
                ? "When you use AI features, only the text you submit (and, for the assistant and overview, a summary of your own saved items) is sent to OpenAI to generate the response. Voice is transcribed by your browser's speech service."
                : "With simulated AI, your text is processed by DYBYSTA's own server code and is not sent to any AI provider. Voice is transcribed by your browser's speech service."}
            </p>
            <p className="flex gap-2">
              <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {mode === "demo"
                ? "Demo mode: all your data is stored only in this browser's local storage."
                : "Your data is stored in Supabase and protected by row-level security — only your account can read or change it."}
            </p>
          </div>
        </Section>

        <Section id="categories" icon={Palette} title="Categories" description="Used to organize tasks, reminders, events, notes and ideas.">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2">
              <Select value={c.color} onValueChange={(color) => data.update("categories", c.id, { color }, { silent: true })}>
                <SelectTrigger size="sm" className="w-14 px-2" aria-label={`Color for ${c.name}`}>
                  <span className={cn("size-3 rounded-full", CATEGORY_COLORS[c.color])} />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((col) => (
                    <SelectItem key={col} value={col}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-3 rounded-full", CATEGORY_COLORS[col])} /> {col}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                defaultValue={c.name}
                className="h-8 flex-1 text-[13px]"
                aria-label="Category name"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) data.update("categories", c.id, { name: v });
                  else e.target.value = c.name;
                }}
              />
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => data.remove("categories", c.id, { label: `Category "${c.name}"` })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <form onSubmit={addCategory} className="flex gap-2 pt-3">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="h-8 text-[13px]" maxLength={60} />
            <Button size="sm" variant="outline" type="submit" disabled={!newCat.trim()}>
              <Plus /> Add
            </Button>
          </form>
          <p className="pt-2 text-[11.5px] text-muted-foreground">Deleting a category keeps its items — they just become uncategorized.</p>
        </Section>

        <Section id="data" icon={Download} title="Your data" description="Take your data with you at any time.">
          <Row title="Export everything" description="Tasks, reminders, events, notes, ideas, categories and settings as JSON.">
            <Button size="sm" variant="outline" onClick={exportJson}>
              <Download /> JSON
            </Button>
          </Row>
          <Row title="Export tasks" description="A spreadsheet-friendly CSV of your tasks.">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download /> CSV
            </Button>
          </Row>
        </Section>

        <Section id="account" icon={Lock} title="Account">
          <Row title={mode === "demo" ? "Leave demo" : "Sign out"} description={mode === "demo" ? "Your demo data stays in this browser." : undefined}>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await data.backend.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              {mode === "demo" ? "Leave demo" : "Sign out"}
            </Button>
          </Row>
          {mode === "demo" && (
            <Row title="Reset demo data" description="Restore the sample tasks, notes and ideas.">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  resetDemoData();
                  await data.reload();
                  toast.success("Demo data reset");
                }}
              >
                Reset
              </Button>
            </Row>
          )}
          <Row title="Delete all my items" description="Permanently delete every task, reminder, event, note and idea. Settings and categories are kept.">
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirm("data")}>
              Delete items
            </Button>
          </Row>
          <Row title="Delete account" description="Permanently delete your account and all data. This cannot be undone.">
            <Button size="sm" variant="destructive" onClick={() => setConfirm("account")}>
              Delete account
            </Button>
          </Row>
        </Section>
        <Separator className="opacity-0" />
      </div>

      <ConfirmDialog
        open={confirm === "data"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete all items?"
        description="Every task, reminder, event, note and idea will be permanently deleted."
        word="DELETE"
        action="Delete all items"
        onConfirm={async () => {
          try {
            await data.backend.deleteAllData();
            await data.reload();
            toast.success("All items deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete data");
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "account"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete your account?"
        description="Your account and all of its data will be permanently deleted."
        word="DELETE"
        action="Delete account"
        onConfirm={async () => {
          try {
            await data.backend.deleteAccount();
            router.replace("/");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete account");
          }
        }}
      />
    </div>
  );
}
