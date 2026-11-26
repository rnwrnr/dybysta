/**
 * Offline fallback for the agent (no OpenAI key). Much simpler than the real
 * model, but it still acts instead of asking: it saves and organizes items,
 * handles basic category commands, and applies simple voice edits.
 */
import { type Lang, translate } from "@/lib/i18n/core";
import type { AgentAction, AgentFocus } from "./agent-types";
import type { AssistantContext } from "./context";
import { heuristicAssistant } from "./heuristic-assistant";
import { heuristicCapture } from "./heuristic-capture";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.trim().replace(/^["«“']+|["»”'.!]+$/g, "").trim();

export function heuristicAgent(
  text: string,
  ctx: AssistantContext,
  categories: { id: string; name: string }[],
  focus: AgentFocus | null,
  lang: Lang
): { reply: string; actions: AgentAction[] } {
  const M = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const t = text.trim();
  const low = t.toLowerCase();
  const findCat = (name: string) => categories.find((c) => c.name.toLowerCase() === name.toLowerCase());

  // --- category / folder commands -------------------------------------------------
  let m = t.match(/(?:create|add|make|new)\s+(?:a\s+)?(?:new\s+)?(?:category|folder)\s+(?:called\s+|named\s+)?(.+)/i) ?? t.match(/(?:созда[йт]\w*|добав\w*|сдела\w*)\s+(?:нов\w+\s+)?(?:категори\w+|папк\w+)\s+(?:под названием\s+|с названием\s+)?(.+)/i) ?? t.match(/(.+?)\s+(?:деген\s+)?(?:санат|категория|папка)\w*\s+(?:жаса|құр|қос)/i);
  if (m) {
    const name = cap(clean(m[1]));
    if (findCat(name)) return { reply: M('Category "{name}" already exists.', { name }), actions: [] };
    return { reply: M('Created category "{name}".', { name }), actions: [{ op: "create", table: "categories", data: { name } }] };
  }
  m = t.match(/(?:delete|remove)\s+(?:the\s+)?(?:category|folder)\s+(.+)/i) ?? t.match(/(?:удали\w*)\s+(?:категори\w+|папк\w+)\s+(.+)/i);
  if (m) {
    const c = findCat(clean(m[1]));
    if (!c) return { reply: M('I couldn\'t find a category called "{name}".', { name: clean(m[1]) }), actions: [] };
    return { reply: M('Deleted category "{name}".', { name: c.name }), actions: [{ op: "delete", table: "categories", id: c.id }] };
  }
  m = t.match(/rename\s+(?:the\s+)?(?:category|folder)\s+(.+?)\s+to\s+(.+)/i) ?? t.match(/переименуй\s+(?:категори\w+|папк\w+)\s+(.+?)\s+в\s+(.+)/i);
  if (m) {
    const c = findCat(clean(m[1]));
    if (!c) return { reply: M('I couldn\'t find a category called "{name}".', { name: clean(m[1]) }), actions: [] };
    const name = cap(clean(m[2]));
    return { reply: M('Renamed "{from}" to "{to}".', { from: c.name, to: name }), actions: [{ op: "update", table: "categories", id: c.id, data: { name } }] };
  }

  // --- editing the item that is open --------------------------------------------
  if (focus) {
    const table = ({ task: "tasks", note: "notes", reminder: "reminders", idea: "ideas", event: "events" } as const)[focus.type];
    if (/^(delete|remove) (this|it)\b|^удали (это|её|его)|^өшір/i.test(low)) return { reply: M("Deleted."), actions: [{ op: "delete", table, id: focus.id }] };
    if (focus.type === "task" && /\b(done|finished|complete)\b|выполн|готово|сделал|орындалды|бітті/i.test(low))
      return { reply: M("Marked as done."), actions: [{ op: "update", table, id: focus.id, data: { status: "done" } }] };
    const rn = t.match(/^(?:rename(?: it)? to|change (?:the )?title to|переименуй(?: в)?|назови)\s+(.+)/i);
    if (rn) return { reply: M("Title updated."), actions: [{ op: "update", table, id: focus.id, data: { title: cap(clean(rn[1])) } }] };
    // Otherwise append the dictated text.
    const addition = cap(t.replace(/^(add|append|also|добавь|допиши|ещё|қос)\s*[:,-]?\s*/i, ""));
    const note = ctx.notes.find((n) => n.id === focus.id);
    const task = ctx.tasks.find((x) => x.id === focus.id);
    const idea = ctx.ideas.find((x) => x.id === focus.id);
    if (note) return { reply: M("Added to the note."), actions: [{ op: "update", table, id: focus.id, data: { content: `${note.content}${note.content ? "\n" : ""}${addition}` } }] };
    const base = task?.description ?? idea?.description ?? "";
    return { reply: M("Added to the details."), actions: [{ op: "update", table, id: focus.id, data: { description: `${base}${base ? "\n" : ""}${addition}` } }] };
  }

  // --- questions → answer from saved data -----------------------------------------
  if (/\?\s*$/.test(t) || /^(what|which|when|where|how|do i|did i|show|list|что|какие|какая|когда|где|сколько|покажи|не|қандай|қашан|қайда|қанша)\b/i.test(low)) {
    const a = heuristicAssistant(t, ctx, lang);
    return { reply: a.answer, actions: [] };
  }

  // --- everything else: save and organize -------------------------------------------
  const items = heuristicCapture(t, ctx.now, categories.map((c) => c.name), lang);
  const actions: AgentAction[] = [];
  const fallbackTopic = lang === "ru" ? "Входящие" : "Inbox";
  for (const it of items) {
    const category = it.category ?? fallbackTopic;
    if (it.kind === "reminder" && it.date && it.time)
      actions.push({ op: "create", table: "reminders", data: { title: it.title, date: it.date, time: it.time, repeat: it.repeat ?? "none", category } });
    else if (it.kind === "event" && it.date)
      actions.push({ op: "create", table: "events", data: { title: it.title, date: it.date, start_time: it.time, end_time: it.end_time, category } });
    else if (it.kind === "idea") actions.push({ op: "create", table: "ideas", data: { title: it.title, description: it.description, tags: it.tags, category } });
    else if (it.kind === "note") actions.push({ op: "create", table: "notes", data: { title: it.title, content: it.description ?? it.title, folder: category, category, tags: it.tags } });
    else actions.push({ op: "create", table: "tasks", data: { title: it.title, description: it.description, due_date: it.date, due_time: it.time, priority: it.priority ?? "medium", category } });
  }
  const kinds = actions.map((a) => M(a.table === "tasks" ? "task" : a.table === "notes" ? "note" : a.table === "ideas" ? "idea" : a.table === "events" ? "event" : "reminder"));
  return { reply: actions.length ? M("Saved: {what}.", { what: kinds.join(", ") }) : M("I didn't catch anything to save."), actions };
}
