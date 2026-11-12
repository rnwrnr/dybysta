import { format } from "date-fns";
import type { Snapshot } from "@/lib/data/backend";
import type { Priority } from "@/lib/types";
import type { LocalNow } from "./heuristic-capture";

export interface AssistantContext {
  now: LocalNow;
  weekday: string;
  tasks: { id: string; title: string; description: string | null; due_date: string | null; due_time: string | null; priority: Priority; status: string; category: string | null; created: string }[];
  reminders: { id: string; title: string; at: string; repeat: string; status: string }[];
  events: { id: string; title: string; date: string; start_time: string | null; end_time: string | null; location: string | null; category: string | null }[];
  notes: { id: string; title: string; content: string; folder: string | null; tags: string[]; pinned: boolean; updated: string }[];
  ideas: { id: string; title: string; description: string | null; tags: string[]; status: string; created: string }[];
}

export function localNow(d = new Date()): LocalNow {
  return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
}

const day = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

/** Compact, user-owned context sent to the AI. Only the user's own saved data. */
export function buildContext(s: Pick<Snapshot, "tasks" | "reminders" | "events" | "notes" | "ideas" | "categories">): AssistantContext {
  const cat = (id: string | null) => s.categories.find((c) => c.id === id)?.name ?? null;
  const now = new Date();
  return {
    now: localNow(now),
    weekday: format(now, "EEEE"),
    tasks: s.tasks.slice(0, 300).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description?.slice(0, 300) ?? null,
      due_date: t.due_date,
      due_time: t.due_time?.slice(0, 5) ?? null,
      priority: t.priority,
      status: t.status,
      category: cat(t.category_id),
      created: day(t.created_at),
    })),
    reminders: s.reminders.slice(0, 200).map((r) => ({
      id: r.id,
      title: r.title,
      at: format(new Date(r.remind_at), "yyyy-MM-dd HH:mm"),
      repeat: r.repeat,
      status: r.status,
    })),
    events: s.events.slice(0, 200).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.start_date,
      start_time: e.start_time?.slice(0, 5) ?? null,
      end_time: e.end_time?.slice(0, 5) ?? null,
      location: e.location,
      category: cat(e.category_id),
    })),
    notes: s.notes.slice(0, 150).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content.slice(0, 600),
      folder: n.folder,
      tags: n.tags,
      pinned: n.pinned,
      updated: day(n.updated_at),
    })),
    ideas: s.ideas.slice(0, 150).map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description?.slice(0, 400) ?? null,
      tags: i.tags,
      status: i.status,
      created: day(i.created_at),
    })),
  };
}
