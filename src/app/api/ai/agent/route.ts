import { NextResponse } from "next/server";
import { z } from "zod";
import { heuristicAgent } from "@/lib/ai/agent-heuristic";
import { runOpenAIAgent } from "@/lib/ai/agent-openai";
import type { AgentResponse } from "@/lib/ai/agent-types";
import type { AssistantContext } from "@/lib/ai/context";
import { guardAiRequest } from "@/lib/ai/guard";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { translate } from "@/lib/i18n/core";

export const maxDuration = 60;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(30),
  context: z.custom<AssistantContext>((v) => typeof v === "object" && v !== null && "now" in v && "tasks" in v),
  categories: z.array(z.object({ id: z.string(), name: z.string() })).max(200).default([]),
  focus: z.object({ type: z.enum(["task", "note", "reminder", "idea", "event"]), id: z.string() }).nullable().default(null),
  language: z.enum(["en", "ru"]).default("en"),
});

export async function POST(req: Request) {
  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const last = [...body.messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";
  if (!last) return NextResponse.json({ error: translate(body.language, "Say or type something first.") }, { status: 400 });

  if (isOpenAIConfigured()) {
    try {
      const r = await runOpenAIAgent({ history: body.messages, ctx: body.context, categories: body.categories, focus: body.focus, lang: body.language });
      return NextResponse.json({ reply: r.reply || translate(body.language, "Done."), actions: r.actions, simulated: false } satisfies AgentResponse);
    } catch (e) {
      console.error("[agent] OpenAI failed, falling back", e);
      const r = heuristicAgent(last, body.context, body.categories, body.focus, body.language);
      return NextResponse.json({ ...r, simulated: true, error: translate(body.language, "The AI service is unavailable right now, so this result comes from the offline parser. Please double-check it.") } satisfies AgentResponse);
    }
  }
  return NextResponse.json({ ...heuristicAgent(last, body.context, body.categories, body.focus, body.language), simulated: true } satisfies AgentResponse);
}
