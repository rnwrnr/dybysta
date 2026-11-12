"use client";
import { addDays, addMinutes, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import { toDateKey } from "@/lib/dates";
import type { Category, Profile, TableMap, TableName, UserPreferences } from "@/lib/types";
import { uid } from "@/lib/utils";
import { DEFAULT_CATEGORIES, DEFAULT_PREFERENCES, type DataBackend, type Snapshot } from "./backend";

const STORAGE_KEY = "dybysta:demo:data:v1";
const SESSION_KEY = "dybysta:demo:session";
const DEMO_USER = "demo-user";

export function getDemoSession(): { name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { name: string }) : null;
  } catch {
    return null;
  }
}

export function startDemoSession(name: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name }));
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed(name)));
  } else {
    const data = JSON.parse(existing) as Snapshot;
    data.profile.full_name = name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

function now() {
  return new Date().toISOString();
}

function seed(name: string): Snapshot {
  const created = now();
  const base = { user_id: DEMO_USER, created_at: created, updated_at: created };
  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({ id: uid(), user_id: DEMO_USER, created_at: created, ...c }));
  const cat = (n: string) => categories.find((c) => c.name === n)!.id;
  const today = new Date();
  const d = (offset: number) => toDateKey(addDays(today, offset));
  const at = (offset: number, h: number, m = 0) => setMinutes(setHours(startOfDay(addDays(today, offset)), h), m).toISOString();

  const tasks: TableMap["tasks"][] = [
    { id: uid(), ...base, title: "Finish marketing presentation", description: "Slides 8–14 still need data from the survey.", due_date: d(2), due_time: null, priority: "high", status: "in_progress", category_id: cat("Study"), completed_at: null, source: "ai" },
    { id: uid(), ...base, title: "Reply to internship email", description: null, due_date: d(0), due_time: "16:00", priority: "urgent", status: "todo", category_id: cat("Work"), completed_at: null, source: "manual" },
    { id: uid(), ...base, title: "Buy groceries", description: "Milk, oats, apples, coffee", due_date: d(0), due_time: null, priority: "low", status: "todo", category_id: cat("Personal"), completed_at: null, source: "manual" },
    { id: uid(), ...base, title: "Submit statistics homework", description: null, due_date: d(-1), due_time: "23:59", priority: "high", status: "todo", category_id: cat("Study"), completed_at: null, source: "manual" },
    { id: uid(), ...base, title: "Pay phone bill", description: null, due_date: d(-3), due_time: null, priority: "medium", status: "todo", category_id: cat("Finance"), completed_at: null, source: "manual" },
    { id: uid(), ...base, title: "Book dentist appointment", description: null, due_date: d(5), due_time: null, priority: "medium", status: "todo", category_id: cat("Health"), completed_at: null, source: "manual" },
    { id: uid(), ...base, title: "Read chapter 4 of Thinking, Fast and Slow", description: null, due_date: null, due_time: null, priority: "low", status: "todo", category_id: cat("Personal"), completed_at: null, source: "manual", created_at: subDays(today, 12).toISOString() },
    { id: uid(), ...base, title: "Update CV", description: null, due_date: d(-2), due_time: null, priority: "medium", status: "done", category_id: cat("Work"), completed_at: subDays(today, 2).toISOString(), source: "manual" },
  ];
  const reminders: TableMap["reminders"][] = [
    { id: uid(), ...base, title: "Call professor Ahmetova about thesis topic", description: null, remind_at: at(1, 15), repeat: "none", status: "pending", last_notified_at: null, task_id: null, category_id: cat("Study"), source: "ai" },
    { id: uid(), ...base, title: "Drink water & stretch", description: null, remind_at: addMinutes(today, 2).toISOString(), repeat: "none", status: "pending", last_notified_at: null, task_id: null, category_id: cat("Health"), source: "manual" },
    { id: uid(), ...base, title: "Weekly review", description: "Look at next week's plan", remind_at: at(3, 18), repeat: "weekly", status: "pending", last_notified_at: null, task_id: null, category_id: cat("Personal"), source: "manual" },
  ];
  const notes: TableMap["notes"][] = [
    { id: uid(), ...base, title: "Assem prefers afternoon meetings", content: "Remember that Assem prefers meetings in the afternoon — ideally after 14:00.", folder: "People", tags: ["team"], pinned: true, category_id: cat("Work"), source: "ai" },
    { id: uid(), ...base, title: "Thesis outline", content: "1. Introduction\n2. Literature review\n3. Methodology — survey of 120 students\n4. Results\n5. Discussion", folder: "University", tags: ["thesis"], pinned: false, category_id: cat("Study"), source: "manual" },
    { id: uid(), ...base, title: "Wi-Fi at the co-working", content: "Network: Hub-Guest. Ask at the reception for the weekly password.", folder: null, tags: [], pinned: false, category_id: null, source: "manual" },
  ];
  const ideas: TableMap["ideas"][] = [
    { id: uid(), ...base, title: "University marketplace", description: "A marketplace where students buy and sell used textbooks and dorm items, verified by university email.", tags: ["startup", "students"], status: "exploring", converted_task_id: null, category_id: cat("Work"), source: "ai", created_at: subDays(today, 6).toISOString() },
    { id: uid(), ...base, title: "Habit tracker for study groups", description: "Shared streaks to keep study groups accountable.", tags: ["app"], status: "new", converted_task_id: null, category_id: cat("Study"), source: "manual", created_at: subDays(today, 20).toISOString() },
  ];
  const events: TableMap["events"][] = [
    { id: uid(), ...base, title: "Team sync", description: null, start_date: d(0), start_time: "10:00", end_time: "10:30", location: "Zoom", category_id: cat("Work"), source: "manual" },
    { id: uid(), ...base, title: "Marketing lecture", description: null, start_date: d(1), start_time: "09:00", end_time: "10:30", location: "Room 204", category_id: cat("Study"), source: "manual" },
    { id: uid(), ...base, title: "Dinner with Dana", description: null, start_date: d(4), start_time: "19:30", end_time: null, location: null, category_id: cat("Personal"), source: "manual" },
  ];
  return {
    profile: { id: DEMO_USER, full_name: name, avatar_url: null, email: "demo@dybysta.local", created_at: created },
    preferences: { user_id: DEMO_USER, ...DEFAULT_PREFERENCES },
    categories,
    tasks,
    reminders,
    notes,
    ideas,
    events,
  };
}

