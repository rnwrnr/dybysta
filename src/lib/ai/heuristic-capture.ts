/**
 * Rule-based natural-language parser used in demo mode (no OpenAI key) and as a
 * fallback when the OpenAI request fails. It supports English and Russian.
 *
 * Principle: never invent details. Dates/times are only filled when the text
 * states them; every guess is reported in `interpretations`, and missing
 * required details become `clarifications`.
 */
import type { CaptureKind, ExtractedItem, Priority, ReminderRepeat } from "@/lib/types";

/** Wall-clock "now" of the user, independent of the server's timezone. */
export interface LocalNow {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

// --- naive date helpers (operate on UTC to avoid server TZ effects) --------
function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDaysKey(key: string, n: number) {
  const d = parseDay(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}
function weekday(key: string) {
  return parseDay(key).getUTCDay(); // 0 Sun..6 Sat
}
function pretty(key: string) {
  return parseDay(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS: { re: RegExp; day: number; name: string }[] = [
  { re: /\b(sunday|sun)\b|воскресень[ея]/i, day: 0, name: "Sunday" },
  { re: /\b(monday|mon)\b|понедельник/i, day: 1, name: "Monday" },
  { re: /\b(tuesday|tue|tues)\b|вторник/i, day: 2, name: "Tuesday" },
  { re: /\b(wednesday|wed)\b|сред[уаы]/i, day: 3, name: "Wednesday" },
  { re: /\b(thursday|thu|thurs)\b|четверг/i, day: 4, name: "Thursday" },
  { re: /\b(friday|fri)\b|пятниц[уаы]/i, day: 5, name: "Friday" },
  { re: /\b(saturday|sat)\b|суббот[уаы]/i, day: 6, name: "Saturday" },
];

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_RU = ["янв", "фев", "мар", "апр", "ма[йя]", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

interface DateResult {
  date: string | null;
  matched: string[];
  interpretations: string[];
  clarifications: string[];
  vagueTime?: "morning" | "afternoon" | "evening" | "night";
}

function extractDate(text: string, now: LocalNow): DateResult {
  const t = text.toLowerCase();
  const res: DateResult = { date: null, matched: [], interpretations: [], clarifications: [] };
  const take = (re: RegExp) => {
    const m = t.match(re);
    if (m) res.matched.push(m[0]);
    return m;
  };

  // ISO date
  let m = take(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) {
    res.date = `${m[1]}-${m[2]}-${m[3]}`;
    return res;
  }
  // dd.mm(.yyyy)
  m = take(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31) {
    let year = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : Number(now.date.slice(0, 4));
    let key = `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    if (!m[3] && key < now.date) {
      year += 1;
      key = `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
      res.interpretations.push(`No year given — assumed ${pretty(key)} (the next upcoming one).`);
    }
    res.date = key;
    return res;
  } else if (m) res.matched.pop();

  // "20 november" / "november 20" / "20 ноября"
  const monthAlt = [...MONTHS_EN.map((x) => x + "[a-z]*"), ...MONTHS_RU.map((x) => x + "[а-я]*")].join("|");
  m = take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthAlt})`, "i")) ?? take(new RegExp(`(${monthAlt})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));
  if (m) {
    const [dayStr, monStr] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const idxEn = MONTHS_EN.findIndex((p) => monStr.startsWith(p));
    const idxRu = MONTHS_RU.findIndex((p) => new RegExp("^" + p).test(monStr));
    const month = idxEn >= 0 ? idxEn : idxRu;
    if (month >= 0) {
      let year = Number(now.date.slice(0, 4));
      let key = `${year}-${pad(month + 1)}-${pad(Number(dayStr))}`;
      if (key < now.date) {
        year += 1;
        key = `${year}-${pad(month + 1)}-${pad(Number(dayStr))}`;
        res.interpretations.push(`No year given — assumed ${pretty(key)} (the next upcoming one).`);
      }
      res.date = key;
      return res;
    }
  }

