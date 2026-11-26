import { NextResponse } from "next/server";
import OpenAI from "openai";
import { guardAiRequest } from "@/lib/ai/guard";
import { chatModels, isModelError, isOpenAIConfigured, OPENAI_MODEL, shortError } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/status            → is an AI key configured?
 * GET /api/ai/status?check=1    → also makes a tiny test call and reports which model works (signed-in users only).
 */
export async function GET(req: Request) {
  const configured = isOpenAIConfigured();
  const base = { configured, model: configured ? OPENAI_MODEL : null };
  if (!configured || new URL(req.url).searchParams.get("check") !== "1") return NextResponse.json(base);

  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 0 });
  const tried: { model: string; ok: boolean; error?: string }[] = [];
  for (const model of chatModels()) {
    try {
      await client.chat.completions.create({ model, messages: [{ role: "user", content: "Reply with: ok" }], max_tokens: 5 });
      tried.push({ model, ok: true });
      return NextResponse.json({ ...base, working_model: model, tried });
    } catch (e) {
      tried.push({ model, ok: false, error: shortError(e) });
      if (!isModelError(e)) break;
    }
  }
  return NextResponse.json({ ...base, working_model: null, tried });
}
