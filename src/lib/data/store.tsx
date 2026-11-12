"use client";
import * as React from "react";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/config";
import type { Category, Profile, TableMap, TableName, UserPreferences } from "@/lib/types";
import type { DataBackend, Snapshot } from "./backend";
import { DemoBackend } from "./demo-backend";
import { SupabaseBackend } from "./supabase-backend";

interface AiStatus {
  configured: boolean;
  model: string | null;
}

interface DataContextValue extends Snapshot {
  mode: "supabase" | "demo";
  loading: boolean;
  error: string | null;
  ai: AiStatus;
  reload(): Promise<void>;
  create<T extends TableName>(table: T, row: Partial<TableMap[T]>, opts?: { silent?: boolean }): Promise<TableMap[T] | null>;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>, opts?: { silent?: boolean }): Promise<TableMap[T] | null>;
  remove(table: TableName, id: string, opts?: { silent?: boolean; label?: string }): Promise<boolean>;
  savePreferences(patch: Partial<UserPreferences>): Promise<boolean>;
  saveProfile(patch: Partial<Profile>): Promise<boolean>;
  categoryById(id: string | null | undefined): Category | undefined;
  ensureCategory(name: string | null | undefined): Promise<string | null>;
  backend: DataBackend;
}

const DataContext = React.createContext<DataContextValue | null>(null);

const EMPTY: Snapshot = {
  profile: { id: "", full_name: null, avatar_url: null, created_at: "" },
  preferences: {} as UserPreferences,
  tasks: [],
  reminders: [],
  notes: [],
  ideas: [],
  events: [],
  categories: [],
};

const LABELS: Record<TableName, string> = {
  tasks: "Task",
  reminders: "Reminder",
  notes: "Note",
  ideas: "Idea",
  events: "Event",
  categories: "Category",
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const backend = React.useMemo<DataBackend>(() => (isSupabaseConfigured ? new SupabaseBackend() : new DemoBackend()), []);
  const [data, setData] = React.useState<Snapshot>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [ai, setAi] = React.useState<AiStatus>({ configured: false, model: null });

  const reload = React.useCallback(async () => {
    try {
      setError(null);
      const snap = await backend.load();
      setData(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your data.");
    } finally {
      setLoading(false);
    }
  }, [backend]);

  React.useEffect(() => {
    reload();
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((s: AiStatus) => setAi(s))
      .catch(() => setAi({ configured: false, model: null }));
  }, [reload]);

  const create = React.useCallback<DataContextValue["create"]>(
    async (table, row, opts) => {
      try {
        const saved = await backend.insert(table, row);
        setData((d) => ({ ...d, [table]: [saved, ...(d[table] as unknown[])] }));
        if (!opts?.silent) toast.success(`${LABELS[table]} saved`);
        return saved;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
        return null;
      }
    },
    [backend]
  );

  const update = React.useCallback<DataContextValue["update"]>(
    async (table, id, patch, opts) => {
      // Optimistic update with rollback.
      let previous: Snapshot | null = null;
      setData((d) => {
        previous = d;
        return { ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
      });
      try {
        const saved = await backend.update(table, id, patch);
        setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? saved : r)) }));
        if (!opts?.silent) toast.success(`${LABELS[table]} updated`);
        return saved;
      } catch (e) {
        if (previous) setData(previous);
        toast.error(e instanceof Error ? e.message : "Could not update");
        return null;
      }
    },
    [backend]
  );

  const remove = React.useCallback<DataContextValue["remove"]>(
    async (table, id, opts) => {
      let previous: Snapshot | null = null;
      setData((d) => {
        previous = d;
        const next = { ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) } as Snapshot;
        if (table === "categories") {
          for (const t of ["tasks", "reminders", "notes", "ideas", "events"] as const) {
            (next[t] as { category_id: string | null }[]) = (next[t] as { category_id: string | null }[]).map((r) =>
              r.category_id === id ? { ...r, category_id: null } : r
            );
          }
        }
        return next;
      });
      try {
        await backend.remove(table, id);
        if (!opts?.silent) toast.success(`${opts?.label ?? LABELS[table]} deleted`);
        return true;
      } catch (e) {
        if (previous) setData(previous);
        toast.error(e instanceof Error ? e.message : "Could not delete");
        return false;
      }
    },
    [backend]
  );

  const savePreferences = React.useCallback(
    async (patch: Partial<UserPreferences>) => {
      try {
        const p = await backend.savePreferences(patch);
        setData((d) => ({ ...d, preferences: { ...d.preferences, ...p } }));
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save settings");
        return false;
      }
    },
    [backend]
  );

  const saveProfile = React.useCallback(
    async (patch: Partial<Profile>) => {
      try {
        const p = await backend.saveProfile(patch);
        setData((d) => ({ ...d, profile: p }));
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save profile");
        return false;
      }
    },
    [backend]
  );

  const categoryById = React.useCallback((id: string | null | undefined) => data.categories.find((c) => c.id === id), [data.categories]);

  const ensureCategory = React.useCallback(
    async (name: string | null | undefined) => {
      if (!name?.trim()) return null;
      const existing = data.categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (existing) return existing.id;
      const created = await create("categories", { name: name.trim(), color: "slate" }, { silent: true });
      return created?.id ?? null;
    },
    [data.categories, create]
  );

  const value: DataContextValue = {
    ...data,
    mode: backend.mode,
    loading,
    error,
    ai,
    reload,
    create,
    update,
    remove,
    savePreferences,
    saveProfile,
    categoryById,
    ensureCategory,
    backend,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = React.useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
