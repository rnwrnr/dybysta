import "server-only";
import OpenAI from "openai";
import type { ExtractedItem } from "@/lib/types";
import type { AssistantContext } from "./context";
import type { LocalNow } from "./heuristic-capture";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const isOpenAIConfigured = () => Boolean(process.env.OPENAI_API_KEY);

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
  return client;
}

const nullableString = { type: ["string", "null"] };

const CAPTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind", "title", "description", "date", "date_evidence", "time", "time_evidence", "end_time",
          "priority", "priority_evidence", "category", "tags", "repeat", "confidence", "interpretations", "clarifications",
        ],
        properties: {
          kind: { type: "string", enum: ["task", "reminder", "idea", "note", "event"] },
          title: { type: "string" },
          description: nullableString,
          date: { ...nullableString, description: "YYYY-MM-DD. Only if the user stated or clearly referenced a day." },
          date_evidence: { ...nullableString, description: "The exact words from the user's text that justify the date." },
          time: { ...nullableString, description: "HH:mm 24h. Only if the user stated a time." },
          time_evidence: { ...nullableString, description: "The exact words from the user's text that justify the time." },
          end_time: nullableString,
          priority: { type: ["string", "null"], enum: ["low", "medium", "high", "urgent", null] },
          priority_evidence: nullableString,
          category: nullableString,
          tags: { type: "array", items: { type: "string" } },
          repeat: { type: ["string", "null"], enum: ["none", "daily", "weekdays", "weekly", "monthly", null] },
          confidence: { type: "number" },
          interpretations: { type: "array", items: { type: "string" } },
          clarifications: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function captureSystemPrompt(now: LocalNow, weekday: string, categories: string[]) {
  return `You are DYBYSTA, a careful personal organization assistant. Convert the user's message into structured items.

Current local date: ${now.date} (${weekday}), local time ${now.time}.
User's categories: ${categories.join(", ") || "(none)"}.

Classify each item as exactly one kind:
- task: something the user needs to do.
- reminder: the user explicitly wants to be reminded/notified at a moment ("remind me", "напомни").
- idea: a spontaneous idea, concept, or "what if".
- note: information to remember (facts, preferences, "remember that…"). Not an action.
- event: something scheduled at a specific day/time (meeting, class, appointment).

STRICT RULES — the user stays the boss:
1. NEVER invent details. Only fill date/time/priority if the user's words state them. If you fill one, put the exact words you relied on in *_evidence (copied verbatim from the user's text).
2. Resolve relative dates ("tomorrow", "Friday", "через 2 дня") against the current local date above.
3. If a time is ambiguous (e.g. "at 3" with no am/pm), choose the most plausible reading AND add an entry to "interpretations" explaining it.
4. "before Friday" means the deadline is the day before Friday; "by Friday" means Friday. Explain in interpretations.
5. A reminder needs a date and time; if missing, leave them null and add a question to "clarifications". If only a time is given, you may use the next occurrence of that time and say so in interpretations.
6. Vague timeframes ("next week", "soon", "later") → leave date null and ask in clarifications.
7. priority: only if the user signals urgency/importance; else null.
8. category: pick from the user's categories only when the content clearly fits; otherwise null. Mention the reason in interpretations.
9. Title: short, imperative for tasks/reminders ("Call my professor"), without the date/time words. Keep the user's language (English or Russian).
10. description: extra detail the user gave, or null. For notes/ideas, put the full statement there.
11. tags: only hashtags or explicit tags the user wrote; otherwise [].
12. repeat: for reminders only ("every day" → daily). Else null.
13. Split into multiple items only if the user clearly listed separate things.
14. Write interpretations and clarifications in the user's language.`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type RawItem = ExtractedItem & { date_evidence: string | null; time_evidence: string | null; priority_evidence: string | null };

function containsLoose(text: string, needle: string | null) {
  if (!needle) return false;
  const n = needle.toLowerCase().trim();
  return n.length > 0 && text.toLowerCase().includes(n);
}

/** Server-side guard: drop any detail the model can't justify with the user's own words. */
function enforceNoFabrication(raw: RawItem, text: string): ExtractedItem {
  const item: ExtractedItem = {
    kind: raw.kind,
    title: (raw.title || text).slice(0, 300),
    description: raw.description || null,
    date: raw.date,
    time: raw.time,
    end_time: raw.end_time,
    priority: raw.priority,
    category: raw.category,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : [],
    repeat: raw.repeat,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
    interpretations: raw.interpretations ?? [],
    clarifications: raw.clarifications ?? [],
  };
  if (item.date && (!DATE_RE.test(item.date) || !containsLoose(text, raw.date_evidence))) {
    item.date = null;
    item.clarifications.push("Which day should this be? (The AI couldn't confirm a date from your words.)");
  }
  if (item.time && (!TIME_RE.test(item.time) || !containsLoose(text, raw.time_evidence))) {
    item.time = null;
    if (item.kind === "reminder" || item.kind === "event") item.clarifications.push("What time? (The AI couldn't confirm a time from your words.)");
  }
  if (item.end_time && !TIME_RE.test(item.end_time)) item.end_time = null;
  if (item.priority && !containsLoose(text, raw.priority_evidence)) item.priority = null;
  if (item.kind !== "reminder") item.repeat = null;
  return item;
}

export async function openaiCapture(text: string, now: LocalNow, weekday: string, categories: string[]): Promise<ExtractedItem[]> {
  const res = await getClient().chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: captureSystemPrompt(now, weekday, categories) },
      { role: "user", content: text },
    ],
    response_format: { type: "json_schema", json_schema: { name: "capture", strict: true, schema: CAPTURE_SCHEMA as unknown as Record<string, unknown> } },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  const parsed = JSON.parse(content) as { items: RawItem[] };
  return parsed.items.slice(0, 5).map((i) => enforceNoFabrication(i, text));
}

