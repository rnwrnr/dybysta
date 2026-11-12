import { NextResponse } from "next/server";
import type { AssistantContext } from "@/lib/ai/context";
import { guardAiRequest } from "@/lib/ai/guard";
import { heuristicOverview } from "@/lib/ai/heuristic-assistant";
import { isOpenAIConfigured, openaiOverview } from "@/lib/ai/openai";

export async function POST(req: Request) {
  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;
  let ctx: AssistantContext;
  let language = "en";
  try {
    const body = await req.json();
    ctx = body.context;
    language = body.language === "ru" ? "ru" : "en";
    if (!ctx?.now || !Array.isArray(ctx.tasks)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (isOpenAIConfigured()) {
    try {
      const text = await openaiOverview(ctx, language);
      if (text) return NextResponse.json({ text, simulated: false });
    } catch (e) {
      console.error("[overview] OpenAI failed, falling back", e);
    }
  }
  return NextResponse.json({ text: heuristicOverview(ctx), simulated: true });
}