  if (take(/\bday after tomorrow\b|послезавтра/)) {
    res.date = addDaysKey(now.date, 2);
    return res;
  }
  if (take(/\btomorrow\b|\btmrw\b|завтра/)) {
    res.date = addDaysKey(now.date, 1);
    return res;
  }
  if (take(/\btonight\b|сегодня вечером/)) {
    res.date = now.date;
    res.vagueTime = "evening";
    return res;
  }
  if (take(/\btoday\b|сегодня/)) {
    res.date = now.date;
    return res;
  }

  // in N days / weeks / через N дней
  m = take(/\bin (\d+|a|one|two|three) (day|days|week|weeks)\b|через (\d+)?\s*(день|дня|дней|неделю|недели|недель)/);
  if (m) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3 };
    const n = m[1] ? (words[m[1]] ?? Number(m[1])) : m[3] ? Number(m[3]) : 1;
    const unit = m[2] ?? m[4] ?? "";
    const days = /week|недел/.test(unit) ? n * 7 : n;
    res.date = addDaysKey(now.date, days);
    return res;
  }

  // weekday with optional "before/by/next"
  for (const wd of WEEKDAYS) {
    const wm = t.match(wd.re);
    if (!wm) continue;
    const idx = wm.index ?? 0;
    const before = t.slice(Math.max(0, idx - 14), idx);
    res.matched.push(wm[0]);
    const cur = weekday(now.date);
    let diff = (wd.day - cur + 7) % 7;
    const isNext = /\bnext\s+$|следующ\S*\s+$/.test(before);
    if (isNext) {
      if (diff === 0) diff = 7;
      else diff += 7;
      res.interpretations.push(`Read "next ${wd.name}" as ${pretty(addDaysKey(now.date, diff))}. Change it if you meant the closer one.`);
    } else if (diff === 0) {
      res.interpretations.push(`Today is ${wd.name} — assumed you meant today.`);
    }
    let key = addDaysKey(now.date, diff);
    const prefix = before.match(/(before|by|until|till|до|к|ко)\s+(this\s+|next\s+|следующ\S*\s+)?$/);
    if (prefix) {
      res.matched.push(prefix[0].trim());
      if (prefix[1] === "before") {
        const dl = addDaysKey(key, -1);
        res.interpretations.push(`"${prefix[1]} ${/[а-яё]/.test(wm[0]) ? wm[0] : wd.name}" — set the deadline to ${pretty(dl)}, the day before.`);
        key = dl < now.date ? now.date : dl;
      }
    }
    const thisM = before.match(/(this|в|во|on|next|следующ\S*)\s+$/);
    if (thisM) res.matched.push(thisM[0].trim());
    res.date = key;
    return res;
  }

  if (/\bnext week\b|на следующей неделе|на этой неделе|\bthis week\b|\blater\b|\bsoon\b|позже|скоро/.test(t)) {
    res.clarifications.push("You mentioned a rough time frame — which exact day should I use?");
  }
  if (/\bthis weekend\b|на выходных/.test(t)) {
    const cur = weekday(now.date);
    const diff = (6 - cur + 7) % 7;
    res.date = addDaysKey(now.date, diff);
    res.matched.push(t.match(/\bthis weekend\b|на выходных/)![0]);
    res.interpretations.push(`"This weekend" → set to Saturday ${pretty(res.date)}.`);
  }
  return res;
}

interface TimeResult {
  time: string | null;
  endTime: string | null;
  matched: string[];
  interpretations: string[];
  relativeDate?: string;
}

