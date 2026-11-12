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

export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Work", color: "blue" },
  { name: "Personal", color: "violet" },
  { name: "Study", color: "amber" },
  { name: "Health", color: "green" },
  { name: "Finance", color: "rose" },
];

export const USER_TABLES: TableName[] = ["tasks", "reminders", "notes", "ideas", "events", "categories"];
