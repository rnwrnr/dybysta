import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAiRequest } from "@/lib/ai/guard";
import { heuristicCapture } from "@/lib/ai/heuristic-capture";
import { isOpenAIConfigured, OPENAI_MODEL, openaiCapture } from "@/lib/ai/openai";
import type { CaptureResponse } from "@/lib/types";

const Body = z.object({
  text: z.string().trim().min(1, "Say or type something first.").max(2000, "That's a bit long — keep it under 2000 characters."),
  now: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  weekday: z.string().max(20),
  categories: z.array(z.string().max(60)).max(50).default([]),
});

export async function POST(req: Request) {
  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (isOpenAIConfigured()) {
    try {
      const items = await openaiCapture(body.text, body.now, body.weekday, body.categories);
      if (items.length) return NextResponse.json({ items, simulated: false, model: OPENAI_MODEL } satisfies CaptureResponse);
    } catch (e) {
      console.error("[capture] OpenAI failed, falling back", e);
      const items = heuristicCapture(body.text, body.now, body.categories);
      return NextResponse.json({
        items,
        simulated: true,
        error: "The AI service is unavailable right now, so this result comes from the offline parser. Please double-check it.",
      } satisfies CaptureResponse);
    }
  }
  const items = heuristicCapture(body.text, body.now, body.categories);
  return NextResponse.json({ items, simulated: true } satisfies CaptureResponse);
}