function extractTime(text: string, now: LocalNow, vague?: DateResult["vagueTime"]): TimeResult {
  const t = text.toLowerCase();
  const res: TimeResult = { time: null, endTime: null, matched: [], interpretations: [] };

  // in N minutes / hours (relative → exact date+time)
  let m = t.match(/\bin (\d+|an|a|one|two|half an?) (minute|minutes|min|mins|hour|hours|hr|hrs)\b|через (\d+|полчаса|час)?\s*(минут[уы]?|час[аов]*)?/);
  if (m && (m[1] || m[3] || m[4])) {
    const words: Record<string, number> = { an: 1, a: 1, one: 1, two: 2 };
    let minutes = 0;
    if (m[1]) {
      const n = m[1].startsWith("half") ? 0.5 : (words[m[1]] ?? Number(m[1]));
      minutes = /hour|hr/.test(m[2]) ? n * 60 : n;
    } else {
      if (m[3] === "полчаса") minutes = 30;
      else if (m[3] === "час" || (!m[3] && /час/.test(m[4] ?? ""))) minutes = 60;
      else minutes = /час/.test(m[4] ?? "") ? Number(m[3]) * 60 : Number(m[3]);
    }
    if (minutes > 0 && Number.isFinite(minutes)) {
      const [h, mi] = now.time.split(":").map(Number);
      const total = h * 60 + mi + Math.round(minutes);
      const dayOffset = Math.floor(total / 1440);
      const mins = total % 1440;
      res.time = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
      res.relativeDate = addDaysKey(now.date, dayOffset);
      res.matched.push(m[0]);
      return res;
    }
  }

  if ((m = t.match(/\b(at\s+)?noon\b|в полдень/))) {
    res.time = "12:00";
    res.matched.push(m[0]);
    return res;
  }
  if ((m = t.match(/\b(at\s+)?midnight\b|в полночь/))) {
    res.time = "00:00";
    res.matched.push(m[0]);
    return res;
  }

  // range: 10-11, 10:00–11:30, from 2 to 3pm
  m = t.match(/\b(?:from\s+|с\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|до)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  // explicit am/pm or hh:mm or "at N" / "в N"
  const patterns: RegExp[] = [
    /\b(?:at\s+|@\s*|в\s+|к\s+)?(\d{1,2})(?::|\.)(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/,
    /\b(?:at\s+|@\s*)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/,
    /\b(?:at|@)\s+(\d{1,2})\b(?!\s*(?:days?|weeks?|months?|%|st|nd|rd|th))/,
    /(?:^|\s)(?:в|к)\s+(\d{1,2})(?:\s*(час[аов]*))?(?:\s+(утра|дня|вечера|ночи))?(?=\s|$|[.,!?])/,
  ];

  let hour: number | null = null;
  let minute = 0;
  let meridiem: "am" | "pm" | null = null;
  let raw = "";
  if (m) {
    hour = Number(m[1]);
    minute = Number(m[2] ?? 0);
    meridiem = (m[3] as "am" | "pm") ?? (m[6] as "am" | "pm");
    const eh = Number(m[4]);
    const emin = Number(m[5] ?? 0);
    let endH = eh;
    if (m[6] === "pm" && endH < 12) endH += 12;
    res.endTime = `${pad(endH)}:${pad(emin)}`;
    raw = m[0];
  } else {
    for (const re of patterns) {
      const mm = t.match(re);
      if (!mm) continue;
      raw = mm[0];
      hour = Number(mm[1]);
      if (re === patterns[0]) {
        minute = Number(mm[2]);
        meridiem = mm[3] ? (mm[3].startsWith("a") ? "am" : "pm") : null;
        // dd.mm dates are handled elsewhere; skip if this looks like a date.
        if (mm[0].includes(".") && Number(mm[2]) <= 12 && !/^(at|в|к|@)/.test(mm[0].trim())) {
          hour = null;
          continue;
        }
      } else if (re === patterns[1]) {
        meridiem = mm[2].startsWith("a") ? "am" : "pm";
      } else if (re === patterns[3]) {
        if (mm[3] === "утра") meridiem = "am";
        else if (mm[3] === "дня" || mm[3] === "вечера") meridiem = "pm";
        else if (mm[3] === "ночи") meridiem = hour >= 9 ? "pm" : "am";
      }
      break;
    }
  }
  if (hour === null || hour > 23 || minute > 59) return res;
  res.matched.push(raw.trim());

  const context = vague ?? (/\b(evening|tonight)\b|вечер/.test(t) ? "evening" : /\bafternoon\b|днём|днем/.test(t) ? "afternoon" : /\bmorning\b|утр/.test(t) ? "morning" : undefined);
  if (meridiem === "pm" && hour < 12) hour += 12;
  else if (meridiem === "am" && hour === 12) hour = 0;
  else if (!meridiem && hour <= 12 && !/:/.test(raw)) {
    // Ambiguous hour like "at 3" — interpret, but say so.
    const original = hour;
    if (context === "morning") {
      /* keep */
    } else if (context === "afternoon" || context === "evening" || hour <= 7) {
      if (hour < 12) hour += 12;
    }
    if (hour !== original || hour < 12) {
      res.interpretations.push(`Interpreted "${original}" as ${pad(hour)}:${pad(minute)}${context ? ` (you said "${context}")` : ""} — change it if you meant ${hour >= 12 ? "AM" : "PM"}.`);
    }
  }
  res.time = `${pad(hour)}:${pad(minute)}`;
  return res;
}

function extractPriority(t: string): { priority: Priority | null; matched: string[] } {
  const s = t.toLowerCase();
  const rules: [RegExp, Priority][] = [
    [/\b(urgent|urgently|asap|right away|immediately|critical)\b|срочно|немедленно|критично/, "urgent"],
    [/\b(low priority|not urgent|no rush|whenever|someday)\b|не срочно|когда-нибудь/, "low"],
    [/\b(important|high priority|top priority|must)\b|важно|обязательно/, "high"],
  ];
  for (const [re, p] of rules) {
    const m = s.match(re);
    if (m) return { priority: p, matched: [m[0]] };
  }
  return { priority: null, matched: [] };
}

function extractRepeat(t: string): { repeat: ReminderRepeat | null; matched: string[] } {
  const s = t.toLowerCase();
  const rules: [RegExp, ReminderRepeat][] = [
    [/\b(every weekday|on weekdays|weekdays)\b|по будням/, "weekdays"],
    [/\b(every day|everyday|daily|each day)\b|каждый день|ежедневно/, "daily"],
    [/\b(every week|weekly|each week|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|каждую неделю|еженедельно|каждый (понедельник|вторник|четверг)|каждую (среду|пятницу|субботу)|каждое воскресенье/, "weekly"],
    [/\b(every month|monthly|each month)\b|каждый месяц|ежемесячно/, "monthly"],
  ];
  for (const [re, r] of rules) {
    const m = s.match(re);
    if (m) return { repeat: r, matched: [m[0]] };
  }
  return { repeat: null, matched: [] };
}

const CATEGORY_RULES: { name: string; re: RegExp }[] = [
  { name: "Study", re: /\b(professor|lecture|university|uni|homework|exam|thesis|class|course|study|assignment|semester|seminar)\b|университет|универ|преподавател|профессор|лекци|экзамен|домашк|диплом|учёб|учеб|курсов|семинар/i },
  { name: "Work", re: /\b(meeting|client|presentation|office|project|report|deadline|boss|manager|colleague|work|internship|interview|email)\b|работ|встреч|клиент|презентац|отчёт|отчет|проект|созвон|коллег|стажировк/i },
  { name: "Health", re: /\b(doctor|dentist|gym|workout|run|running|medicine|pills|hospital|yoga|therapy|health)\b|врач|стоматолог|зал|тренировк|лекарств|бег|здоров|йог/i },
  { name: "Finance", re: /\b(pay|bill|bank|rent|budget|invoice|tax|taxes|salary|loan|money)\b|оплат|счёт|счет|банк|аренд|бюджет|налог|зарплат|деньг|кредит/i },
  { name: "Personal", re: /\b(mom|dad|mother|father|friend|birthday|family|groceries|shopping|gift|wife|husband|sister|brother)\b|мам|пап|друг|подруг|день рождения|семь|продукт|подар|сестр|брат/i },
];

function suggestCategory(text: string, available: string[]): { category: string | null; why: string | null } {
  for (const rule of CATEGORY_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const match = available.find((a) => a.toLowerCase() === rule.name.toLowerCase());
    if (match) return { category: match, why: `Suggested category "${match}" because you mentioned "${m[0].trim()}".` };
  }
  return { category: null, why: null };
}

const LEAD_PATTERNS: RegExp[] = [
  /^(hey|ok|okay|please|pls)[,\s]+/i,
  /^(can you |could you |please )?(remind me (to|that|about)|set a reminder (to|for)|reminder:?)\s*/i,
  /^(don't|do not) (let me )?forget (to|about)\s*/i,
  /^(i have an idea( for| about| to)?|idea:|new idea:?|what if)\s*/i,
  /^(remember that|note that|note:|fyi:?|keep in mind that)\s*/i,
  /^(i (really )?(need|have|want|got) to|i must|i should|i gotta|i've got to|need to|have to|todo:?|to-do:?|task:?)\s*/i,
  /^(i have (a|an)\s+)/i,
  /^(напомни(те)?( мне)?,?\s*(о том,? что|что|чтобы|про)?|напоминание:?)\s*/i,
  /^(не забыть|не забудь)\s*/i,
  /^(у меня (есть )?идея,?\s*(про|о|для|насчёт|насчет)?|идея:?)\s*/i,
  /^(запомни,?\s*(что)?|заметка:?|на заметку:?)\s*/i,
  /^(мне (нужно|надо)|нужно|надо|я должен|я должна|сделать)\s*/i,
  /^(у меня)\s*/i,
];

function cleanTitle(original: string, removals: string[]): string {
  let s = original.trim();
  // remove matched date/time/priority phrases (longest first)
  const parts = [...new Set(removals.filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const p of parts) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`(^|[\\s,])(at\\s+|on\\s+|by\\s+|в\\s+|во\\s+)?${esc}(?=$|[\\s,.!?])`, "i"), "$1");
  }
  s = s.replace(/\s{2,}/g, " ").trim();
  for (let i = 0; i < 3; i++) for (const re of LEAD_PATTERNS) s = s.replace(re, "").replace(/^[:;,.\-–—\s]+/, "");
  s = s
    .replace(/#[\p{L}\d_-]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^(a|an|the)\s+(?=\S+\s+\S)/i, (m) => (/^(a|an)\s/i.test(m) ? "" : m))
    .replace(/[\s,;:–-]+(at|on|by|in|for|и|в|на)?\s*$/i, "")
    .replace(/[.!?,;:\s]+$/, "")
    .trim();
  if (!s) s = original.trim().replace(/[.!?]+$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function detectKind(t: string, hasDate: boolean, hasTime: boolean): { kind: CaptureKind; confidence: number; reason: string } {
  const s = t.toLowerCase();
  if (/\bremind me\b|\breminder\b|\bset an? alarm\b|напомни|напоминани/.test(s)) return { kind: "reminder", confidence: 0.95, reason: 'You asked to be reminded.' };
  if (/^(remember that|note that|note:|fyi|keep in mind)|\bremember that\b|запомни|заметка|на заметку|имей в виду/.test(s)) return { kind: "note", confidence: 0.9, reason: "This is information to remember, not an action." };
  if (/\bidea\b|^what if\b|\bconcept for\b|идея|а что если/.test(s)) return { kind: "idea", confidence: 0.92, reason: "You described an idea." };
  if (/\bdon't forget\b|\bdo not forget\b|не забыть|не забудь/.test(s) && hasTime) return { kind: "reminder", confidence: 0.8, reason: '"Don\'t forget" with a time sounds like a reminder.' };
  const eventWords = /\b(meeting|appointment|interview|lecture|class|exam|party|conference|dinner|lunch|call with|webinar|concert|flight|wedding|date with)\b|встреча|собрание|приём|прием|экзамен|вечеринк|конференц|ужин|обед с|созвон|вебинар|концерт|рейс|свадьб/;
  if (eventWords.test(s) && hasDate && !/\b(need to|have to|must|prepare|finish)\b|нужно|надо|подготовить/.test(s)) return { kind: "event", confidence: hasTime ? 0.85 : 0.7, reason: "Sounds like something scheduled at a specific time." };
  if (/\b(need to|have to|must|should|gotta|todo|to-do|finish|complete|submit|buy|call|email|send|write|prepare|fix|pay|book|clean|study|read)\b|нужно|надо|сделать|купить|позвонить|написать|отправить|подготовить|закончить|оплатить|сдать/.test(s))
    return { kind: "task", confidence: 0.85, reason: "Sounds like something you need to do." };
  if (hasDate || hasTime) return { kind: "task", confidence: 0.6, reason: "Has a date, so treated as a task." };
  return { kind: "note", confidence: 0.5, reason: "No clear action or date — saved as a note by default." };
}

export function heuristicCapture(input: string, now: LocalNow, categories: string[]): ExtractedItem[] {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return [];

  const dateR = extractDate(text, now);
  const timeR = extractTime(text, now, dateR.vagueTime);
  const prioR = extractPriority(text);
  const repR = extractRepeat(text);
  const kindR = detectKind(text, Boolean(dateR.date || timeR.relativeDate), Boolean(timeR.time));
  const tags = [...text.matchAll(/#([\p{L}\d_-]+)/gu)].map((m) => m[1].toLowerCase());

  let date = timeR.relativeDate ?? dateR.date;
  let time = timeR.time;
  const interpretations: string[] = [`Classified as ${kindR.kind}: ${kindR.reason}`, ...dateR.interpretations, ...timeR.interpretations];
  const clarifications: string[] = [...dateR.clarifications];

  if (dateR.vagueTime && !time) {
    clarifications.push(`You said "${dateR.vagueTime === "evening" ? "tonight" : dateR.vagueTime}" — what exact time?`);
  }

  const kind = kindR.kind;
  if (kind === "reminder") {
    if (!date && !time) clarifications.push("When should I remind you? Please add a date and time.");
    else if (!time) clarifications.push("What time should I remind you?");
    else if (!date) {
      const future = time > now.time;
      date = future ? now.date : addDaysKey(now.date, 1);
      interpretations.push(`No day mentioned — set to ${future ? "today" : "tomorrow"} (${pretty(date)}), the next time it's ${time}.`);
    }
  }
  if (kind === "event") {
    if (!date) clarifications.push("Which day is this on?");
    if (!time) clarifications.push("What time does it start? (Leave empty for all-day.)");
  }
  if (kind === "task" && time && !date) {
    const future = time > now.time;
    date = future ? now.date : addDaysKey(now.date, 1);
    interpretations.push(`No day mentioned — set to ${future ? "today" : "tomorrow"} for ${time}.`);
  }

  const cat = suggestCategory(text, categories);
  if (cat.why) interpretations.push(cat.why);
  if (prioR.priority) interpretations.push(`Priority set to ${prioR.priority} because you said "${prioR.matched[0]}".`);

  const removals = [...dateR.matched, ...timeR.matched, ...prioR.matched, ...repR.matched];
  let title = cleanTitle(text, kind === "note" || kind === "idea" ? [...prioR.matched] : removals);
  let description: string | null = null;

  if (kind === "note" || kind === "idea") {
    // Keep the full statement; title is a short summary.
    const full = cleanTitle(text, []);
    if (title.length > 70) {
      const cut = title.slice(0, 70);
      title = cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : 70) + "…";
    }
    description = full !== title ? full : null;
    // dates are not stored on notes/ideas; keep them inside the text instead.
    if (date) interpretations.push("Notes and ideas don't have due dates — the date stays in the text.");
    date = null;
    time = null;
  }

  return [
    {
      kind,
      title,
      description,
      date,
      time,
      end_time: kind === "event" ? timeR.endTime : null,
      priority: kind === "task" ? prioR.priority : kind === "reminder" ? prioR.priority : null,
      category: cat.category,
      tags,
      repeat: kind === "reminder" ? (repR.repeat ?? "none") : null,
      confidence: kindR.confidence,
      interpretations,
      clarifications,
    },
  ];
}
