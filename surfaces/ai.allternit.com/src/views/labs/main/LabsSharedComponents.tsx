import React, { useRef, useEffect } from "react";
import {
  BookOpen,
  RefreshCw,
  ExternalLink,
  Eye,
  GraduationCap,
  Layers,
  BarChart3,
  Rocket,
  School,
  Clock,
  FileText,
  MonitorPlay,
  ChevronRight,
} from 'lucide-react';
import { GlassCardInteractive } from '@/design/glass/GlassCard';
import { GlassSurfaceThin } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';
import type { ALABSCourse, ALABSLesson } from "./LabsView.constants";
import { L } from "./LabsView.constants";

export function getTierColor(tier: string) {
  switch (tier) {
    case 'CORE': return 'var(--status-info)';
    case 'OPS': return '#8b5cf6';
    case 'AGENTS': return '#ec4899';
    case 'ADV': return 'var(--status-warning)';
    default: return 'var(--ui-text-muted)';
  }
}

export function getTierIcon(tier: string) {
  switch (tier) {
    case 'CORE': return Layers;
    case 'OPS': return BarChart3;
    case 'AGENTS': return Rocket;
    case 'ADV': return GraduationCap;
    default: return GraduationCap;
  }
}

export function useLabsReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .68s cubic-bezier(.16,1,.3,1), transform .68s cubic-bezier(.16,1,.3,1)';
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        obs.disconnect();
      }
    }, { threshold: 0.07 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export function TierBadge({ tier, color }: { tier: string; color: string }) {
  const TierIcon = getTierIcon(tier);
  return (
    <GlassSurfaceThin
      className="flex items-center gap-1.5 p-1 px-2.5 rounded-full border border-solid"
      style={{ background: `${color}14`, borderColor: `${color}30` }}
    >
      <TierIcon size={11} color={color} />
      <Text variant="label" className="text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color }}>{tier}</Text>
    </GlassSurfaceThin>
  );
}

export function CourseCard({ course, tierColor, canvasToken, onOpenNotebook, onSyncCanvas }: {
  course: ALABSCourse;
  tierColor: string;
  canvasToken: string;
  onOpenNotebook: () => void;
  onSyncCanvas: () => void;
}) {
  const ref = useLabsReveal<HTMLDivElement>();

  return (
    <div ref={ref}>
      <GlassCardInteractive
        hover="lift"
        elevation="raised"
        border="subtle"
        blur="md"
        className="overflow-hidden flex flex-col h-full"
      >
        {/* Cover image */}
        <div className="relative h-40 shrink-0 overflow-hidden group">
          <img
            src={course.coverImage}
            alt={course.title}
            className="size-full object-cover block transition-transform duration-500 ease-out group-hover:scale-110"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
          <div className="absolute top-3 left-3">
            <TierBadge tier={course.tier} color={tierColor} />
          </div>
          <div className="absolute top-3 right-3">
            <Text variant="label" className="text-[12px] font-bold text-white/45 tracking-wider">{course.modules} modules</Text>
          </div>
          <div className="absolute bottom-3 left-3.5">
            <Text variant="label" className="text-[12px] font-extrabold tracking-widest uppercase" style={{ color: `${tierColor}bb` }}>{course.code}</Text>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <Text variant="researchHeading" as="h3" className="text-[17px] font-black italic m-0 mb-2.5 tracking-tight leading-snug text-[var(--ui-text-primary)]">
            {course.title}
          </Text>

          <Text variant="body" className="text-[13px] text-[var(--ui-text-secondary)] m-0 mb-4 leading-relaxed line-clamp-3">
            {course.description}
          </Text>

          {/* Capstone box */}
          <GlassSurfaceThin 
            className="p-3 px-4 mb-4 rounded-xl border border-solid transition-colors"
            style={{ background: `${tierColor}0a`, borderColor: `${tierColor}20` }}
          >
            <Text variant="label" className="text-[12px] font-black tracking-widest uppercase mb-1 block" style={{ color: tierColor }}>Capstone</Text>
            <Text variant="body" className="text-[12px] text-[var(--ui-text-primary)] leading-relaxed">{course.capstone}</Text>
          </GlassSurfaceThin>

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={onOpenNotebook}
                className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg border-none text-[var(--ui-text-primary)] font-bold text-[12.5px] cursor-pointer transition-all active:scale-95 shadow-lg"
                style={{ background: `linear-gradient(135deg,${tierColor},${tierColor}bb)`, boxShadow: `0 4px 14px ${tierColor}30` }}
              >
                < BookOpen size={13} /> Open Notebook
              </button>
              <a href={course.canvasUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center p-2 px-3 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] no-underline transition-colors hover:bg-white/10"
                title="Open in Canvas"
              >
                <ExternalLink size={13} />
              </a>
            </div>
            <div className="flex gap-2">
              {canvasToken && (
                <button type="button" onClick={onSyncCanvas}
                  className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer text-[12px] font-semibold transition-colors hover:bg-white/10"
                >
                  <RefreshCw size={12} /> Sync Canvas
                </button>
              )}
              {course.demosUrl && (
                <a href={course.demosUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] no-underline text-[12px] font-semibold transition-colors hover:bg-white/10"
                >
                  <Eye size={12} /> Try Demo
                </a>
              )}
            </div>
          </div>
        </div>
      </GlassCardInteractive>
    </div>
  );
}

export function LessonCard({ lesson, onClick }: { lesson: ALABSLesson; onClick?: () => void }) {
  const ref = useLabsReveal<HTMLDivElement>();
  return (
    <div ref={ref}>
      <GlassCardInteractive
        hover="lift"
        elevation="raised"
        border="subtle"
        blur="md"
        onClick={onClick}
        className="flex items-center gap-4 p-4 px-5"
      >
        <div 
          className="size-11 rounded-xl flex items-center justify-center shrink-0 border border-solid"
          style={{ background: `${L.accent}14`, borderColor: `${L.accent}28` }}
        >
          {lesson.videoUrl ? <MonitorPlay size={18} color={L.accent} /> : <FileText size={18} color={L.accent} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Text variant="label" className="text-[12px] font-extrabold tracking-wider uppercase text-[var(--accent-primary)]">
              M{lesson.moduleNumber} · L{lesson.lessonNumber}
            </Text>
            {lesson.durationMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-[var(--ui-text-muted)]" />
                <Text variant="caption" className="text-[12px] text-[var(--ui-text-muted)]">{lesson.durationMinutes} min</Text>
              </div>
            )}
          </div>
          <Text variant="subheading" className="text-[14px] font-bold text-[var(--ui-text-primary)] mb-0.5 block">
            {lesson.title}
          </Text>
          {lesson.description && (
            <Text variant="body" className="text-[12px] text-[var(--ui-text-secondary)] leading-relaxed truncate block">
              {lesson.description}
            </Text>
          )}
        </div>
        <ChevronRight size={16} className="text-[var(--ui-text-muted)] shrink-0" />
      </GlassCardInteractive>
    </div>
  );
}
