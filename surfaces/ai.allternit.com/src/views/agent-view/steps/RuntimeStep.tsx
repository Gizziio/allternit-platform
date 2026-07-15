import React from "react";
import {
  GearSix,
  Robot,
  Headphones,
  SpeakerHigh,
  SpeakerSlash,
  Play,
  CircleNotch,
} from "@phosphor-icons/react";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import type { Voice } from "@/lib/agents/voice.service";
import { AGENT_MODELS } from "../AgentView.constants";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Slider,
  Switch,
  Label,
  Skeleton,
} from "@/components/ui";

interface ApiModel {
  id: string;
  name: string;
  provider: string;
}

interface RuntimeStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  apiModels: ApiModel[];
  isModelsLoading: boolean;
  voices: Voice[];
  voiceLoading: boolean;
  isPlaying: boolean;
  handleVoicePreview: () => void | Promise<void>;
}

export function RuntimeStep({
  formData,
  setFormData,
  apiModels,
  isModelsLoading,
  voices,
  voiceLoading,
  isPlaying,
  handleVoicePreview,
}: RuntimeStepProps) {
  const getToneValue = (toneId: string): number => {
    const config = formData.config as Record<string, unknown> | undefined;
    const voice = config?.voice as Record<string, unknown> | undefined;
    const tone = voice?.tone as Record<string, number> | undefined;
    return tone?.[toneId] ?? 0.5;
  };

  const setToneValue = (toneId: string, value: number) => {
    setFormData((prev) => {
      const prevConfig = prev.config as Record<string, unknown> | undefined;
      const prevVoice = prevConfig?.voice as Record<string, unknown> | undefined;
      const prevTone = prevVoice?.tone as Record<string, number> | undefined;
      return {
        ...prev,
        config: {
          ...(prevConfig || {}),
          voice: {
            ...(prevVoice || {}),
            tone: {
              ...(prevTone || { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 }),
              [toneId]: value,
            },
          },
        },
      };
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <GearSix size={20} className="text-[var(--accent-primary)]" />
            Runtime Configuration
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
            Configure model, tooling, and runtime behaviors.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
            <Robot size={18} className="text-[var(--accent-primary)]" />
            Model Configuration
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
            <div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Intelligence Model</div>
              {isModelsLoading ? (
                <Skeleton className="h-[42px]" />
              ) : (
                <Select
                  value={formData.model}
                  onValueChange={(value) => {
                    setFormData((prev) => {
                      const selectedModel = apiModels.find(m => m.id === value);
                      if (selectedModel) {
                        return { ...prev, model: value, provider: selectedModel.provider as CreateAgentInput["provider"] };
                      }
                      return { ...prev, model: value };
                    });
                  }}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000] max-h-[400px] w-[300px]">
                    {(apiModels.length > 0 ? apiModels : AGENT_MODELS).map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col gap-0.5 py-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              model.provider === 'openai' ? 'bg-[#10a37f]' : 
                              model.provider === 'anthropic' ? 'bg-[#d97757]' : 
                              'bg-[var(--status-info)]'
                            }`} />
                            <span className="font-semibold text-[13px]">{model.name}</span>
                          </div>
                          <span className="text-[12px] text-[var(--text-muted)] ml-4">
                            {model.provider.toUpperCase()} • {model.id}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Provider</div>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: value as CreateAgentInput["provider"],
                  }))
                }
              >
                <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000]">
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Max Iterations: {formData.maxIterations}</div>
              <Slider
                value={[formData.maxIterations || 10]}
                onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                min={1}
                max={50}
                step={1}
              />
            </div>

            <div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Temperature: {formData.temperature}</div>
              <Slider
                value={[formData.temperature || 0.7]}
                onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-6" />

        <div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
            <Headphones size={18} className="text-[var(--accent-primary)]" />
            Voice Settings
          </h3>
          <div className="flex items-center justify-between p-4 rounded-[10px] border border-solid border-[var(--border-subtle)] mb-4">
            <div className="flex items-center gap-3">
              {formData.voice?.enabled ? (
                <SpeakerHigh size={20} className="text-[var(--status-success)]" />
              ) : (
                <SpeakerSlash size={20} className="text-[var(--text-muted)]" />
              )}
              <div>
                <div className="font-medium text-[var(--text-primary)]">Enable Voice</div>
                <div className="text-[13px] text-[var(--text-secondary)]">
                  Allow this agent to speak responses using text-to-speech.
                </div>
              </div>
            </div>
            <Switch
              checked={formData.voice?.enabled || false}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  voice: { voiceId: "default", ...prev.voice, enabled: checked },
                }))
              }
            />
          </div>

          {formData.voice?.enabled && (
            <div className="border-l-2 border-solid border-[var(--accent-primary)]/40 pl-4">
              <div className="mb-4">
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice</div>
                <div className="flex gap-2">
                  <Select
                    value={formData.voice?.voiceId || "default"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        voice: { enabled: true, voiceId: value, ...prev.voice },
                      }))
                    }
                    aria-disabled={voiceLoading}
                  >
                    <SelectTrigger className="flex-1 bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000]">
                      {voices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2.5 py-0.5">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                voice.engine === "chatterbox" ? "bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.4)]" : 
                                voice.engine === "xtts_v2" ? "bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.4)]" : 
                                "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                              }`}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{voice.label}</span>
                              <span className="text-[12px] text-[var(--text-muted)]">
                                {voice.engine.toUpperCase()} {!voice.assetReady ? " (Download Required)" : ""}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={handleVoicePreview}
                    disabled={!formData.voice?.enabled || isPlaying}
                    className="p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
                  >
                    {isPlaying ? (
                      <CircleNotch size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Label className="text-[12px] text-[var(--text-secondary)]">Voice Tone Modifiers</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {[
                    { id: 'formality', label: 'Formality' },
                    { id: 'enthusiasm', label: 'Enthusiasm' },
                    { id: 'empathy', label: 'Empathy' },
                    { id: 'directness', label: 'Directness' }
                  ].map((tone) => (
                    <div key={tone.id}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[12px] text-[var(--text-muted)]">{tone.label}</span>
                        <span className="text-[12px] text-[var(--accent-primary)]">{getToneValue(tone.id) * 100}%</span>
                      </div>
                      <Slider
                        value={[getToneValue(tone.id) * 100]}
                        onValueChange={([val]) => setToneValue(tone.id, val / 100)}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">Auto-Speak Responses</div>
                    <div className="text-[13px] text-[var(--text-secondary)]">Automatically speak all agent responses.</div>
                  </div>
                  <Switch
                    checked={((formData.config as Record<string, unknown> | undefined)?.voice as Record<string, unknown> | undefined)?.autoSpeak === true}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      config: {
                        ...(prev.config || {}),
                        voice: { ...((prev.config as Record<string, unknown> | undefined)?.voice as Record<string, unknown> | undefined) || {}, autoSpeak: checked }
                      }
                    }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
