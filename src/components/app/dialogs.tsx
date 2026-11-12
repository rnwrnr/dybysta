"use client";
import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EventForm, IdeaForm, ReminderForm, TaskForm } from "@/components/items/forms";
import type { CalendarEvent, Idea, Reminder, Task } from "@/lib/types";

type DialogState =
  | { type: "task"; editing?: Task | null; initial?: Partial<Task>; onSaved?: (t: Task) => void }
  | { type: "reminder"; editing?: Reminder | null; initial?: Partial<Reminder>; onSaved?: (r: Reminder) => void }
  | { type: "event"; editing?: CalendarEvent | null; initial?: Partial<CalendarEvent>; onSaved?: (e: CalendarEvent) => void }
  | { type: "idea"; editing?: Idea | null; initial?: Partial<Idea>; onSaved?: (i: Idea) => void };

interface DialogsValue {
  open(state: DialogState): void;
  openCapture(): void;
  captureOpen: boolean;
  setCaptureOpen(v: boolean): void;
}

const Ctx = React.createContext<DialogsValue | null>(null);

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState | null>(null);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const open = React.useCallback((s: DialogState) => {
    setKey((k) => k + 1);
    setState(s);
  }, []);
  const close = () => setState(null);

  const done = (saved: unknown) => {
    if (saved && state?.onSaved) (state.onSaved as (x: unknown) => void)(saved);
    close();
  };

  return (
    <Ctx.Provider value={{ open, openCapture: () => setCaptureOpen(true), captureOpen, setCaptureOpen }}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => !o && close()}>
        <DialogContent key={key} className="sm:max-w-lg">
          {state?.type === "task" && <TaskForm editing={state.editing} initial={state.initial} onDone={done} />}
          {state?.type === "reminder" && <ReminderForm editing={state.editing} initial={state.initial} onDone={done} />}
          {state?.type === "event" && <EventForm editing={state.editing} initial={state.initial} onDone={done} />}
          {state?.type === "idea" && <IdeaForm editing={state.editing} initial={state.initial} onDone={done} />}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useDialogs() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDialogs must be used inside <DialogsProvider>");
  return v;
}
