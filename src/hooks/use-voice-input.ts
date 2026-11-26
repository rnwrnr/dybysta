"use client";
import * as React from "react";
import { useData } from "@/lib/data/store";
import { useT } from "@/lib/i18n/provider";
import type { VoiceLanguage } from "@/lib/types";
import { useSpeechRecognition } from "./use-speech-recognition";

export type VoiceState = "idle" | "listening" | "transcribing";

/**
 * One voice input for the whole app.
 * - With an OpenAI key: records audio and transcribes it on the server, which
 *   understands Kazakh, Russian and English mixed in one sentence.
 * - Without: uses the browser's speech recognition in the chosen language.
 * `onText` receives the final text once the user stops speaking.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const { ai, preferences } = useData();
  const { t } = useT();
  const lang = (preferences.voice_language ?? "en-US") as VoiceLanguage;
  const serverMode = ai.configured;
  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;

  // --- browser speech (fallback) ---------------------------------------------
  const buffer = React.useRef("");
  const speech = useSpeechRecognition({ lang, onFinal: (txt) => (buffer.current = (buffer.current ? buffer.current + " " : "") + txt) });
  const wasListening = React.useRef(false);
  React.useEffect(() => {
    if (serverMode) return;
    if (wasListening.current && !speech.listening) {
      const text = buffer.current.trim();
      buffer.current = "";
      if (text) onTextRef.current(text);
    }
    wasListening.current = speech.listening;
  }, [speech.listening, serverMode]);

  // --- server transcription -----------------------------------------------------
  const [state, setState] = React.useState<VoiceState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState(0);
  const [seconds, setSeconds] = React.useState(0);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timers = React.useRef<number[]>([]);

  const cleanup = () => {
    timers.current.forEach((id) => clearInterval(id));
    timers.current = [];
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLevel(0);
  };

  const startServer = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("Voice input isn't supported in this browser. Try Chrome, Edge or Safari."));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("Microphone access was blocked. Allow it in your browser's site settings to use voice."));
      return;
    }
    streamRef.current = stream;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cleanup();
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1200) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const fd = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("audio", blob, `voice.${ext}`);
        const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Transcription failed");
        if (json.text) onTextRef.current(json.text);
        else setError(t("I didn't hear anything — try again a bit closer to the mic."));
      } catch (e) {
        setError(e instanceof Error ? t(e.message) : t("Something went wrong. Please try again."));
      } finally {
        setState("idle");
      }
    };
    // Simple input level meter for visual feedback.
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      timers.current.push(
        window.setInterval(() => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
        }, 80)
      );
    } catch {
      /* meter is optional */
    }
    setSeconds(0);
    timers.current.push(window.setInterval(() => setSeconds((x) => x + 1), 1000));
    // Safety stop after 2 minutes.
    timers.current.push(window.setInterval(() => rec.state === "recording" && rec.stop(), 120_000));
    rec.start();
    recRef.current = rec;
    setState("listening");
  };

  const stopServer = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  React.useEffect(() => () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    cleanup();
  }, []);

  if (serverMode) {
    return {
      mode: "server" as const,
      supported: true,
      state,
      interim: "",
      level,
      seconds,
      error,
      clearError: () => setError(null),
      start: startServer,
      stop: stopServer,
      toggle: () => (state === "listening" ? stopServer() : state === "idle" ? startServer() : undefined),
    };
  }
  const st: VoiceState = speech.listening ? "listening" : "idle";
  return {
    mode: "browser" as const,
    supported: speech.supported,
    state: st,
    interim: [buffer.current, speech.interim].filter(Boolean).join(" "),
    level: speech.listening ? 0.5 : 0,
    seconds: 0,
    error: speech.error,
    clearError: speech.clearError,
    start: speech.start,
    stop: speech.stop,
    toggle: () => (speech.listening ? speech.stop() : speech.start()),
  };
}
