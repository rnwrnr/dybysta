"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Profile, TableMap, TableName, UserPreferences } from "@/lib/types";
import { DEFAULT_CATEGORIES, DEFAULT_PREFERENCES, type DataBackend, type Snapshot } from "./backend";

function fail(error: { message: string } | null, context: string): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** Converts empty strings to null for nullable DB columns so Postgres accepts them. */
function clean<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id" || k === "user_id" || k === "created_at" || k === "updated_at") continue;
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

export class SupabaseBackend implements DataBackend {
  mode = "supabase" as const;
  private sb: SupabaseClient = getSupabaseBrowser();
  private userId: string | null = null;

  private async uid(): Promise<string> {
    if (this.userId) return this.userId;
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error("You are signed out. Please sign in again.");
    this.userId = data.user.id;
    return data.user.id;
  }

  async load(): Promise<Snapshot> {
    const { data: auth, error: authErr } = await this.sb.auth.getUser();
    if (authErr || !auth.user) throw new Error("You are signed out. Please sign in again.");
    const user = auth.user;
    this.userId = user.id;

    const [profileRes, prefsRes, cats, tasks, reminders, notes, ideas, events] = await Promise.all([
      this.sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      this.sb.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
      this.sb.from("categories").select("*").order("created_at"),
      this.sb.from("tasks").select("*").order("created_at", { ascending: false }),
      this.sb.from("reminders").select("*").order("remind_at"),
      this.sb.from("notes").select("*").order("updated_at", { ascending: false }),
      this.sb.from("ideas").select("*").order("created_at", { ascending: false }),
      this.sb.from("events").select("*").order("start_date"),
    ]);
    for (const [res, name] of [
      [profileRes, "profile"],
      [prefsRes, "preferences"],
      [cats, "categories"],
      [tasks, "tasks"],
      [reminders, "reminders"],
      [notes, "notes"],
      [ideas, "ideas"],
      [events, "events"],
    ] as const) {
      if (res.error) fail(res.error, `Could not load ${name}`);
    }

    // Self-heal if the signup trigger was not installed.
    let profile = profileRes.data as Profile | null;
    if (!profile) {
      const { data, error } = await this.sb
        .from("profiles")
        .upsert({ id: user.id, full_name: (user.user_metadata?.full_name as string) ?? user.email?.split("@")[0] ?? null })
        .select()
        .single();
      if (error) fail(error, "Could not create profile");
      profile = data as Profile;
    }
    let preferences = prefsRes.data as UserPreferences | null;
    if (!preferences) {
      const { data, error } = await this.sb
        .from("user_preferences")
        .upsert({ user_id: user.id, ...DEFAULT_PREFERENCES })
        .select()
        .single();
      if (error) fail(error, "Could not create preferences");
      preferences = data as UserPreferences;
    }
    let categories = (cats.data ?? []) as TableMap["categories"][];
    if (categories.length === 0) {
      const { data, error } = await this.sb
        .from("categories")
        .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id })))
        .select();
      if (!error && data) categories = data as TableMap["categories"][];
    }

    return {
      profile: { ...profile, email: user.email ?? null },
      preferences: { ...preferences, quiet_hours_start: preferences.quiet_hours_start.slice(0, 5), quiet_hours_end: preferences.quiet_hours_end.slice(0, 5) },
      categories,
      tasks: (tasks.data ?? []) as TableMap["tasks"][],
      reminders: (reminders.data ?? []) as TableMap["reminders"][],
      notes: (notes.data ?? []) as TableMap["notes"][],
      ideas: (ideas.data ?? []) as TableMap["ideas"][],
      events: (events.data ?? []) as TableMap["events"][],
    };
  }

  async insert<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]> {
    const user_id = await this.uid();
    const { data, error } = await this.sb
      .from(table)
      .insert({ ...clean(row as Record<string, unknown>), user_id })
      .select()
      .single();
    if (error) fail(error, `Could not save to ${table}`);
    return data as TableMap[T];
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<TableMap[T]> {
    const { data, error } = await this.sb
      .from(table)
      .update(clean(patch as Record<string, unknown>))
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error, `Could not update ${table}`);
    return data as TableMap[T];
  }

  async remove(table: TableName, id: string): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq("id", id);
    if (error) fail(error, `Could not delete from ${table}`);
  }

  async savePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const user_id = await this.uid();
    const { user_id: _ignored, updated_at: _u, ...rest } = patch;
    void _ignored;
    void _u;
    const { data, error } = await this.sb.from("user_preferences").update(rest).eq("user_id", user_id).select().single();
    if (error) fail(error, "Could not save preferences");
    const p = data as UserPreferences;
    return { ...p, quiet_hours_start: p.quiet_hours_start.slice(0, 5), quiet_hours_end: p.quiet_hours_end.slice(0, 5) };
  }

  async saveProfile(patch: Partial<Profile>): Promise<Profile> {
    const id = await this.uid();
    const { data, error } = await this.sb
      .from("profiles")
      .update({ full_name: patch.full_name, avatar_url: patch.avatar_url })
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error, "Could not save profile");
    const { data: auth } = await this.sb.auth.getUser();
    return { ...(data as Profile), email: auth.user?.email ?? null };
  }

  async deleteAllData(): Promise<void> {
    const user_id = await this.uid();
    // Order matters for foreign keys (reminders/ideas reference tasks).
    for (const table of ["reminders", "ideas", "notes", "events", "tasks"] as const) {
      const { error } = await this.sb.from(table).delete().eq("user_id", user_id);
      if (error) fail(error, `Could not delete ${table}`);
    }
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.sb.rpc("delete_my_account");
    if (error) fail(error, "Could not delete account");
    await this.sb.auth.signOut();
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }
}
