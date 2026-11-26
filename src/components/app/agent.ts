"use client";
import * as React from "react";
import type { AgentAction, AgentFocus, AgentResponse, AgentTable } from "@/lib/ai/agent-types";
import { buildContext } from "@/lib/ai/context";
import { fromDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import { useT } from "@/lib/i18n/provider";
import type { TableMap } from "@/lib/types";

export interface AppliedChange {
  table: AgentTable;
  kind: "created" | "updated" | "deleted";
  id: string;
  title: string;
  category?: string | null;
  before?: Record<string, unknown>;
}

export interface AgentResult {
  reply: string;
  changes: AppliedChange[];
  /** Actions the AI asked for that could not be applied, with the reason. */
  failed: string[];
  simulated: boolean;
  error?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const PRIORITIES = ["low", "medium", "high", "urgent"];
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const date = (v: unknown) => (DATE.test(s(v)) ? s(v) : null);
const time = (v: unknown) => (TIME.test(s(v)) ? s(v).padStart(5, "0") : null);

/** Sends instructions to the agent and executes the returned actions right away. */
export function useAgent() {
  const data = useData();
  const { lang, t } = useT();
  const dataRef = React.useRef(data);
  dataRef.current = data;

  const send = React.useCallback(
    async (text: string, opts?: { focus?: AgentFocus | null; history?: { role: "user" | "assistant"; content: string }[] }): Promise<AgentResult> => {
      const d = dataRef.current;
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...(opts?.history ?? []), { role: "user", content: text }],
          context: buildContext(d),
          categories: d.categories.map((c) => ({ id: c.id, name: c.name })),
          focus: opts?.focus ?? null,
          language: lang,
        }),
      });
      const json = (await res.json()) as AgentResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("Something went wrong. Please try again."));
      const { applied, failed } = await execute(json.actions ?? []);
      let reply = json.reply;
      if (json.actions?.length && !applied.length) reply = t("Nothing was saved.");
      return { reply, changes: applied, failed, simulated: json.simulated, error: json.error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  );

  /** Applies actions in order. Unknown ids and invalid fields are skipped safely. */
  const execute = async (actions: AgentAction[]): Promise<{ applied: AppliedChange[]; failed: string[] }> => {
    const d = dataRef.current;
    const applied: AppliedChange[] = [];
    const failed: string[] = [];
    const fail = (what: string, why: string) => failed.push(`${what || "?"}: ${why}`);
    const refs = new Map<string, string>();
    const cats = new Map(d.categories.map((c) => [c.name.toLowerCase(), c.id]));
    const names = new Map(d.categories.map((c) => [c.id, c.name]));
    const catName = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);

    const categoryId = async (name: unknown): Promise<string | null> => {
      const n = s(name);
      if (!n) return null;
      const hit = cats.get(n.toLowerCase());
      if (hit) return hit;
      const created = await d.create("categories", { name: n.charAt(0).toUpperCase() + n.slice(1), color: ["blue", "green", "amber", "rose", "cyan", "orange", "slate"][cats.size % 7] }, { silent: true });
      if (!created) return null;
      cats.set(n.toLowerCase(), created.id);
      names.set(created.id, created.name);
      applied.push({ table: "categories", kind: "created", id: created.id, title: created.name });
      return created.id;
    };
    const resolve = (id: string) => refs.get(id) ?? id;
    const find = (table: AgentTable, id: string) => (dataRef.current[table] as { id: string }[]).find((r) => r.id === id) as Record<string, unknown> | undefined;

    const build = async (table: AgentTable, a: Record<string, unknown>, existing?: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      if ("title" in a && s(a.title)) row.title = s(a.title).slice(0, 300);
      if ("description" in a) row.description = s(a.description) || null;
      if ("category" in a) row.category_id = await categoryId(a.category);
      if (table === "tasks") {
        if ("due_date" in a) row.due_date = date(a.due_date);
        if ("due_time" in a) row.due_time = time(a.due_time);
        if (row.due_date === null) row.due_time = null;
        if (PRIORITIES.includes(s(a.priority))) row.priority = s(a.priority);
        if (["todo", "in_progress", "done"].includes(s(a.status))) {
          row.status = s(a.status);
          row.completed_at = row.status === "done" ? new Date().toISOString() : null;
        }
      }
      if (table === "notes") {
        if ("content" in a) row.content = typeof a.content === "string" ? a.content : "";
        if ("folder" in a) row.folder = s(a.folder) || null;
        if (Array.isArray(a.tags)) row.tags = a.tags.map((x) => String(x).toLowerCase().replace(/^#/, "")).slice(0, 10);
        if (typeof a.pinned === "boolean") row.pinned = a.pinned;
      }
      if (table === "ideas" && Array.isArray(a.tags)) row.tags = a.tags.map((x) => String(x).toLowerCase().replace(/^#/, "")).slice(0, 10);
      if (table === "reminders") {
        const prev = existing?.remind_at ? new Date(String(existing.remind_at)) : null;
        const dd = date(a.date) ?? (prev ? `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}` : null);
        const tt = time(a.time) ?? (prev ? `${String(prev.getHours()).padStart(2, "0")}:${String(prev.getMinutes()).padStart(2, "0")}` : null);
        if ((a.date || a.time) && dd && tt) {
          row.remind_at = fromDateKey(dd, tt).toISOString();
          row.status = "pending";
          row.last_notified_at = null;
        }
        if (["none", "daily", "weekdays", "weekly", "monthly"].includes(s(a.repeat))) row.repeat = s(a.repeat);
      }
      if (table === "events") {
        if (date(a.date)) row.start_date = date(a.date);
        if ("start_time" in a || "time" in a) row.start_time = time(a.start_time ?? a.time);
        if ("end_time" in a) row.end_time = time(a.end_time);
        if ("location" in a) row.location = s(a.location) || null;
      }
      return row;
    };

    for (const action of actions) {
      try {
        if (action.op === "create") {
          if (action.table === "categories") {
            const id = await categoryId(action.data.name);
            if (id && action.ref) refs.set(action.ref, id);
            continue;
          }
          const row = await build(action.table, action.data);
          if (!row.title) {
            fail(String(action.data.title ?? ""), t("missing title"));
            continue;
          }
          const base: Record<string, unknown> = { source: "ai" };
          if (action.table === "tasks") Object.assign(base, { priority: "medium", status: "todo", due_date: null, due_time: null, completed_at: null, description: null });
          if (action.table === "notes") Object.assign(base, { content: row.title, folder: catName(row.category_id as string) ?? null, tags: [], pinned: false });
          if (action.table === "ideas") Object.assign(base, { status: "new", tags: [], converted_task_id: null, description: null });
          if (action.table === "reminders") {
            if (!row.remind_at) {
              fail(String(row.title), t("missing date or time"));
              continue;
            }
            Object.assign(base, { repeat: "none", status: "pending", last_notified_at: null, task_id: null, description: null });
          }
          if (action.table === "events") {
            if (!row.start_date) {
              fail(String(row.title), t("missing date"));
              continue;
            }
            Object.assign(base, { start_time: null, end_time: null, location: null, description: null });
          }
          const created = await d.create(action.table as keyof TableMap, { ...base, ...row } as never, { silent: true, onError: (m) => fail(String(row.title), m) });
          if (created) {
            if (action.ref) refs.set(action.ref, created.id);
            const c = created as unknown as Record<string, unknown>;
            applied.push({ table: action.table, kind: "created", id: created.id, title: String(c.title ?? ""), category: catName(c.category_id as string) });
          }
        } else if (action.op === "update") {
          const id = resolve(action.id);
          const existing = find(action.table, id);
          if (!existing) {
            fail(String(action.data.title ?? action.data.name ?? id), t("item not found"));
            continue;
          }
          const row = action.table === "categories" ? { name: s(action.data.name) } : await build(action.table, action.data, existing);
          if (!Object.keys(row).length) continue;
          const before: Record<string, unknown> = {};
          for (const k of Object.keys(row)) before[k] = existing[k];
          const saved = await d.update(action.table as keyof TableMap, id, row as never, { silent: true, onError: (m) => fail(String(existing.title ?? existing.name ?? ""), m) });
          if (saved) applied.push({ table: action.table, kind: "updated", id, title: String((saved as unknown as Record<string, unknown>).title ?? (saved as unknown as Record<string, unknown>).name ?? ""), before });
        } else if (action.op === "delete") {
          const id = resolve(action.id);
          const existing = find(action.table, id);
          if (!existing) continue;
          const ok = await d.remove(action.table as keyof TableMap, id, { silent: true });
          if (ok) applied.push({ table: action.table, kind: "deleted", id, title: String(existing.title ?? existing.name ?? ""), before: existing });
        }
      } catch (e) {
        fail(String((action as { data?: Record<string, unknown> }).data?.title ?? ""), e instanceof Error ? e.message : "error");
      }
    }
    return { applied, failed };
  };

  /** Reverts changes in reverse order. */
  const undo = React.useCallback(async (changes: AppliedChange[]) => {
    const d = dataRef.current;
    for (const c of [...changes].reverse()) {
      if (c.kind === "created") await d.remove(c.table as keyof TableMap, c.id, { silent: true });
      else if (c.kind === "updated" && c.before) await d.update(c.table as keyof TableMap, c.id, c.before as never, { silent: true });
      else if (c.kind === "deleted" && c.before) {
        const { id: _i, user_id: _u, created_at: _c, updated_at: _up, ...rest } = c.before;
        void _i;
        void _u;
        void _c;
        void _up;
        await d.create(c.table as keyof TableMap, rest as never, { silent: true });
      }
    }
  }, []);

  return { send, undo };
}
