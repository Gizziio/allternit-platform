"use client";

import React, { useEffect, useRef } from "react";
import type { Agent, AvatarConfig } from "@/lib/agents/agent.types";
import { GizziMascot } from "@/components/ai-elements/GizziMascot";
import { AgentAvatar } from "@/components/Avatar";
import { MascotPreview } from "@/views/agent-view/components/AgentMascotPreview";
import { getBotDisplayName } from "@/lib/bots/bot-profile";

interface BotAvatarProps {
  bot: Agent;
  size?: number;
  className?: string;
}

export function botInitials(name: string): string {
  return (name || "Bot")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function PetAvatar({ spriteUrl, size }: { spriteUrl: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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
      ctx.fillText("Could not load", 8, size / 2);
    };
    img.src = spriteUrl;
  }, [spriteUrl, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export function BotAvatar({ bot, size = 64, className = "" }: BotAvatarProps) {
  const displayName = getBotDisplayName(bot);
  const avatarConfig = (bot as any).avatar || (bot.config as any)?.avatar;
  const accentColor = bot.botProfile?.accentColor || "var(--accent-primary)";

  // Canonical Gizzi bot fallback: if the bot is explicitly named gizzi or its
  // character declares the gizzi mascot, render the Gizzi mascot even when no
  // avatar config is set (common for legacy/default seeds).
  const isGizziBot =
    bot.name?.toLowerCase() === "gizzi" ||
    (bot as any).character?.mascot === "gizzi" ||
    (bot.characterLayer?.avatar as AvatarConfig | undefined)?.mascotTemplate === "gizzi";

  // Image avatar
  if (avatarConfig?.type === "image" && avatarConfig.uri) {
    return (
      <img
        src={avatarConfig.uri}
        alt={displayName}
        className={`rounded-2xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Codex-style pet avatar
  if (avatarConfig?.pet?.spriteUrl) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] ${className}`}
        style={{ width: size, height: size }}
      >
        <PetAvatar spriteUrl={avatarConfig.pet.spriteUrl} size={size - 8} />
      </div>
    );
  }

  // Gizzi mascot
  if (
    avatarConfig?.type === "mascot" &&
    (avatarConfig.mascotTemplate === "gizzi" || avatarConfig.mascot?.template === "gizzi")
  ) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
          border: `2px solid ${accentColor}35`,
        }}
      >
        <GizziMascot size={Math.round(size * 0.85)} emotion={avatarConfig.currentEmotion || "pleased"} />
      </div>
    );
  }

  // Other mascot templates
  if (avatarConfig?.type === "mascot") {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
          border: `2px solid ${accentColor}35`,
        }}
      >
        <div style={{ transform: `scale(${size / 100})` }}>
          <MascotPreview config={avatarConfig} name="" />
        </div>
      </div>
    );
  }

  // Full AgentAvatar config (eyes/antennas/body)
  if (
    avatarConfig &&
    (avatarConfig.eyes || avatarConfig.antennas || avatarConfig.baseShape)
  ) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
        }}
      >
        <AgentAvatar config={avatarConfig} size={size - 8} emotion="pleased" isAnimating={false} showGlow={false} />
      </div>
    );
  }

  // Gizzi mascot fallback for canonical/default Gizzi bots that don't have an
  // explicit avatar config yet (legacy seeds, fresh databases, etc.).
  if (isGizziBot) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
          border: `2px solid ${accentColor}35`,
        }}
      >
        <GizziMascot size={Math.round(size * 0.85)} emotion="pleased" />
      </div>
    );
  }

  // Fallback initials
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl text-[20px] font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
        color: accentColor,
        border: `2px solid ${accentColor}35`,
      }}
    >
      {botInitials(displayName)}
    </div>
  );
}
