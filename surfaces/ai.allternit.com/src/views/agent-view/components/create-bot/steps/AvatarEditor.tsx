"use client";

import React, { useMemo, useRef } from "react";
import { Ghost, Image as ImageIcon, Robot, Sparkle, Tag, UploadSimple } from "@phosphor-icons/react";
import type { CreateAgentInput, MascotTemplate } from "@/lib/agents/agent.types";
import {
  AgentAvatarPicker,
  type AvatarPickerConfig,
} from "@/views/agent-view/components/AgentAvatarPicker";
import { GizziMascot, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { MascotPreview } from "@/views/agent-view/components/AgentMascotPreview";
import { MASCOT_TEMPLATES } from "@/views/agent-view/AgentView.constants";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AvatarMode = "initials" | "gizzi" | "mascot" | "image" | "pet";

export const GIZZI_EMOTIONS: GizziEmotion[] = [
  "pleased",
  "curious",
  "focused",
  "steady",
  "alert",
  "proud",
];

/** Single source of truth for the mascot catalogue (AgentView.constants). */
const MASCOT_TEMPLATE_IDS = Object.keys(MASCOT_TEMPLATES) as MascotTemplate[];

const GIZZI_COLORS = [
  "#B08D6E",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#64748b",
];

export interface AvatarEditorState {
  avatarMode: AvatarMode;
  setAvatarMode: (mode: AvatarMode) => void;
  avatarPicker: AvatarPickerConfig;
  setAvatarPicker: React.Dispatch<React.SetStateAction<AvatarPickerConfig>>;
  mascotTemplate: MascotTemplate;
  setMascotTemplate: (t: MascotTemplate) => void;
  gizziColor: string;
  setGizziColor: (c: string) => void;
  gizziEmotion: GizziEmotion;
  setGizziEmotion: (e: GizziEmotion) => void;
  imageDataUrl: string | null;
  setImageDataUrl: (url: string | null) => void;
  petUrl: string;
  setPetUrl: (url: string) => void;
}

interface AvatarEditorProps extends AvatarEditorState {
  botProfile: NonNullable<CreateAgentInput["botProfile"]>;
  onError: (message: string) => void;
}

/**
 * The five avatar modes from the previous Create Bot form, lifted as-is —
 * same controls, same preview, same behavior. Owned by CreateBotWizard so the
 * submit path and the live preview can both build the AvatarConfig.
 */
export function AvatarEditor({ botProfile, onError, ...state }: AvatarEditorProps) {
  const accentColor = botProfile.accentColor || "var(--accent-primary)";
  const displayName = botProfile.displayName || "Bot";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    avatarMode,
    setAvatarMode,
    avatarPicker,
    setAvatarPicker,
    mascotTemplate,
    setMascotTemplate,
    gizziColor,
    setGizziColor,
    gizziEmotion,
    setGizziEmotion,
    imageDataUrl,
    setImageDataUrl,
    petUrl,
    setPetUrl,
  } = state;

  const handleImageUpload = (file: File) => {
    if (file.size > 15_000_000) {
      onError("Image too large (max 15MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAvatarMode("image");
    };
    reader.onerror = () => onError("Failed to read image.");
    reader.readAsDataURL(file);
  };

  const preview = useMemo(() => {
    switch (avatarMode) {
      case "initials":
        return (
          <div
            className="flex items-center justify-center rounded-2xl text-[28px] font-bold"
            style={{
              width: 96,
              height: 96,
              background: avatarPicker.bgColor,
              color: avatarPicker.textColor,
              borderRadius:
                avatarPicker.shape === "circle"
                  ? "50%"
                  : avatarPicker.shape === "rounded"
                    ? "20px"
                    : "8px",
            }}
          >
            {avatarPicker.initial || displayName.slice(0, 2).toUpperCase()}
          </div>
        );
      case "image":
        return imageDataUrl ? (
          <img src={imageDataUrl} alt="Bot avatar" className="size-24 rounded-2xl object-cover" />
        ) : (
          <ImageIcon size={48} className="text-[var(--text-muted)]" />
        );
      case "pet":
        return petUrl ? (
          <PetPreview spriteUrl={petUrl} />
        ) : (
          <Ghost size={48} className="text-[var(--text-muted)]" />
        );
      case "mascot":
        return (
          <div className="scale-[0.72] origin-center">
            <MascotPreview
              config={{ mascotTemplate, style: { primaryColor: accentColor } }}
              name=""
            />
          </div>
        );
      case "gizzi":
      default:
        return <GizziMascot size={96} emotion={gizziEmotion} />;
    }
  }, [accentColor, avatarMode, avatarPicker, displayName, gizziEmotion, imageDataUrl, mascotTemplate, petUrl]);

  return (
    <div>
      {/* Preview */}
      <div className="flex justify-center mb-6">
        <div
          className="flex size-36 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
          style={{ boxShadow: `0 0 40px ${accentColor}18` }}
        >
          {preview}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <ModeButton active={avatarMode === "gizzi"} onClick={() => setAvatarMode("gizzi")} icon={Robot} label="Gizzi" />
        <ModeButton active={avatarMode === "mascot"} onClick={() => setAvatarMode("mascot")} icon={Sparkle} label="Mascot" />
        <ModeButton active={avatarMode === "initials"} onClick={() => setAvatarMode("initials")} icon={Tag} label="Initials" />
        <ModeButton active={avatarMode === "image"} onClick={() => setAvatarMode("image")} icon={ImageIcon} label="Image" />
        <ModeButton active={avatarMode === "pet"} onClick={() => setAvatarMode("pet")} icon={Ghost} label="Pet" />
      </div>

      {/* Mode-specific controls */}
      {avatarMode === "gizzi" && (
        <div className="space-y-5">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Gizzi color</Label>
            <div className="flex flex-wrap gap-2">
              {GIZZI_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setGizziColor(color)}
                  className={cn(
                    "size-9 rounded-full transition-transform hover:scale-110",
                    gizziColor === color &&
                      "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-card)]",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Mood</Label>
            <div className="flex flex-wrap gap-2">
              {GIZZI_EMOTIONS.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => setGizziEmotion(emotion)}
                  className={cn(
                    "h-9 rounded-full px-4 text-[12px] font-medium capitalize transition-colors",
                    gizziEmotion === emotion
                      ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                  )}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {avatarMode === "mascot" && (
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Mascot catalogue</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[280px] overflow-auto p-1">
            {MASCOT_TEMPLATE_IDS.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setMascotTemplate(template)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                  mascotTemplate === template
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]",
                )}
              >
                <div className="scale-[0.55] origin-center">
                  <MascotPreview
                    config={{ mascotTemplate: template, style: { primaryColor: accentColor } }}
                    name=""
                  />
                </div>
                <span className="text-[11px] font-medium capitalize text-[var(--text-primary)]">{template}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {avatarMode === "initials" && (
        <div className="max-w-[400px]">
          <AgentAvatarPicker name={displayName} config={avatarPicker} onChange={setAvatarPicker} />
        </div>
      )}

      {avatarMode === "image" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full gap-1.5"
          >
            <UploadSimple size={14} />
            Upload an image
          </Button>
          {imageDataUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setImageDataUrl(null);
                setAvatarMode("gizzi");
              }}
            >
              Remove image — use Gizzi
            </Button>
          )}
        </div>
      )}

      {avatarMode === "pet" && (
        <div className="space-y-3">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
              Codex-style spritesheet URL
            </Label>
            <Input
              value={petUrl}
              onChange={(e) => setPetUrl(e.target.value)}
              placeholder="https://example.com/pet.webp"
              className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Spritesheets should be 8 columns × 9 rows of 192×208 px frames.
          </p>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function PetPreview({ spriteUrl }: { spriteUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 192, 208, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "var(--text-tertiary)";
      ctx.font = "10px sans-serif";
      ctx.fillText("Could not load", 8, 60);
    };
    img.src = spriteUrl;
  }, [spriteUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={104}
      className="rounded-lg"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
