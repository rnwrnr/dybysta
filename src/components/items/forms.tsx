"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fromDateKey, hhmm, toDateKey } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { CalendarEvent, Idea, IdeaStatus, Reminder, Task, TaskStatus } from "@/lib/types";
import { CategorySelect } from "./category-select";
import { Field, PrioritySelect, RepeatSelect, TagInput } from "./fields";

interface FormProps<T> {
  editing?: T | null;
  initial?: Partial<T>;
  onDone: (saved: T | null) => void;
}

function useConfirmDelete() {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return { armed, arm: () => setArmed(true) };
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const { armed, arm } = useConfirmDelete();
  return (
    <Button type="button" variant={armed ? "destructive" : "ghost"} size="sm" className="mr-auto" onClick={() => (armed ? onConfirm() : arm())}>
      <Trash2 /> {armed ? "Click again to delete" : "Delete"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
export function TaskForm({ editing, initial, onDone }: FormProps<Task>) {
  const { create, update, remove } = useData();
  const src = editing ?? initial ?? {};
  const [title, setTitle] = React.useState(src.title ?? "");
  const [description, setDescription] = React.useState(src.description ?? "");
  const [dueDate, setDueDate] = React.useState(src.due_date ?? "");
  const [dueTime, setDueTime] = React.useState(hhmm(src.due_time) ?? "");
  const [priority, setPriority] = React.useState(src.priority ?? "medium");
  const [status, setStatus] = React.useState<TaskStatus>(src.status ?? "todo");
  const [categoryId, setCategoryId] = React.useState<string | null>(src.category_id ?? null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const row: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueDate && dueTime ? dueTime : null,
      priority,
      status,
      category_id: categoryId,
      completed_at: status === "done" ? (editing?.completed_at ?? new Date().toISOString()) : null,
    };
    const saved = editing ? await update("tasks", editing.id, row) : await create("tasks", { ...row, source: initial?.source ?? "manual" });
    setSaving(false);
    if (saved) onDone(saved);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription className="sr-only">Task details</DialogDescription>
      </DialogHeader>
      <Field label="Title">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" required maxLength={300} />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} />
        </Field>
        <Field label="Priority">
          <PrioritySelect value={priority} onChange={setPriority} />
        </Field>
        <Field label="Category">
          <CategorySelect value={categoryId} onChange={setCategoryId} />
        </Field>
        {editing && (
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <DialogFooter>
        {editing && <DeleteButton onConfirm={async () => (await remove("tasks", editing.id)) && onDone(null)} />}
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {editing ? "Save changes" : "Create task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function ReminderForm({ editing, initial, onDone }: FormProps<Reminder>) {
  const { create, update, remove } = useData();
  const src = editing ?? initial ?? {};
  const at = src.remind_at ? new Date(src.remind_at) : null;
  const [title, setTitle] = React.useState(src.title ?? "");
  const [description, setDescription] = React.useState(src.description ?? "");
  const [date, setDate] = React.useState(at ? toDateKey(at) : "");
  const [time, setTime] = React.useState(at ? `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` : "");
  const [repeat, setRepeat] = React.useState(src.repeat ?? "none");
  const [categoryId, setCategoryId] = React.useState<string | null>(src.category_id ?? null);
  const [saving, setSaving] = React.useState(false);

  const when = date && time ? fromDateKey(date, time) : null;
  const inPast = when ? when < new Date() : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !when) return;
    setSaving(true);
    const row: Partial<Reminder> = {
      title: title.trim(),
      description: description.trim() || null,
      remind_at: when.toISOString(),
      repeat,
      category_id: categoryId,
      status: "pending",
      last_notified_at: null,
    };
    const saved = editing ? await update("reminders", editing.id, row) : await create("reminders", { ...row, task_id: initial?.task_id ?? null, source: initial?.source ?? "manual" });
    setSaving(false);
    if (saved) onDone(saved);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit reminder" : "New reminder"}</DialogTitle>
        <DialogDescription>You&apos;ll get an in-app notification{" "}at the time you choose — and a browser notification if you enabled it in Settings.</DialogDescription>
      </DialogHeader>
      <Field label="Remind me to…">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call the bank" required maxLength={300} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label="Repeat">
          <RepeatSelect value={repeat} onChange={setRepeat} />
        </Field>
        <Field label="Category">
          <CategorySelect value={categoryId} onChange={setCategoryId} />
        </Field>
      </div>
      {inPast && <p className="text-xs text-warning">This time is in the past — the reminder will fire right away.</p>}
      <Field label="Notes">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
      </Field>
      <DialogFooter>
        {editing && <DeleteButton onConfirm={async () => (await remove("reminders", editing.id)) && onDone(null)} />}
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim() || !when}>
          {editing ? "Save changes" : "Set reminder"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function EventForm({ editing, initial, onDone }: FormProps<CalendarEvent>) {
  const { create, update, remove } = useData();
  const src = editing ?? initial ?? {};
  const [title, setTitle] = React.useState(src.title ?? "");
  const [description, setDescription] = React.useState(src.description ?? "");
  const [date, setDate] = React.useState(src.start_date ?? "");
  const [start, setStart] = React.useState(hhmm(src.start_time) ?? "");
  const [end, setEnd] = React.useState(hhmm(src.end_time) ?? "");
  const [location, setLocation] = React.useState(src.location ?? "");
  const [categoryId, setCategoryId] = React.useState<string | null>(src.category_id ?? null);
  const [saving, setSaving] = React.useState(false);
  const badRange = Boolean(start && end && end <= start);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || badRange) return;
    setSaving(true);
    const row: Partial<CalendarEvent> = {
      title: title.trim(),
      description: description.trim() || null,
      start_date: date,
      start_time: start || null,
      end_time: start && end ? end : null,
      location: location.trim() || null,
      category_id: categoryId,
    };
    const saved = editing ? await update("events", editing.id, row) : await create("events", { ...row, source: initial?.source ?? "manual" });
    setSaving(false);
    if (saved) onDone(saved);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
        <DialogDescription className="sr-only">Event details</DialogDescription>
      </DialogHeader>
      <Field label="Title">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team meeting" required maxLength={300} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date" className="col-span-3 sm:col-span-1">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Starts">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Ends">
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} aria-invalid={badRange} />
        </Field>
      </div>
      {badRange && <p className="-mt-2 text-xs text-destructive">End time must be after the start time.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Category">
          <CategorySelect value={categoryId} onChange={setCategoryId} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
      </Field>
      <DialogFooter>
        {editing && <DeleteButton onConfirm={async () => (await remove("events", editing.id)) && onDone(null)} />}
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim() || !date || badRange}>
          {editing ? "Save changes" : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function IdeaForm({ editing, initial, onDone }: FormProps<Idea>) {
  const { create, update, remove } = useData();
  const src = editing ?? initial ?? {};
  const [title, setTitle] = React.useState(src.title ?? "");
  const [description, setDescription] = React.useState(src.description ?? "");
  const [tags, setTags] = React.useState<string[]>(src.tags ?? []);
  const [status, setStatus] = React.useState<IdeaStatus>(src.status ?? "new");
  const [categoryId, setCategoryId] = React.useState<string | null>(src.category_id ?? null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const row: Partial<Idea> = { title: title.trim(), description: description.trim() || null, tags, status, category_id: categoryId };
    const saved = editing ? await update("ideas", editing.id, row) : await create("ideas", { ...row, converted_task_id: null, source: initial?.source ?? "manual" });
    setSaving(false);
    if (saved) onDone(saved);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit idea" : "New idea"}</DialogTitle>
        <DialogDescription className="sr-only">Idea details</DialogDescription>
      </DialogHeader>
      <Field label="Idea">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short name for your idea" required maxLength={300} />
      </Field>
      <Field label="Details">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What's the idea? Why is it interesting?" />
      </Field>
      <Field label="Tags">
        <TagInput value={tags} onChange={setTags} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <CategorySelect value={categoryId} onChange={setCategoryId} />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as IdeaStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="exploring">Exploring</SelectItem>
              <SelectItem value="converted">Converted to task</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        {editing && <DeleteButton onConfirm={async () => (await remove("ideas", editing.id)) && onDone(null)} />}
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {editing ? "Save changes" : "Save idea"}
        </Button>
      </DialogFooter>
    </form>
  );
}
