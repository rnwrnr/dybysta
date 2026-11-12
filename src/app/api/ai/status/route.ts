import { NextResponse } from "next/server";
import { isOpenAIConfigured, OPENAI_MODEL } from "@/lib/ai/openai";

export async function GET() {
  const configured = isOpenAIConfigured();
  return NextResponse.json({ configured, model: configured ? OPENAI_MODEL : null });
}
