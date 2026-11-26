import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { guardAiRequest } from "@/lib/ai/guard";
import { isOpenAIConfigured } from "@/lib/ai/openai";

export const maxDuration = 60;

const PROMPT =
  "The speaker may mix Kazakh, Russian and English words in the same sentence. Transcribe every word in the language and script it was spoken in (Kazakh in Kazakh Cyrillic, Russian in Russian, English in Latin letters). Personal organizer: tasks, reminders, notes. Мысалы: ертең сағат үште professor-ға позвонить ету керек.";

/** Speech-to-text for mixed Kazakh / Russian / English using OpenAI's transcription models. */
export async function POST(req: Request) {
  const blocked = await guardAiRequest(req);
  if (blocked) return blocked;
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "Server transcription needs an OpenAI key." }, { status: 501 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File) file = f;
  } catch {
    /* fallthrough */
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Recording is too long." }, { status: 413 });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 1 });
  const upload = await toFile(Buffer.from(await file.arrayBuffer()), file.name || "audio.webm", { type: file.type || "audio/webm" });
  const models = [process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe", "whisper-1"];
  for (const model of [...new Set(models)]) {
    try {
      const r = await client.audio.transcriptions.create({ file: upload, model, prompt: PROMPT });
      return NextResponse.json({ text: r.text?.trim() ?? "", model });
    } catch (e) {
      console.error(`[transcribe] ${model} failed`, e);
    }
  }
  return NextResponse.json({ error: "Transcription failed. Please try again." }, { status: 502 });
}