const ASSISTANT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "reference_ids"],
  properties: {
    answer: { type: "string" },
    reference_ids: { type: "array", items: { type: "string" } },
  },
} as const;

export async function openaiAssistant(
  history: { role: "user" | "assistant"; content: string }[],
  ctx: AssistantContext,
  language: string
): Promise<{ answer: string; referenceIds: string[] }> {
  const system = `You are DYBYSTA's assistant. You help the user understand and plan using ONLY their saved data below.
Today is ${ctx.now.date} (${ctx.weekday}), local time ${ctx.now.time}.

Rules:
- Answer only from the JSON data. If the answer isn't there, say you couldn't find it in their saved items. Never invent tasks, dates, people or details.
- Be concise and practical. Use short markdown bullet lists. Mention dates in a friendly way (e.g. "tomorrow at 15:00").
- When recommending priorities, explain briefly (overdue, due soon, priority level) and remind the user they decide.
- reference_ids: ids of the saved items your answer mentions.
- Reply in ${language === "ru" ? "Russian" : language === "en" ? "English" : "the same language as the user's question"}.

USER DATA (JSON):
${JSON.stringify(ctx)}`;
  const res = await getClient().chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [{ role: "system", content: system }, ...history.slice(-10)],
    response_format: { type: "json_schema", json_schema: { name: "assistant_answer", strict: true, schema: ASSISTANT_SCHEMA as unknown as Record<string, unknown> } },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  const parsed = JSON.parse(content) as { answer: string; reference_ids: string[] };
  return { answer: parsed.answer, referenceIds: parsed.reference_ids ?? [] };
}

export async function openaiOverview(ctx: AssistantContext, language: string): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content: `Write a warm, concise daily overview (2–4 sentences, no lists, no greeting) for the user based ONLY on their data. Today is ${ctx.now.date} (${ctx.weekday}), now ${ctx.now.time}. Mention what's due today, overdue items, the next event, and one suggested focus. Never invent anything. Reply in ${language === "ru" ? "Russian" : "English"}.`,
      },
      { role: "user", content: JSON.stringify(ctx) },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || "";
}
