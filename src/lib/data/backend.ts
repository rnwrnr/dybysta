import type { Lang } from "@/lib/i18n/core";
import type { Category, Profile, TableMap, TableName, UserPreferences } from "@/lib/types";

export interface Snapshot {
  profile: Profile;
  preferences: UserPreferences;
  tasks: TableMap["tasks"][];
  reminders: TableMap["reminders"][];
  notes: TableMap["notes"][];
  ideas: TableMap["ideas"][];
  events: TableMap["events"][];
  categories: Category[];
}

export interface DataBackend {
  mode: "supabase" | "demo";
  load(): Promise<Snapshot>;
  insert<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<TableMap[T]>;
  remove(table: TableName, id: string): Promise<void>;
  savePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences>;
  saveProfile(patch: Partial<Profile>): Promise<Profile>;
  deleteAllData(): Promise<void>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}

export const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  ui_language: "en",
  voice_language: "en-US",
  ai_language: "auto",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  week_starts_on: 1,
  notifications_enabled: true,
  browser_notifications: false,
  notification_sound: false,
  default_snooze_minutes: 10,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  daily_overview_enabled: true,
  ai_suggestions_enabled: true,
};

const CATEGORY_DEFS = [
  { key: "Work", ru: "Работа", color: "blue" },
  { key: "Personal", ru: "Личное", color: "violet" },
  { key: "Study", ru: "Учёба", color: "amber" },
  { key: "Health", ru: "Здоровье", color: "green" },
  { key: "Finance", ru: "Финансы", color: "rose" },
];

/** Default categories, named in the user's language. `key` is the stable English name. */
export function defaultCategories(lang: Lang) {
  return CATEGORY_DEFS.map((c) => ({ key: c.key, name: lang === "ru" ? c.ru : c.key, color: c.color }));
}

export const USER_TABLES: TableName[] = ["tasks", "reminders", "notes", "ideas", "events", "categories"];
