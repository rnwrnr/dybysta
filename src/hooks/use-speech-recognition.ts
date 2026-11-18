"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import type { VoiceLanguage } from "@/lib/types";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike { isFinal: boolean; 0: SpeechRecognitionAlternativeLike; length: number }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings to use voice.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser context.",
  "no-speech": "I didn't hear anything — try again a bit closer to the mic.",
  "audio-capture": "No microphone found. Check that one is connected.",
  network: "Speech recognition needs an internet connection in this browser.",
  "language-not-supported": "This language isn't supported by your browser's speech engine.",
};

export function useSpeechRecognition(opts: { lang: VoiceLanguage; onFinal: (text: string) => void }) {
  const { t } = useT();
  const tRef = React.useRef(t);
  tRef.current = t;
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = React.useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;
  const wantRef = React.useRef(false);

  React.useEffect(() => setSupported(Boolean(getCtor())), []);

  const stop = React.useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const C = getCtor();
    if (!C) {
      setError(tRef.current("Voice input isn't supported in this browser. Try Chrome, Edge or Safari."));
      return;
    }
    recRef.current?.abort();
    const rec = new C();
    rec.lang = opts.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim());
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      setError(ERRORS[e.error] ? tRef.current(ERRORS[e.error]) : tRef.current("Voice input error: {e}", { e: e.error }));
      if (e.error !== "no-speech") wantRef.current = false;
    };
    rec.onend = () => {
      setInterim("");
      // Some browsers end sessions after silence; restart while the user still wants to listen.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fallthrough */
        }
      }
      setListening(false);
    };
    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
    } catch {
      setError(tRef.current("Couldn't start the microphone. Please try again."));
      wantRef.current = false;
    }
  }, [opts.lang]);

  // Restart with the new language if it changes mid-session.
  React.useEffect(() => {
    if (wantRef.current) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.lang]);

  React.useEffect(() => () => {
    wantRef.current = false;
    recRef.current?.abort();
  }, []);

  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}