/** Browser-local backend used when Supabase is not configured. Data never leaves this browser. */
export class DemoBackend implements DataBackend {
  mode = "demo" as const;

  private read(): Snapshot {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed(getDemoSession()?.name ?? "Guest");
      this.write(s);
      return s;
    }
    try {
      return JSON.parse(raw) as Snapshot;
    } catch {
      throw new Error("Local demo data is corrupted. Reset it from Settings → Account.");
    }
  }

  private write(s: Snapshot) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      throw new Error("Browser storage is full or unavailable.");
    }
  }

  async load() {
    const s = this.read();
    return { ...s, preferences: { ...DEFAULT_PREFERENCES, ...s.preferences } };
  }

  async insert<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]> {
    const s = this.read();
    const ts = now();
    const full = { ...row, id: uid(), user_id: DEMO_USER, created_at: ts, updated_at: ts } as unknown as TableMap[T];
    (s[table] as TableMap[T][]).unshift(full);
    this.write(s);
    return full;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<TableMap[T]> {
    const s = this.read();
    const list = s[table] as TableMap[T][];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error("Item not found — it may have been deleted.");
    const next = { ...list[idx], ...patch, id, updated_at: now() } as TableMap[T];
    list[idx] = next;
    this.write(s);
    return next;
  }

  async remove(table: TableName, id: string) {
    const s = this.read();
    (s[table] as { id: string }[]) = (s[table] as { id: string }[]).filter((r) => r.id !== id);
    if (table === "tasks") {
      s.reminders = s.reminders.map((r) => (r.task_id === id ? { ...r, task_id: null } : r));
      s.ideas = s.ideas.map((r) => (r.converted_task_id === id ? { ...r, converted_task_id: null } : r));
    }
    if (table === "categories") {
      for (const t of ["tasks", "reminders", "notes", "ideas", "events"] as const) {
        (s[t] as { category_id: string | null }[]) = (s[t] as { category_id: string | null }[]).map((r) =>
          r.category_id === id ? { ...r, category_id: null } : r
        );
      }
    }
    this.write(s);
  }

  async savePreferences(patch: Partial<UserPreferences>) {
    const s = this.read();
    s.preferences = { ...s.preferences, ...patch, user_id: DEMO_USER };
    this.write(s);
    return s.preferences;
  }

  async saveProfile(patch: Partial<Profile>) {
    const s = this.read();
    s.profile = { ...s.profile, full_name: patch.full_name ?? s.profile.full_name };
    this.write(s);
    const session = getDemoSession();
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify({ name: s.profile.full_name }));
    return s.profile;
  }

  async deleteAllData() {
    const s = this.read();
    this.write({ ...s, tasks: [], reminders: [], notes: [], ideas: [], events: [] });
  }

  async deleteAccount() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function resetDemoData() {
  const name = getDemoSession()?.name ?? "Guest";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed(name)));
}
