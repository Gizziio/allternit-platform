import { useCallback, useEffect, useRef, useState } from "react";

type DesktopVoice = {
  isAvailable?: () => Promise<boolean>;
  transcribe?: (wav: ArrayBuffer) => Promise<{ text?: string; error?: string }>;
};

const SIDECAR = "http://127.0.0.1:8001";

function desktopVoice(): DesktopVoice | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { allternit?: { voice?: DesktopVoice } })
    .allternit?.voice;
  return api ?? null;
}

function floatToWav(float32: Float32Array, sampleRate: number): ArrayBuffer {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(bytes.buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  bytes.set(new Uint8Array(pcm.buffer), 44);
  return bytes.buffer;
}

async function transcribeWav(wav: ArrayBuffer): Promise<string> {
  const desktop = desktopVoice();
  if (desktop?.transcribe) {
    const result = await desktop.transcribe(wav);
    if (result.error) throw new Error(result.error);
    return (result.text ?? "").trim();
  }
  const body = new FormData();
  body.append("audio", new Blob([wav], { type: "audio/wav" }), "utterance.wav");
  body.append("language", "en");
  const response = await fetch(`${SIDECAR}/v1/stt`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Voice sidecar HTTP ${response.status}`);
  }
  const json = (await response.json()) as { text?: string };
  return (json.text ?? "").trim();
}

export function useComposerVoice(opts: {
  enabled: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sampleRateRef = useRef(16000);
  const onTranscriptRef = useRef(opts.onTranscript);
  const onErrorRef = useRef(opts.onError);
  onTranscriptRef.current = opts.onTranscript;
  onErrorRef.current = opts.onError;

  const stopCapture = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(async () => {
    if (!listening && chunksRef.current.length === 0) return;
    setListening(false);
    const chunks = chunksRef.current;
    chunksRef.current = [];
    stopCapture();
    const length = chunks.reduce((n, c) => n + c.length, 0);
    if (length < 1600) {
      onErrorRef.current?.("No speech was detected. Voice stopped.");
      return;
    }
    const merged = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    setProcessing(true);
    try {
      const wav = floatToWav(merged, sampleRateRef.current);
      const text = await transcribeWav(wav);
      if (text) onTranscriptRef.current(text);
      else onErrorRef.current?.("No speech was detected. Voice stopped.");
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error ? err.message : "Voice transcription failed.",
      );
    } finally {
      setProcessing(false);
    }
  }, [listening, stopCapture]);

  const start = useCallback(async () => {
    if (listening || processing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const ctx = new AudioContext({ sampleRate: 16000 });
      sampleRateRef.current = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      streamRef.current = stream;
      ctxRef.current = ctx;
      processorRef.current = processor;
      chunksRef.current = [];
      setListening(true);
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error
          ? err.message
          : "Microphone access denied. Enable it in System Settings.",
      );
    }
  }, [listening, processing]);

  const toggle = useCallback(() => {
    if (listening) void finish();
    else void start();
  }, [listening, finish, start]);

  useEffect(() => {
    if (!opts.enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isVoiceKey =
        (e.code === "Space" && e.ctrlKey) || e.key === "F8";
      if (!isVoiceKey) return;
      e.preventDefault();
      if (e.repeat) return;
      void start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const isVoiceKey =
        (e.code === "Space" && e.ctrlKey) || e.key === "F8";
      if (!isVoiceKey) return;
      e.preventDefault();
      void finish();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [opts.enabled, start, finish]);

  useEffect(() => () => stopCapture(), [stopCapture]);

  return { listening, processing, toggle, start, stop: finish };
}

export const DEFAULT_VOICE_SLASH = {
  command: "/voice",
  label: "Voice dictation",
} as const;
