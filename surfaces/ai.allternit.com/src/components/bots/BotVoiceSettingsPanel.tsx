"use client";

/**
 * BotVoiceSettingsPanel — per-bot voice selection and TTS preferences.
 *
 * Lives inside BotConfigTab. Reuses the global voice provider for the list
 * of available presets and the preview path, and persists the bot's own
 * VoiceConfig via the agent store.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SpeakerHigh,
  SpeakerSlash,
  Play,
  Stop,
  Spinner,
  Check,
  Warning,
  Phone,
  Microphone,
} from "@phosphor-icons/react";
import { GlassSurface } from "@/design/glass/GlassSurface";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent, VoiceConfig } from "@/lib/agents/agent.types";
import { useVoice } from "@/providers/voice-provider";
import { voiceService } from "@/lib/agents/voice.service";

interface BotVoiceSettingsPanelProps {
  bot: Agent;
  accentColor: string;
}

export function BotVoiceSettingsPanel({
  bot,
  accentColor,
}: BotVoiceSettingsPanelProps) {
  const { updateAgent } = useAgentStore();
  const {
    availableVoices,
    serviceAvailable,
    isLoadingVoices,
    refreshVoices,
    speak: globalSpeak,
    stopAudio,
    isPlaying,
  } = useVoice();

  const initialVoice = useMemo(
    () =>
      bot.voice ?? {
        enabled: false,
        voiceId: "default",
        voiceLabel: "Default",
        engine: "chatterbox" as const,
        autoSpeak: false,
        speakOnCheckpoint: false,
      },
    [bot.voice]
  );

  const [voice, setVoice] = useState<VoiceConfig>(initialVoice);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const callModeEnabled = useMemo(
    () => Boolean(bot.config?.voiceCallMode),
    [bot.config]
  );
  const [callMode, setCallMode] = useState(callModeEnabled);
  const [nativeDictationAvailable, setNativeDictationAvailable] = useState(false);

  // Keep local state in sync if the bot prop changes from outside.
  useEffect(() => {
    setVoice(initialVoice);
    setCallMode(callModeEnabled);
  }, [initialVoice, callModeEnabled]);

  useEffect(() => {
    setNativeDictationAvailable(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  // Load voice presets once when the service is reachable.
  useEffect(() => {
    if (serviceAvailable && availableVoices.length === 0 && !isLoadingVoices) {
      refreshVoices();
    }
  }, [serviceAvailable, availableVoices.length, isLoadingVoices, refreshVoices]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateAgent(bot.id, {
        voice,
        config: {
          ...bot.config,
          voiceCallMode: callMode,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // Error state is surfaced via the agent store; no extra toast needed.
    } finally {
      setSaving(false);
    }
  }, [bot.id, bot.config, callMode, updateAgent, voice]);

  const selectedVoiceLabel = useMemo(() => {
    if (voice.voiceId === "default" || !voice.voiceId) return "Default";
    const preset = availableVoices.find((v) => v.id === voice.voiceId);
    return preset?.label ?? voice.voiceLabel ?? voice.voiceId;
  }, [availableVoices, voice]);

  const handlePreview = useCallback(async () => {
    if (isPlaying && previewUrl) {
      stopAudio();
      setPreviewUrl(null);
      return;
    }

    if (!serviceAvailable) {
      setPreviewError("Voice service is not available.");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const text = `Hi, I'm ${bot.name || "your assistant"}. This is how I sound.`;
      const url = await voiceService.previewVoice(
        voice.voiceId && voice.voiceId !== "default" ? voice.voiceId : "default",
        text
      );
      setPreviewUrl(url);
      // Use the global speaker so isPlaying state is tracked consistently.
      await globalSpeak(text, voice.voiceId ?? undefined);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [bot.name, globalSpeak, isPlaying, previewUrl, serviceAvailable, stopAudio, voice.voiceId]);

  const canSave = useMemo(() => {
    return (
      JSON.stringify(voice) !== JSON.stringify(initialVoice) ||
      callMode !== callModeEnabled
    );
  }, [voice, initialVoice, callMode, callModeEnabled]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <SpeakerHigh size={18} style={{ color: accentColor }} />
          Voice & Speech
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Choose how this bot speaks and when it reads replies aloud.
        </p>
      </div>

      <GlassSurface
        variant="default"
        border="subtle"
        blur="md"
        opacity="medium"
        rounded="xl"
        padding="lg"
        className="space-y-6"
      >
        {/* Service status */}
        {!serviceAvailable && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--status-error)]/10 p-3 text-[13px] text-[var(--status-error)]">
            <Warning size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Voice service offline</p>
              <p className="text-[var(--text-secondary)]">
                Voice previews and TTS require the local voice service. It starts automatically in the desktop app.
              </p>
            </div>
          </div>
        )}

        {/* Enable voice */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-[13px] font-medium text-[var(--text-primary)]">
              Enable voice for this bot
            </Label>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Lets the bot speak replies and checkpoints.
            </p>
          </div>
          <Switch
            checked={voice.enabled}
            onCheckedChange={(checked) =>
              setVoice((v) => ({ ...v, enabled: checked }))
            }
          />
        </div>

        {/* Voice preset */}
        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-[var(--text-primary)]">
            Voice preset
          </Label>
          <Select
            value={voice.voiceId ?? "default"}
            onValueChange={(value) => {
              const preset = availableVoices.find((v) => v.id === value);
              setVoice((v) => ({
                ...v,
                voiceId: value,
                voiceLabel: preset?.label ?? v.voiceLabel,
                engine: (preset?.engine as VoiceConfig["engine"]) ?? v.engine,
              }));
            }}
          >
            <SelectTrigger
              className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] h-9 text-[13px]"
              disabled={!voice.enabled || (!serviceAvailable && availableVoices.length === 0)}
            >
              <span>{selectedVoiceLabel}</span>
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
              <SelectItem value="default">Default</SelectItem>
              {availableVoices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="flex items-center gap-2">
                    {v.label}
                    {v.engine && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                        {v.engine}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
              {availableVoices.length === 0 && !isLoadingVoices && serviceAvailable && (
                <SelectItem value="__refresh__" disabled>
                  No voices loaded
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {isLoadingVoices && (
            <p className="text-[12px] text-[var(--text-tertiary)] flex items-center gap-1.5">
              <Spinner size={12} className="animate-spin" />
              Loading voices…
            </p>
          )}
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-[13px] font-medium text-[var(--text-primary)]">
                Auto-speak replies
              </Label>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Read every assistant message aloud as it arrives.
              </p>
            </div>
            <Switch
              checked={voice.autoSpeak ?? false}
              onCheckedChange={(checked) =>
                setVoice((v) => ({ ...v, autoSpeak: checked }))
              }
              disabled={!voice.enabled}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-[13px] font-medium text-[var(--text-primary)]">
                Speak on checkpoints
              </Label>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Announce progress checkpoints during longer runs.
              </p>
            </div>
            <Switch
              checked={voice.speakOnCheckpoint ?? false}
              onCheckedChange={(checked) =>
                setVoice((v) => ({ ...v, speakOnCheckpoint: checked }))
              }
              disabled={!voice.enabled}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!voice.enabled || previewLoading}
            className="gap-1.5 text-[13px]"
          >
            {isPlaying && previewUrl ? (
              <>
                <Stop size={14} /> Stop
              </>
            ) : previewLoading ? (
              <>
                <Spinner size={14} className="animate-spin" /> Loading…
              </>
            ) : (
              <>
                <Play size={14} /> Preview
              </>
            )}
          </Button>
          {previewError && (
            <p className="text-[12px] text-[var(--status-error)]">{previewError}</p>
          )}
        </div>
      </GlassSurface>

      {/* Call mode */}
      <GlassSurface
        variant="default"
        border="subtle"
        blur="md"
        opacity="medium"
        rounded="xl"
        padding="lg"
        className="space-y-5"
      >
        <div className="flex items-center gap-2">
          <Phone size={18} style={{ color: accentColor }} />
          <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Call mode
          </h4>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Hands-free back-and-forth voice sessions with this bot.
        </p>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-[13px] font-medium text-[var(--text-primary)]">
              Enable call mode
            </Label>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Use your microphone to talk; the bot replies by voice.
            </p>
          </div>
          <Switch checked={callMode} onCheckedChange={setCallMode} />
        </div>

        <div className="rounded-lg bg-[var(--bg-card)] p-3 text-[12px] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
          {callMode ? (
            nativeDictationAvailable ? (
              <span className="flex items-start gap-2">
                <Microphone size={14} className="mt-0.5 shrink-0" style={{ color: accentColor }} />
                <span>
                  Call mode is on. On macOS, Safari and Chrome can use the
                  device’s on-device dictation first; otherwise the local voice
                  service STT backend is used.
                </span>
              </span>
            ) : (
              <span className="flex items-start gap-2">
                <Warning size={14} className="mt-0.5 shrink-0 text-[var(--status-warning)]" />
                <span>
                  Call mode is on, but this browser does not expose native
                  dictation. The app will fall back to the voice-service STT
                  backend.
                </span>
              </span>
            )
          ) : (
            <span>
              Turn on call mode to start hands-free voice sessions. The
              microphone is only active while you explicitly hold or toggle the
              voice input control.
            </span>
          )}
        </div>
      </GlassSurface>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVoice(initialVoice)}
          disabled={!canSave}
          className="text-[13px]"
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!canSave || saving}
          className={cn(
            "gap-1.5 text-[13px]",
            saved && "bg-[var(--status-success)] hover:bg-[var(--status-success)]"
          )}
          style={
            saved
              ? undefined
              : { backgroundColor: accentColor, color: "var(--ui-text-inverse)" }
          }
        >
          {saving ? (
            <>
              <Spinner size={14} className="animate-spin" /> Saving…
            </>
          ) : saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            "Save voice settings"
          )}
        </Button>
      </div>
    </div>
  );
}

export default BotVoiceSettingsPanel;
