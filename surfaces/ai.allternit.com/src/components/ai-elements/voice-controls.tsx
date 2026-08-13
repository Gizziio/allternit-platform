"use client";

/**
 * Voice Controls Panel
 *
 * Settings interface for voice session configuration:
 * - Voice selector (from available backend voices)
 * - Language selector
 * - Speech rate slider (0.5x – 2x)
 * - Auto-listen toggle (continuous vs push-to-talk)
 * - Wake word toggle
 * - Audio output device selector
 *
 * Designed to embed inside a popover, drawer, or inline settings area.
 */

import React, { useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useVoice } from "@/providers/voice-provider";
import { speechToText } from "@/services/voice";
import { VoiceSessionContext } from "./voice-provider";
import {
  SpeakerHigh,
  GearSix,
  Waveform,
  Microphone,
  Globe,
} from "@phosphor-icons/react";

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-AU", label: "English (AU)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (BR)" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "ru-RU", label: "Russian" },
  { code: "nl-NL", label: "Dutch" },
  { code: "pl-PL", label: "Polish" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ar-SA", label: "Arabic" },
  { code: "hi-IN", label: "Hindi" },
] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface VoiceControlsProps {
  className?: string;
  /** Compact layout for popover embedding. */
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceControls({
  className,
  compact = false,
}: VoiceControlsProps) {
  const {
    currentVoice,
    availableVoices,
    serviceAvailable,
    setVoice,
    isLoadingVoices,
    refreshVoices,
  } = useVoice();

  const voiceSession = useContext(VoiceSessionContext);

  // Session-scoped settings (with local fallback when VoiceSessionProvider is absent)
  const [localLanguage, setLocalLanguage] = useState("en-US");
  const [localSpeechRate, setLocalSpeechRate] = useState(1.0);
  const [localAutoListen, setLocalAutoListen] = useState(false);

  const language = voiceSession?.language ?? localLanguage;
  const setLanguageFn = voiceSession?.setLanguage ?? ((lang: string) => {
    setLocalLanguage(lang);
    speechToText.setLanguage(lang);
  });
  const speechRate = voiceSession?.speechRate ?? localSpeechRate;
  const setSpeechRateFn = voiceSession?.setSpeechRate ?? setLocalSpeechRate;
  const autoListen = voiceSession?.autoListen ?? localAutoListen;
  const setAutoListenFn = voiceSession?.setAutoListen ?? setLocalAutoListen;

  // Wake word (local-only feature flag — actual detection not yet implemented)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);

  // Audio output devices
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<string>("default");

  // ── Enumerate audio output devices ────────────────────────────────────────

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === "audiooutput");
        setOutputDevices(outputs);
      } catch {
        // enumerateDevices may fail if permissions not granted
      }
    };

    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    };
  }, []);

  // ── Refresh voices on mount if needed ─────────────────────────────────────

  useEffect(() => {
    if (serviceAvailable && availableVoices.length === 0 && !isLoadingVoices) {
      refreshVoices();
    }
  }, [serviceAvailable, availableVoices.length, isLoadingVoices, refreshVoices]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleVoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setVoice(e.target.value);
    },
    [setVoice],
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguageFn(e.target.value);
    },
    [setLanguageFn],
  );

  const handleRateChange = useCallback(
    (values: number[]) => {
      setSpeechRateFn(values[0] ?? 1);
    },
    [setSpeechRateFn],
  );

  const handleOutputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedOutput(e.target.value);
      // Note: setSinkId is browser-dependent; stored for future use
    },
    [],
  );

  // ── Styles ────────────────────────────────────────────────────────────────

  const sectionClass = cn(
    "space-y-1.5",
    !compact && "mb-4",
    compact && "mb-3",
  );

  const labelClass = cn(
    "flex items-center gap-1.5 font-medium text-muted-foreground",
    compact ? "text-xs" : "text-sm",
  );

  const selectClass = cn(
    "w-full rounded-md border border-border bg-background text-foreground",
    "focus:outline-none focus:ring-1 focus:ring-ring",
    compact ? "h-7 text-xs px-2" : "h-9 text-sm px-3",
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-0", className)}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b">
          <GearSix className="size-4 text-primary" weight="bold" />
          <span className="font-semibold text-sm">Voice Settings</span>
        </div>
      )}

      {/* Voice Selector */}
      <div className={sectionClass}>
        <label className={labelClass}>
          <SpeakerHigh className="size-3.5" />
          Voice
        </label>
        <select
          value={currentVoice}
          onChange={handleVoiceChange}
          disabled={!serviceAvailable}
          className={selectClass}
        >
          <option value="default">
            {serviceAvailable ? "Default" : "Service offline"}
          </option>
          {availableVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        {serviceAvailable && availableVoices.length === 0 && (
          <button
            type="button"
            onClick={() => refreshVoices()}
            className="text-xs text-primary hover:underline"
          >
            {isLoadingVoices ? "Loading..." : "Refresh voices"}
          </button>
        )}
      </div>

      {/* Language Selector */}
      <div className={sectionClass}>
        <label className={labelClass}>
          <Globe className="size-3.5" />
          Language
        </label>
        <select
          value={language}
          onChange={handleLanguageChange}
          className={selectClass}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Speech Rate Slider */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <label className={labelClass}>
            <Waveform className="size-3.5" />
            Speed
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {speechRate.toFixed(1)}x
          </span>
        </div>
        <Slider
          value={[speechRate]}
          onValueChange={handleRateChange}
          min={0.5}
          max={2}
          step={0.1}
          className={cn("w-full", compact && "py-1")}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0.5x</span>
          <span>1x</span>
          <span>2x</span>
        </div>
      </div>

      {/* Auto-listen Toggle */}
      <div
        className={cn(
          "flex items-center justify-between",
          !compact && "py-2",
          compact && "py-1.5",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Microphone className="size-3.5 text-muted-foreground" />
          <span
            className={cn(
              "text-muted-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Auto-listen
          </span>
        </div>
        <Switch
          checked={autoListen}
          onCheckedChange={setAutoListenFn}
        />
      </div>
      <p
        className={cn(
          "text-muted-foreground -mt-1",
          compact ? "text-xs" : "text-xs",
        )}
      >
        {autoListen
          ? "Continuously listens for speech"
          : "Push-to-talk: click to speak"}
      </p>

      {/* Wake Word Toggle */}
      <div
        className={cn(
          "flex items-center justify-between",
          !compact && "py-2",
          compact && "py-1.5",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Waveform className="size-3.5 text-muted-foreground" />
          <span
            className={cn(
              "text-muted-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Wake word
          </span>
        </div>
        <Switch
          checked={wakeWordEnabled}
          onCheckedChange={setWakeWordEnabled}
        />
      </div>
      <p
        className={cn(
          "text-muted-foreground -mt-1",
          compact ? "text-xs" : "text-xs",
        )}
      >
        {wakeWordEnabled
          ? "Listens for wake word to activate"
          : "Disabled — use manual activation"}
      </p>

      {/* Audio Output Device Selector */}
      {outputDevices.length > 1 && (
        <div className={cn(sectionClass, "pt-2 border-t mt-2")}>
          <label className={labelClass}>
            <SpeakerHigh className="size-3.5" />
            Output device
          </label>
          <select
            value={selectedOutput}
            onChange={handleOutputChange}
            className={selectClass}
          >
            <option value="default">System default</option>
            {outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Device ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default VoiceControls;
