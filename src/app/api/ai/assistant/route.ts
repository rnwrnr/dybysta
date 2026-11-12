import { NextResponse } from "next/server";
import { z } from "zod";
import type { AssistantContext } from "@/lib/ai/context";
import { guardAiRequest } from "@/lib/ai/guard";
import { heuristicAssistant } from "@/lib/ai/heuristic-assistant";
import { isOpenAIConfigured, openaiAssistant } from "@/lib/ai/openai";
import type { CaptureKind } from "@/lib/types";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
  context: z.custom<AssistantContext>((v) => typeof v === "object" && v !== null && "now" in v && "tasks" in v),
  language: z.enum(["auto", "en", "ru"]).default("auto"),
});

function refsFor(ids: string[], ctx: AssistantContext) {
  const refs: { type: CaptureKind; id: string; title: string }[] = [];
  const add = (type: CaptureKind, list: { id: string; title: string }[]) =>
    list.forEach((i) => ids.includes(i.id) && refs.push({ type, id: i.id, title: i.title }));
  add("task", ctx.tasks);
  add("reminder", ctx.reminders);
  add("event", ctx.events);
  add("note", ctx.notes);
  add("idea", ctx.ideas);
  return refs;
}

export async function POST(req: Request) {
  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const question = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (isOpenAIConfigured()) {
    try {
      const { answer, referenceIds } = await openaiAssistant(body.messages, body.context, body.language);
      return NextResponse.json({ answer, references: refsFor(referenceIds, body.context), simulated: false });
    } catch (e) {
      console.error("[assistant] OpenAI failed, falling back", e);
      const r = heuristicAssistant(question, body.context);
      return NextResponse.json({ ...r, simulated: true, error: "The AI service is unavailable — this answer comes from the offline search." });
    }
  }
  return NextResponse.json({ ...heuristicAssistant(question, body.context), simulated: true });
}
