export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";
export type ReminderStatus = "pending" | "snoozed" | "dismissed" | "done";
export type ReminderRepeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type IdeaStatus = "new" | "exploring" | "converted" | "archived";
export type ItemSource = "manual" | "ai";
export type VoiceLanguage = "en-US" | "ru-RU";

interface Owned {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Task extends Owned {
  title: string;
  description: string | null;
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:mm[:ss]
  priority: Priority;
  status: TaskStatus;
  category_id: string | null;
  completed_at: string | null;
  source: ItemSource;
}

export interface Reminder extends Owned {
  title: string;
  description: string | null;
  remind_at: string; // ISO timestamp
  repeat: ReminderRepeat;
  status: ReminderStatus;
  last_notified_at: string | null;
  task_id: string | null;
  category_id: string | null;
  source: ItemSource;
}

export interface Note extends Owned {
  title: string;
  content: string;
  folder: string | null;
  tags: string[];
  pinned: boolean;
  category_id: string | null;
  source: ItemSource;
}

export interface Idea extends Owned {
  title: string;
  description: string | null;
  tags: string[];
  status: IdeaStatus;
  converted_task_id: string | null;
  category_id: string | null;
  source: ItemSource;
}

export interface CalendarEvent extends Owned {
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  category_id: string | null;
  source: ItemSource;
}

export interface UserPreferences {
  user_id: string;
  voice_language: VoiceLanguage;
  ai_language: "auto" | "en" | "ru";
  timezone: string;
  week_starts_on: 0 | 1;
  notifications_enabled: boolean;
  browser_notifications: boolean;
  notification_sound: boolean;
  default_snooze_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  daily_overview_enabled: boolean;
  ai_suggestions_enabled: boolean;
  updated_at?: string;
}

export interface TableMap {
  tasks: Task;
  reminders: Reminder;
  notes: Note;
  ideas: Idea;
  events: CalendarEvent;
  categories: Category;
}
export type TableName = keyof TableMap;

/** Fields the client supplies when creating a row (server fills id/user_id/timestamps). */
export type NewRow<T extends TableName> = Omit<TableMap[T], "id" | "user_id" | "created_at" | "updated_at">;

// ---------------------------------------------------------------------------
// AI capture
// ---------------------------------------------------------------------------
export type CaptureKind = "task" | "reminder" | "idea" | "note" | "event";

export interface ExtractedItem {
  kind: CaptureKind;
  title: string;
  description: string | null;
  date: string | null; // YYYY-MM-DD, only if user stated or clearly implied it
  time: string | null; // HH:mm
  end_time: string | null;
  priority: Priority | null;
  category: string | null;
  tags: string[];
  repeat: ReminderRepeat | null;
  /** 0..1 confidence in the classification */
  confidence: number;
  /** Human-readable notes about anything the AI had to interpret, e.g. "Interpreted '3' as 3:00 PM". */
  interpretations: string[];
  /** Questions to ask when required details are missing or ambiguous. */
  clarifications: string[];
}

export interface CaptureResponse {
  items: ExtractedItem[];
  simulated: boolean;
  model?: string;
  error?: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  references?: { type: CaptureKind; id: string; title: string }[];
  simulated?: boolean;
}
