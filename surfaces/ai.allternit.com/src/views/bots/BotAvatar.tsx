"use client";

/**
 * Bot Avatar Renderer
 *
 * Renders a bot's stored or deterministic avatar. Supports geometric shapes,
 * pet faces, and external images. Falls back to initials when no avatar is
 * provided.
 *
 * @module BotAvatar
 */

import React, { useMemo } from 'react';
import type {
  BotAvatar,
  BotGeometricAvatar,
  BotPetAvatar,
  BotImageAvatar,
} from '@/lib/bots/bot-avatar.service';

export interface BotAvatarProps {
  avatar?: BotAvatar;
  name: string;
  size?: number;
  className?: string;
}

function botInitials(name: string): string {
  return (name || 'Bot')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function GeometricAvatar({
  data,
  size,
}: {
  data: BotGeometricAvatar;
  size: number;
}) {
  const { shape, primaryColor, secondaryColor, eyePreset } = data;

  const bodyPath = useMemo(() => {
    switch (shape) {
      case 'square':
        return `M 8 8 L ${size - 8} 8 L ${size - 8} ${size - 8} L 8 ${size - 8} Z`;
      case 'rounded':
        return `M 16 8 L ${size - 16} 8 Q ${size - 8} 8 ${size - 8} 16 L ${size - 8} ${size - 16} Q ${size - 8} ${size - 8} ${size - 16} ${size - 8} L 16 ${size - 8} Q 8 ${size - 8} 8 ${size - 16} L 8 16 Q 8 8 16 8 Z`;
      case 'hex':
        return `M ${size * 0.25} 6 L ${size * 0.75} 6 L ${size - 6} ${size * 0.5} L ${size * 0.75} ${size - 6} L ${size * 0.25} ${size - 6} L 6 ${size * 0.5} Z`;
      case 'diamond':
        return `M ${size * 0.5} 6 L ${size - 6} ${size * 0.5} L ${size * 0.5} ${size - 6} L 6 ${size * 0.5} Z`;
      case 'circle':
      default:
        return `M ${size * 0.5} 6 A ${size * 0.5 - 6} ${size * 0.5 - 6} 0 1 1 ${size * 0.5} ${size - 6} A ${size * 0.5 - 6} ${size * 0.5 - 6} 0 1 1 ${size * 0.5} 6 Z`;
    }
  }, [shape, size]);

  const eyeRadius = size * 0.08;
  const leftEyeCx = size * 0.35;
  const rightEyeCx = size * 0.65;
  const eyeCy = size * 0.42;

  const eyeElements = useMemo(() => {
    switch (eyePreset) {
      case 'wide':
        return (
          <>
            <ellipse cx={leftEyeCx} cy={eyeCy} rx={eyeRadius * 1.2} ry={eyeRadius * 0.9} fill={secondaryColor} />
            <ellipse cx={rightEyeCx} cy={eyeCy} rx={eyeRadius * 1.2} ry={eyeRadius * 0.9} fill={secondaryColor} />
            <circle cx={leftEyeCx} cy={eyeCy} r={eyeRadius * 0.35} fill={primaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy} r={eyeRadius * 0.35} fill={primaryColor} />
          </>
        );
      case 'narrow':
        return (
          <>
            <line x1={leftEyeCx - eyeRadius} y1={eyeCy} x2={leftEyeCx + eyeRadius} y2={eyeCy} stroke={secondaryColor} strokeWidth={size * 0.04} strokeLinecap="round" />
            <line x1={rightEyeCx - eyeRadius} y1={eyeCy} x2={rightEyeCx + eyeRadius} y2={eyeCy} stroke={secondaryColor} strokeWidth={size * 0.04} strokeLinecap="round" />
          </>
        );
      case 'focused':
        return (
          <>
            <circle cx={leftEyeCx} cy={eyeCy} r={eyeRadius} fill={secondaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy} r={eyeRadius} fill={secondaryColor} />
            <circle cx={leftEyeCx} cy={eyeCy} r={eyeRadius * 0.45} fill={primaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy} r={eyeRadius * 0.45} fill={primaryColor} />
          </>
        );
      case 'curious':
        return (
          <>
            <circle cx={leftEyeCx} cy={eyeCy - 2} r={eyeRadius} fill={secondaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy + 2} r={eyeRadius} fill={secondaryColor} />
            <circle cx={leftEyeCx} cy={eyeCy - 2} r={eyeRadius * 0.35} fill={primaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy + 2} r={eyeRadius * 0.35} fill={primaryColor} />
          </>
        );
      case 'round':
      default:
        return (
          <>
            <circle cx={leftEyeCx} cy={eyeCy} r={eyeRadius} fill={secondaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy} r={eyeRadius} fill={secondaryColor} />
            <circle cx={leftEyeCx} cy={eyeCy} r={eyeRadius * 0.35} fill={primaryColor} />
            <circle cx={rightEyeCx} cy={eyeCy} r={eyeRadius * 0.35} fill={primaryColor} />
          </>
        );
    }
  }, [eyePreset, primaryColor, secondaryColor, leftEyeCx, rightEyeCx, eyeCy, eyeRadius, size]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${data.seed} bot avatar`}>
      <defs>
        <linearGradient id={`bot-avatar-gradient-${data.seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
      <path d={bodyPath} fill={`url(#bot-avatar-gradient-${data.seed})`} />
      {eyeElements}
      <path
        d={`M ${size * 0.35} ${size * 0.65} Q ${size * 0.5} ${size * 0.75} ${size * 0.65} ${size * 0.65}`}
        stroke={secondaryColor}
        strokeWidth={size * 0.04}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function PetAvatar({ data, size }: { data: BotPetAvatar; size: number }) {
  const { species, primaryColor, secondaryColor, accessory } = data;
  const cx = size * 0.5;
  const cy = size * 0.55;
  const r = size * 0.3;

  const ears = useMemo(() => {
    switch (species) {
      case 'cat':
        return (
          <>
            <polygon points={`${cx - r * 0.8},${cy - r * 0.4} ${cx - r * 0.2},${cy - r * 1.1} ${cx + r * 0.1},${cy - r * 0.4}`} fill={primaryColor} />
            <polygon points={`${cx + r * 0.8},${cy - r * 0.4} ${cx + r * 0.2},${cy - r * 1.1} ${cx - r * 0.1},${cy - r * 0.4}`} fill={primaryColor} />
          </>
        );
      case 'dog':
        return (
          <>
            <ellipse cx={cx - r * 0.7} cy={cy - r * 0.5} rx={r * 0.35} ry={r * 0.7} fill={primaryColor} transform={`rotate(-20 ${cx - r * 0.7} ${cy - r * 0.5})`} />
            <ellipse cx={cx + r * 0.7} cy={cy - r * 0.5} rx={r * 0.35} ry={r * 0.7} fill={primaryColor} transform={`rotate(20 ${cx + r * 0.7} ${cy - r * 0.5})`} />
          </>
        );
      case 'rabbit':
        return (
          <>
            <ellipse cx={cx - r * 0.5} cy={cy - r * 0.8} rx={r * 0.22} ry={r * 0.7} fill={primaryColor} />
            <ellipse cx={cx + r * 0.5} cy={cy - r * 0.8} rx={r * 0.22} ry={r * 0.7} fill={primaryColor} />
          </>
        );
      case 'fox':
        return (
          <>
            <polygon points={`${cx - r * 0.9},${cy - r * 0.2} ${cx - r * 0.1},${cy - r * 0.9} ${cx - r * 0.1},${cy - r * 0.2}`} fill={primaryColor} />
            <polygon points={`${cx + r * 0.9},${cy - r * 0.2} ${cx + r * 0.1},${cy - r * 0.9} ${cx + r * 0.1},${cy - r * 0.2}`} fill={primaryColor} />
          </>
        );
      case 'owl':
        return (
          <>
            <polygon points={`${cx - r * 0.6},${cy - r * 0.7} ${cx - r * 0.2},${cy - r * 1.2} ${cx + r * 0.1},${cy - r * 0.6}`} fill={primaryColor} />
            <polygon points={`${cx + r * 0.6},${cy - r * 0.7} ${cx + r * 0.2},${cy - r * 1.2} ${cx - r * 0.1},${cy - r * 0.6}`} fill={primaryColor} />
          </>
        );
      case 'robot':
      default:
        return (
          <>
            <rect x={cx - r * 0.8} y={cy - r * 1.1} width={r * 0.35} height={r * 0.5} rx={2} fill={secondaryColor} />
            <rect x={cx + r * 0.45} y={cy - r * 1.1} width={r * 0.35} height={r * 0.5} rx={2} fill={secondaryColor} />
          </>
        );
    }
  }, [species, cx, cy, r, primaryColor, secondaryColor]);

  const accessoryElement = useMemo(() => {
    if (accessory === 'glasses') {
      return (
        <>
          <circle cx={cx - r * 0.35} cy={cy - r * 0.05} r={r * 0.22} stroke={secondaryColor} strokeWidth={size * 0.025} fill="none" />
          <circle cx={cx + r * 0.35} cy={cy - r * 0.05} r={r * 0.22} stroke={secondaryColor} strokeWidth={size * 0.025} fill="none" />
          <line x1={cx - r * 0.13} y1={cy - r * 0.05} x2={cx + r * 0.13} y2={cy - r * 0.05} stroke={secondaryColor} strokeWidth={size * 0.025} />
        </>
      );
    }
    if (accessory === 'bow') {
      return (
        <>
          <polygon points={`${cx},${cy - r * 0.9} ${cx - r * 0.25},${cy - r * 1.15} ${cx - r * 0.25},${cy - r * 0.65}`} fill={secondaryColor} />
          <polygon points={`${cx},${cy - r * 0.9} ${cx + r * 0.25},${cy - r * 1.15} ${cx + r * 0.25},${cy - r * 0.65}`} fill={secondaryColor} />
          <circle cx={cx} cy={cy - r * 0.9} r={r * 0.08} fill={secondaryColor} />
        </>
      );
    }
    if (accessory === 'headset') {
      return (
        <>
          <path d={`M ${cx - r * 0.6} ${cy - r * 0.9} Q ${cx} ${cy - r * 1.4} ${cx + r * 0.6} ${cy - r * 0.9}`} stroke={secondaryColor} strokeWidth={size * 0.04} fill="none" />
          <rect x={cx + r * 0.55} y={cy - r * 0.95} width={r * 0.25} height={r * 0.35} rx={2} fill={secondaryColor} />
        </>
      );
    }
    return null;
  }, [accessory, cx, cy, r, secondaryColor, size]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${species} bot avatar`}>
      <defs>
        <linearGradient id={`bot-pet-gradient-${data.seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
      {ears}
      {accessoryElement}
      <circle cx={cx} cy={cy} r={r} fill={`url(#bot-pet-gradient-${data.seed})`} />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill={secondaryColor} />
      <circle cx={cx + r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill={secondaryColor} />
      <ellipse cx={cx} cy={cy + r * 0.25} rx={r * 0.18} ry={r * 0.12} fill={secondaryColor} />
    </svg>
  );
}

function ImageAvatar({ data, size }: { data: BotImageAvatar; size: number }) {
  return (
    <img
      src={data.url}
      alt={data.alt || 'Bot avatar'}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 'inherit' }}
      loading="lazy"
    />
  );
}

export function BotAvatar({ avatar, name, size = 40, className }: BotAvatarProps) {
  const initials = useMemo(() => botInitials(name), [name]);

  if (!avatar) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#4b5563',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          fontWeight: 700,
        }}
        role="img"
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1f2937',
      }}
    >
      {avatar.type === 'geometric' && <GeometricAvatar data={avatar.data as BotGeometricAvatar} size={size} />}
      {avatar.type === 'pet' && <PetAvatar data={avatar.data as BotPetAvatar} size={size} />}
      {avatar.type === 'image' && <ImageAvatar data={avatar.data as BotImageAvatar} size={size} />}
    </div>
  );
}
