import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AgentAction, AgentFocus, AgentTable } from "./agent-types";
import type { AssistantContext } from "./context";
import { OPENAI_MODEL } from "./openai";

const str = { type: "string" } as const;
const opt = (d: string) => ({ type: "string", description: d });

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task (something the user needs to do).",
      parameters: {
        type: "object",
        properties: {
          title: opt("Short, clear, imperative title in the user's language"),
          description: opt("Extra details, or omit"),
          due_date: opt("YYYY-MM-DD, only if a day is stated or clearly implied"),
          due_time: opt("HH:mm 24h, only if a time is stated"),
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          category: opt("Topic category name. Reuse an existing one when it fits; otherwise a new short topic name"),
        },
        required: ["title", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Save information to remember (facts, preferences, thoughts, meeting notes).",
      parameters: {
        type: "object",
        properties: {
          title: opt("Short descriptive title"),
          content: opt("Clean, well-written note content capturing the meaning"),
          folder: opt("Folder (topic) for the note. Reuse an existing folder when it fits"),
          category: opt("Topic category name (usually the same topic as the folder)"),
          tags: { type: "array", items: str },
        },
        required: ["title", "content", "folder", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder that notifies the user at a specific moment.",
      parameters: {
        type: "object",
        properties: {
          title: str,
          date: opt("YYYY-MM-DD"),
          time: opt("HH:mm 24h"),
          repeat: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "monthly"] },
          category: str,
        },
        required: ["title", "date", "time", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create a calendar event (meeting, class, appointment) on a specific day.",
      parameters: {
        type: "object",
        properties: {
          title: str,
          date: opt("YYYY-MM-DD"),
          start_time: opt("HH:mm"),
          end_time: opt("HH:mm"),
          location: str,
          category: str,
        },
        required: ["title", "date", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_idea",
      description: "Save an idea.",
      parameters: {
        type: "object",
        properties: { title: str, description: str, tags: { type: "array", items: str }, category: str },
        required: ["title", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_item",
      description: "Change an existing task, note, reminder, idea or event. Only include fields that change. For notes, 'content' replaces the whole text, so include the full new content.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["task", "note", "reminder", "idea", "event"] },
          id: str,
          title: str,
          description: str,
          content: str,
          due_date: opt("YYYY-MM-DD, or empty string to clear"),
          due_time: opt("HH:mm, or empty string to clear"),
          date: opt("YYYY-MM-DD for reminders/events"),
          time: opt("HH:mm for reminders/events"),
          end_time: str,
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          category: str,
          folder: str,
          tags: { type: "array", items: str },
          pinned: { type: "boolean" },
        },
        required: ["type", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "Delete a task, note, reminder, idea or event.",
      parameters: { type: "object", properties: { type: { type: "string", enum: ["task", "note", "reminder", "idea", "event"] }, id: str }, required: ["type", "id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_category",
      description: "Create a category (also used as a folder/topic).",
      parameters: { type: "object", properties: { name: str }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_category",
      description: "Rename a category.",
      parameters: { type: "object", properties: { id: str, name: str }, required: ["id", "name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_category",
      description: "Delete a category (its items stay, uncategorized).",
      parameters: { type: "object", properties: { id: str }, required: ["id"] },
    },
  },
];

const TABLE: Record<string, AgentTable> = { task: "tasks", note: "notes", reminder: "reminders", idea: "ideas", event: "events" };

function systemPrompt(ctx: AssistantContext, categories: { id: string; name: string }[], focus: AgentFocus | null, lang: "en" | "ru") {
  const folders = [...new Set(ctx.notes.map((n) => n.folder).filter(Boolean))];
  return `You are DYBYSTA — a JARVIS-like personal assistant and the user's second brain. You act directly on the user's data by calling tools. You never ask for permission or confirmation: when the user tells you something, you execute it immediately.

Now: ${ctx.now.date} (${ctx.weekday}), ${ctx.now.time} local time.

HOW TO BEHAVE
- The user may speak Kazakh, Russian and English, often mixed in one sentence. Understand all three together.
- Understand the intent and context, don't copy words literally. Turn rambling speech into clean, well-phrased titles and notes (fix grammar, remove filler words like "ну", "эм", "like", "вообще").
- Decide what each thing is: an action to do → create_task; something to be notified about at a time → create_reminder; something scheduled → create_event; information to keep → create_note; an idea → create_idea. One message can contain several items — create all of them.
- If the user gives a command about the app ("create a category Entertainment", "delete that task", "move my gym notes to Health", "mark the presentation as done", "rename folder X"), perform it with the right tool.
- ALWAYS organize: every item gets a topic category. Reuse an existing category when it fits; create a new, short, general topic name (in the user's language) only when nothing fits. Every note also gets a folder (its topic). Never leave things unorganized and never ask where to put them.
- Resolve relative dates ("tomorrow", "ертең", "в пятницу") against the current date. Only set dates/times the user stated or clearly implied — don't invent specific times. If a reminder has no time, make it a task instead.
- To change or delete existing items, use their ids from the data below. Match items by meaning, not exact words.
- If the user only asks a question, answer it from the data (no tools). Never make up facts that aren't in the data.
- After acting, reply in ONE or TWO short sentences saying what you did (e.g. "Added a task 'Call professor' for tomorrow 15:00 in Study."). Reply in ${lang === "ru" ? "Russian" : "English"} unless the user clearly wrote in another language.
${focus ? `\nFOCUS: The user is currently looking at ${focus.type} id=${focus.id}. Their message is an instruction about THIS item — change, add to, or remove from it with update_item (or delete_item if asked). For notes, keep existing content unless told to remove it, and return the full updated content.` : ""}

EXISTING CATEGORIES (id: name): ${categories.map((c) => `${c.id}: ${c.name}`).join(" | ") || "none"}
EXISTING NOTE FOLDERS: ${folders.join(", ") || "none"}

USER DATA (JSON):
${JSON.stringify(ctx)}`;
}

/**
 * Runs a short tool-calling loop. Tools are not executed on the server — they are
 * collected as actions for the client, which owns the data (Supabase or local).
 */
export async function runOpenAIAgent(opts: {
  history: { role: "user" | "assistant"; content: string }[];
  ctx: AssistantContext;
  categories: { id: string; name: string }[];
  focus: AgentFocus | null;
  lang: "en" | "ru";
}): Promise<{ reply: string; actions: AgentAction[] }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt(opts.ctx, opts.categories, opts.focus, opts.lang) }, ...opts.history.slice(-8)];
  const actions: AgentAction[] = [];
  let refN = 0;

  for (let round = 0; round < 4; round++) {
    const res = await client.chat.completions.create({ model: OPENAI_MODEL, temperature: 0.2, messages, tools: TOOLS, tool_choice: "auto" });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return { reply: msg.content?.trim() || "", actions };

    for (const call of calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* ignore malformed */
      }
      let result: Record<string, unknown> = { ok: true };
      const name = call.function.name;
      if (name.startsWith("create_") && name !== "create_category") {
        const table = TABLE[name.replace("create_", "")];
        const ref = `$ref${++refN}`;
        actions.push({ op: "create", table, ref, data: args });
        result = { ok: true, id: ref };
      } else if (name === "create_category") {
        const ref = `$ref${++refN}`;
        actions.push({ op: "create", table: "categories", ref, data: { name: args.name } });
        result = { ok: true, id: ref };
      } else if (name === "update_item") {
        const { type, id, ...changes } = args as { type: string; id: string };
        if (TABLE[type] && id) actions.push({ op: "update", table: TABLE[type], id, data: changes });
      } else if (name === "delete_item") {
        const { type, id } = args as { type: string; id: string };
        if (TABLE[type] && id) actions.push({ op: "delete", table: TABLE[type], id });
      } else if (name === "rename_category") {
        actions.push({ op: "update", table: "categories", id: String(args.id), data: { name: args.name } });
      } else if (name === "delete_category") {
        actions.push({ op: "delete", table: "categories", id: String(args.id) });
      } else result = { ok: false, error: "unknown tool" };
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: "", actions };
}
