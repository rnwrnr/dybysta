/**
 * Simulated assistant used when no OpenAI key is configured. It answers ONLY
 * from the user's saved items and says so when nothing matches.
 */
import { type Lang, translate, translatePlural } from "@/lib/i18n/core";
import type { CaptureKind } from "@/lib/types";

// Message language; set at the start of each exported (synchronous) function.
let LANG: Lang = "en";
const M = (key: string, vars?: Record<string, string | number>) => translate(LANG, key, vars);
const P = (n: number, one: string, other: string, vars?: Record<string, string | number>) => translatePlural(LANG, n, one, other, vars);
import type { AssistantContext } from "./context";

type Ref = { type: CaptureKind; id: string; title: string };
export interface AssistantAnswer {
  answer: string;
  references: Ref[];
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
function prettyDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LANG === "ru" ? "ru-RU" : "en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

const STOP = new Set(
  "a an the say says tell told i me my mine you your to of in on at for with and or is are was were be been it that this what which who when where how do does did have has had about tell show find give any some all there their from last week month day yesterday today tomorrow mentioned said saved remember idea ideas note notes task tasks reminder reminders event events business thing something please can could would should will that's whats what's я мне мой моя мои что как где когда это про о об в на и или по за был была были есть у меня идея идеи заметка заметки задача задачи".split(
    " "
  )
);

function keywords(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\d\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function overdueTasks(ctx: AssistantContext) {
  return ctx.tasks.filter((t) => {
    if (t.status === "done" || !t.due_date) return false;
    if (t.due_date < ctx.now.date) return true;
    return t.due_date === ctx.now.date && t.due_time !== null && t.due_time < ctx.now.time;
  });
}

function dayAgenda(ctx: AssistantContext, key: string) {
  const tasks = ctx.tasks.filter((t) => t.due_date === key && t.status !== "done");
  const events = ctx.events.filter((e) => e.date === key);
  const reminders = ctx.reminders.filter((r) => r.at.startsWith(key) && (r.status === "pending" || r.status === "snoozed"));
  return { tasks, events, reminders };
}

function describeAgenda(ctx: AssistantContext, key: string, label: string): AssistantAnswer {
  const { tasks, events, reminders } = dayAgenda(ctx, key);
  const refs: Ref[] = [];
  if (!tasks.length && !events.length && !reminders.length) {
    return { answer: M("I don't see anything saved for {label} ({date}). Nothing is due, scheduled, or set to remind you.", { label: M(label), date: prettyDay(key) }), references: [] };
  }
  const lines: string[] = [M("Here's what you have saved for {label} ({date}):", { label: M(label), date: prettyDay(key) })];
  if (events.length) {
    lines.push("", `**${M("Events")}**`);
    events
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
      .forEach((e) => {
        lines.push(`- ${e.start_time ? e.start_time : M("All day")} — ${e.title}${e.location ? ` (${e.location})` : ""}`);
        refs.push({ type: "event", id: e.id, title: e.title });
      });
  }
  if (tasks.length) {
    lines.push("", `**${M("Tasks")}**`);
    tasks
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
      .forEach((t) => {
        lines.push(`- ${t.title}${t.due_time ? ` ${M("by {time}", { time: t.due_time })}` : ""} · ${M("{p} priority", { p: M(t.priority) })}`);
        refs.push({ type: "task", id: t.id, title: t.title });
      });
  }
  if (reminders.length) {
    lines.push("", `**${M("Reminders")}**`);
    reminders.forEach((r) => {
      lines.push(`- ${r.at.slice(11)} — ${r.title}`);
      refs.push({ type: "reminder", id: r.id, title: r.title });
    });
  }
  return { answer: lines.join("\n"), references: refs };
}

function forgotten(ctx: AssistantContext): AssistantAnswer {
  const overdue = overdueTasks(ctx);
  const stale = ctx.tasks.filter((t) => t.status !== "done" && !t.due_date && t.created <= addDays(ctx.now.date, -7));
  const missed = ctx.reminders.filter((r) => (r.status === "pending" || r.status === "snoozed") && r.at < `${ctx.now.date} ${ctx.now.time}`);
  if (!overdue.length && !stale.length && !missed.length) {
    return { answer: M("Good news — nothing looks forgotten. You have no overdue tasks, no missed reminders, and no old undated tasks."), references: [] };
  }
  const lines: string[] = [];
  const refs: Ref[] = [];
  if (overdue.length) {
    lines.push(`**${M("Overdue tasks ({n})", { n: overdue.length })}**`);
    overdue.forEach((t) => {
      lines.push(`- ${t.title} — ${M("was due {date}", { date: prettyDay(t.due_date!) })}`);
      refs.push({ type: "task", id: t.id, title: t.title });
    });
  }
  if (missed.length) {
    lines.push("", `**${M("Reminders you haven't handled ({n})", { n: missed.length })}**`);
    missed.forEach((r) => {
      lines.push(`- ${r.title} — ${M("was set for {when}", { when: r.at })}`);
      refs.push({ type: "reminder", id: r.id, title: r.title });
    });
  }
  if (stale.length) {
    lines.push("", `**${M("Older tasks without a due date ({n})", { n: stale.length })}**`);
    stale.forEach((t) => {
      lines.push(`- ${t.title} — ${M("added {date}", { date: prettyDay(t.created) })}`);
      refs.push({ type: "task", id: t.id, title: t.title });
    });
  }
  return { answer: lines.join("\n").trim(), references: refs };
}

function prioritize(ctx: AssistantContext): AssistantAnswer {
  const open = ctx.tasks.filter((t) => t.status !== "done");
  if (!open.length) return { answer: M("You have no open tasks saved, so there's nothing to prioritize right now."), references: [] };
  const soon = addDays(ctx.now.date, 3);
  const score = (t: (typeof open)[number]) => {
    let s = PRIORITY_RANK[t.priority] * 10;
    if (t.due_date && t.due_date < ctx.now.date) s -= 40;
    else if (t.due_date === ctx.now.date) s -= 25;
    else if (t.due_date && t.due_date <= soon) s -= 10;
    else if (!t.due_date) s += 5;
    return s;
  };
  const ranked = [...open].sort((a, b) => score(a) - score(b)).slice(0, 5);
  const reason = (t: (typeof open)[number]) => {
    const r: string[] = [];
    if (t.due_date && t.due_date < ctx.now.date) r.push(M("overdue"));
    else if (t.due_date === ctx.now.date) r.push(t.due_time ? M("due today at {time}", { time: t.due_time }) : M("due today"));
    else if (t.due_date) r.push(M("due {date}", { date: prettyDay(t.due_date) }));
    else r.push(M("no due date"));
    r.push(M("{p} priority", { p: M(t.priority) }));
    return r.join(", ");
  };
  const { events } = dayAgenda(ctx, ctx.now.date);
  const lines = [M("Based on your saved tasks, I'd focus on these in order:"), ""];
  ranked.forEach((t, i) => lines.push(`${i + 1}. **${t.title}** — ${reason(t)}`));
  if (events.length) lines.push("", M("Plan around your events today: {list}.", { list: events.map((e) => `${e.title}${e.start_time ? " " + e.start_time : ""}`).join(", ") }));
  lines.push("", `_${M("This ranking uses due dates and the priorities you set — you decide the final order.")}_`);
  return { answer: lines.join("\n"), references: ranked.map((t) => ({ type: "task", id: t.id, title: t.title })) };
}

function search(ctx: AssistantContext, q: string, prefer?: "idea" | "note"): AssistantAnswer {
  const words = keywords(q);
  const lower = q.toLowerCase();
  let since: string | null = null;
  if (/last week|прошлой неделе/.test(lower)) since = addDays(ctx.now.date, -14);
  else if (/yesterday|вчера/.test(lower)) since = addDays(ctx.now.date, -2);
  else if (/last month|прошлом месяце/.test(lower)) since = addDays(ctx.now.date, -45);

  type Hit = { ref: Ref; score: number; line: string };
  const hits: Hit[] = [];
  const match = (text: string) => words.reduce((n, w) => n + (text.toLowerCase().includes(w) ? 1 : 0), 0);

  const wantBusiness = /business|startup|бизнес|стартап/.test(lower);
  for (const i of ctx.ideas) {
    let s = match(`${i.title} ${i.description ?? ""} ${i.tags.join(" ")}`) * 2;
    if (prefer === "idea") s += 1;
    if (wantBusiness && /startup|business|market|app|бизнес|стартап|приложени/i.test(`${i.title} ${i.description} ${i.tags.join(" ")}`)) s += 2;
    if (since && i.created < since) s -= 3;
    if (s > (prefer === "idea" && !words.length ? 0 : 1)) hits.push({ ref: { type: "idea", id: i.id, title: i.title }, score: s, line: `💡 **${i.title}** (${M("idea, saved {date}", { date: prettyDay(i.created) })})${i.description ? ` — ${i.description}` : ""}` });
  }
  for (const n of ctx.notes) {
    let s = match(`${n.title} ${n.content} ${n.tags.join(" ")} ${n.folder ?? ""}`) * 2;
    if (prefer === "note") s += 1;
    if (since && n.updated < since) s -= 3;
    if (s > 1) hits.push({ ref: { type: "note", id: n.id, title: n.title }, score: s, line: `📝 **${n.title}** (${M("note")}) — ${n.content.slice(0, 160)}${n.content.length > 160 ? "…" : ""}` });
  }
  if (!prefer) {
    for (const t of ctx.tasks) {
      const s = match(`${t.title} ${t.description ?? ""}`) * 2;
      if (s > 1) hits.push({ ref: { type: "task", id: t.id, title: t.title }, score: s, line: `✅ **${t.title}** (${M("task")}, ${t.status === "done" ? M("done") : t.due_date ? M("due {date}", { date: prettyDay(t.due_date) }) : M("no due date")})` });
    }
    for (const e of ctx.events) {
      const s = match(`${e.title} ${e.location ?? ""}`) * 2;
      if (s > 1) hits.push({ ref: { type: "event", id: e.id, title: e.title }, score: s, line: `📅 **${e.title}** (${M("event")}, ${prettyDay(e.date)}${e.start_time ? " " + e.start_time : ""})` });
    }
    for (const r of ctx.reminders) {
      const s = match(r.title) * 2;
      if (s > 1) hits.push({ ref: { type: "reminder", id: r.id, title: r.title }, score: s, line: `🔔 **${r.title}** (${M("reminder")}, ${r.at})` });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 5);
  if (!top.length) {
    return {
      answer: M(prefer === "idea" ? "I couldn't find a matching idea in your saved items{q}{since}. I only know what you've saved in DYBYSTA, so I won't guess." : prefer === "note" ? "I couldn't find a matching note in your saved items{q}{since}. I only know what you've saved in DYBYSTA, so I won't guess." : "I couldn't find anything in your saved items{q}{since}. I only know what you've saved in DYBYSTA, so I won't guess.", {
        q: words.length ? ` ("${words.join(" ")}")` : "",
        since: since ? M(" in that time frame") : "",
      }),
      references: [],
    };
  }
  return {
    answer: [top.length === 1 ? M("Here's what I found in your saved items:") : M("Here's what I found in your saved items, best match first:"), "", ...top.map((h) => `- ${h.line}`)].join("\n"),
    references: top.map((h) => h.ref),
  };
}

export function heuristicAssistant(question: string, ctx: AssistantContext, lang: Lang = "en"): AssistantAnswer {
  LANG = lang;
  const q = question.toLowerCase();
  if (/forg[oe]t|overdue|missed|behind|late|забыл|просроч|пропустил/.test(q)) return forgotten(ctx);
  if (/priorit|focus|first|most important|what should i (do|work)|приоритет|в первую очередь|важнее|чем заняться/.test(q)) return prioritize(ctx);
  if (/day after tomorrow|послезавтра/.test(q)) return describeAgenda(ctx, addDays(ctx.now.date, 2), "the day after tomorrow");
  if (/tomorrow|завтра/.test(q)) return describeAgenda(ctx, addDays(ctx.now.date, 1), "tomorrow");
  if (/today|tonight|сегодня/.test(q) && !/idea|note|идея|заметк/.test(q)) return describeAgenda(ctx, ctx.now.date, "today");
  if (/this week|week ahead|upcoming|на этой неделе|на неделе/.test(q)) {
    const refs: Ref[] = [];
    const lines: string[] = [M("Here's your next 7 days:")];
    for (let i = 0; i < 7; i++) {
      const key = addDays(ctx.now.date, i);
      const a = dayAgenda(ctx, key);
      const items = [...a.events.map((e) => ({ t: "event" as const, id: e.id, title: e.title, s: e.start_time })), ...a.tasks.map((t) => ({ t: "task" as const, id: t.id, title: t.title, s: t.due_time })), ...a.reminders.map((r) => ({ t: "reminder" as const, id: r.id, title: r.title, s: r.at.slice(11) }))];
      if (!items.length) continue;
      lines.push("", `**${prettyDay(key)}**`);
      items.forEach((it) => {
        lines.push(`- ${it.s ? it.s + " — " : ""}${it.title} (${M(it.t)})`);
        refs.push({ type: it.t, id: it.id, title: it.title });
      });
    }
    if (!refs.length) return { answer: M("Nothing is scheduled or due in the next 7 days."), references: [] };
    return { answer: lines.join("\n"), references: refs };
  }
  if (/idea|идея|идеи|идею/.test(q)) return search(ctx, question, "idea");
  if (/note|заметк|запомн|remember/.test(q)) return search(ctx, question, "note");
  return search(ctx, question);
}

export function heuristicOverview(ctx: AssistantContext, lang: Lang = "en"): string {
  LANG = lang;
  const today = dayAgenda(ctx, ctx.now.date);
  const overdue = overdueTasks(ctx);
  const upcomingReminders = ctx.reminders.filter((r) => (r.status === "pending" || r.status === "snoozed") && r.at >= `${ctx.now.date} ${ctx.now.time}` && r.at <= `${addDays(ctx.now.date, 1)} 23:59`);
  const parts: string[] = [];
  const nTasks = today.tasks.length;
  const high = today.tasks.filter((t) => t.priority === "urgent" || t.priority === "high").length;
  if (!nTasks && !today.events.length && !overdue.length) parts.push(M("Your day is clear — nothing is due and nothing is scheduled."));
  else {
    const bits: string[] = [];
    if (nTasks) bits.push(P(nTasks, "{n} task due today", "{n} tasks due today") + (high ? ` (${M("{n} high priority", { n: high })})` : ""));
    if (today.events.length) bits.push(P(today.events.length, "{n} event", "{n} events"));
    if (overdue.length) bits.push(P(overdue.length, "{n} overdue task", "{n} overdue tasks"));
    parts.push(M("You have {list}.", { list: bits.join(", ").replace(/, ([^,]*)$/, ` ${M("and")} $1`) }));
  }
  const next = [...today.events].filter((e) => !e.start_time || e.start_time >= ctx.now.time).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))[0];
  if (next) parts.push(M("Next up: {title}.", { title: `${next.title}${next.start_time ? ` ${M("at {time}", { time: next.start_time })}` : ""}` }));
  if (overdue.length) {
    const o = [...overdue].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
    parts.push(M('Consider clearing "{title}" first — it\'s past due.', { title: o.title }));
  } else if (today.tasks.length) {
    const t = [...today.tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
    parts.push(M('Suggested focus: "{title}".', { title: t.title }));
  }
  if (upcomingReminders.length) parts.push(P(upcomingReminders.length, "{n} reminder is coming up in the next day.", "{n} reminders are coming up in the next day."));
  return parts.join(" ");
}
