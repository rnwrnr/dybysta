"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CaptureComposer } from "@/components/capture/capture-composer";
import { isReminderDue, isTaskOverdue, toDateKey } from "@/lib/dates";
import { getDemoSession } from "@/lib/data/demo-backend";
import { DataProvider, useData } from "@/lib/data/store";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { DialogsProvider, useDialogs } from "./dialogs";
import { Logo } from "./logo";
import { NotificationCenter } from "./notification-center";
import { ReminderScheduler } from "./reminder-scheduler";
import { isSupabaseConfigured } from "@/lib/config";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckCircle2 },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/assistant", label: "Assistant", icon: Bot },
];

function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { tasks, reminders } = useData();
  const now = useNow(60_000);
  const today = toDateKey(now);
  const counts: Record<string, number> = {
    "/tasks": tasks.filter((t) => t.status !== "done" && (isTaskOverdue(t, now) || t.due_date === today)).length,
    "/reminders": reminders.filter((r) => isReminderDue(r, now)).length,
  };
  return (
    <nav className="grid gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
              active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,16,32,0.06)] ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="flex-1">{item.label}</span>
            {counts[item.href] ? (
              <span className={cn("rounded px-1.5 text-[10px] font-semibold", item.href === "/reminders" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                {counts[item.href]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { profile, backend, mode } = useData();
  const router = useRouter();
  const signOut = async () => {
    await backend.signOut();
    router.replace("/login");
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-200 text-[11px] font-semibold text-primary">
            {initials(profile.full_name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{profile.full_name ?? "You"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{mode === "demo" ? "Demo account" : profile.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{profile.email ?? "Signed in"}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> {mode === "demo" ? "Leave demo" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { mode, ai } = useData();
  const { openCapture } = useDialogs();
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-1.5 pt-1">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <Button
        onClick={() => {
          onNavigate?.();
          openCapture();
        }}
        className="justify-start"
      >
        <Plus /> Quick capture
        <kbd className="ml-auto rounded bg-white/15 px-1.5 text-[10px] font-medium">C</kbd>
      </Button>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto grid gap-2">
        {(mode === "demo" || !ai.configured) && (
          <div className="rounded-lg border border-warning/30 bg-warning/8 p-2.5 text-[11.5px] leading-snug text-foreground/80">
            <p className="mb-0.5 flex items-center gap-1.5 font-semibold text-[oklch(0.5_0.13_60)]">
              <FlaskConical className="size-3.5" /> Demo mode
            </p>
            {mode === "demo" && <p>Data is stored only in this browser.</p>}
            {!ai.configured && <p>AI responses are simulated (no OpenAI key).</p>}
          </div>
        )}
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4" /> Settings
        </Link>
        <UserMenu />
      </div>
    </div>
  );
}

function CaptureDialog() {
  const { captureOpen, setCaptureOpen } = useDialogs();
  return (
    <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
      <DialogContent className="top-[12%] translate-y-0 sm:max-w-2xl" hideClose>
        <div className="flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2">Quick capture</DialogTitle>
          <span className="text-[11px] text-muted-foreground">Esc to close</span>
        </div>
        <DialogDescription className="-mt-2">Type or speak naturally. You&apos;ll review everything before it&apos;s saved.</DialogDescription>
        <CaptureComposer autoFocus compact onComplete={() => setCaptureOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Shortcuts() {
  const { openCapture } = useDialogs();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if ((e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        openCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCapture]);
  return null;
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { loading, error, reload, mode } = useData();
  const { openCapture } = useDialogs();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (error && /signed out/i.test(error) && mode === "supabase") router.replace("/login");
  }, [error, mode, router]);

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-72 max-w-72 translate-x-0 translate-y-0 rounded-none border-r p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:zoom-in-100" hideClose>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">Main navigation</DialogDescription>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md lg:px-8">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Link href="/dashboard" className="lg:hidden">
            <Logo withText={false} />
          </Link>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="soft" size="sm" onClick={openCapture}>
                <Plus /> <span className="hidden sm:inline">Capture</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick capture (C or ⌘K)</TooltipContent>
          </Tooltip>
          <NotificationCenter />
        </header>
        <main key={pathname} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 animate-in fade-in-0 duration-300 lg:px-8 lg:py-8">
          {loading ? (
            <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="mx-auto mt-20 max-w-md rounded-xl border bg-card p-6 text-center">
              <p className="font-medium">Something went wrong loading your data</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      {!loading && !error && <ReminderScheduler />}
      <CaptureDialog />
      <Shortcuts />
    </div>
  );
}

/** Client-side gate for demo mode (Supabase mode is protected by middleware). */
function DemoGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = React.useState(isSupabaseConfigured);
  React.useEffect(() => {
    if (isSupabaseConfigured) return;
    if (getDemoSession()) setOk(true);
    else router.replace("/login");
  }, [router]);
  if (!ok)
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoGate>
      <DataProvider>
        <DialogsProvider>
          <ShellInner>{children}</ShellInner>
        </DialogsProvider>
      </DataProvider>
    </DemoGate>
  );
}
