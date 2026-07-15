import React from "react";
import { RefreshCw, GraduationCap } from 'lucide-react';
import { Fade } from '@/design/animation/Fade';
import { Stagger } from '@/design/animation/Stagger';
import { Text } from '@/components/typography/Text';
import { EmptyState } from '@/components/settings/EmptyState';
import type { ALABSCourse } from "./LabsView.constants";
import {
  getTierIcon,
  getTierColor,
  CourseCard
} from "./LabsSharedComponents";

interface LabsTracksTabProps {
  coursesLoading: boolean;
  courses: ALABSCourse[];
  canvasToken: string;
  openCourseNotebook: (course: ALABSCourse) => void;
  syncCanvasForCourse: (course: ALABSCourse) => void;
}

const TIER_ORDER = ['CORE', 'OPS', 'AGENTS', 'ADV'] as const;

const TIER_TAGLINE: Record<(typeof TIER_ORDER)[number], string> = {
  CORE: 'Start here — the foundations every builder needs',
  OPS: 'Put it into production — retrieval, memory, and scale',
  AGENTS: 'Coordinate multiple agents toward one goal',
  ADV: 'Go deep on protocols, tooling, and extensibility',
};

export const LabsTracksTab: React.FC<LabsTracksTabProps> = ({
  coursesLoading,
  courses,
  canvasToken,
  openCourseNotebook,
  syncCanvasForCourse,
}) => {
  return (
    <Fade in direction="up" distance={20}>
      <div>
        <div className="mb-8 max-w-[640px]">
          <Text variant="heading" as="h2" className="text-2xl font-bold m-0 mb-1.5 tracking-tight text-[var(--ui-text-primary)]">
            Learning Path
          </Text>
          <Text variant="body" className="text-[13px] text-[var(--ui-text-secondary)] m-0 leading-relaxed">
            Four tiers, one progression: build the fundamentals, put them into production, coordinate multi-agent systems, then go deep on protocols.
          </Text>
        </div>

        {coursesLoading && (
          <div className="flex items-center justify-center p-12 gap-3 text-[var(--ui-text-secondary)]">
            <RefreshCw size={20} className="animate-spin" />
            <Text variant="body">Loading courses…</Text>
          </div>
        )}

        {!coursesLoading && courses.length === 0 && (
          <EmptyState
            icon={<GraduationCap size={48} strokeWidth={1} />}
            title="No tracks available"
            caption="Connect Canvas in Labs Settings to import your course tracks."
            ctaLabel="Open Labs Settings"
            primaryCta
            onCtaClick={() => {
              window.dispatchEvent(new CustomEvent('allternit:labs-set-tab', { detail: { tab: 'settings' } }));
            }}
            className="bg-[var(--bg-secondary)] rounded-2xl border border-solid border-[var(--border-subtle)]"
          />
        )}

        {!coursesLoading && courses.length > 0 && (
          <div className="relative">
            {/* Connecting spine linking every tier into one progression */}
            <div
              className="absolute left-[19px] top-[22px] bottom-[22px] w-px hidden sm:block"
              style={{ background: 'linear-gradient(to bottom, var(--ui-border-default), transparent)' }}
            />

            <Stagger staggerDelay={0.08} direction="up" distance={16}>
              {TIER_ORDER.map((tier, tierIdx) => {
                const TierIcon = getTierIcon(tier);
                const tierColor = getTierColor(tier);
                const tierCourses = courses.filter(c => c.tier === tier);
                if (tierCourses.length === 0) return null;
                const isLast = tierIdx === TIER_ORDER.length - 1;

                return (
                  <div key={tier} className={isLast ? '' : 'mb-9'}>
                    <div className="flex gap-4 sm:gap-5">
                      {/* Tier node on the spine */}
                      <div className="shrink-0 flex flex-col items-center">
                        <div
                          className="size-10 rounded-xl flex items-center justify-center border border-solid relative z-[1] bg-[var(--surface-canvas)]"
                          style={{ background: `${tierColor}14`, borderColor: `${tierColor}30` }}
                        >
                          <TierIcon size={18} color={tierColor} />
                        </div>
                      </div>

                      {/* Tier lane */}
                      <div className="flex-1 min-w-0 pt-1.5">
                        <div className="flex items-baseline gap-2.5 mb-1 flex-wrap">
                          <Text variant="subheading" className="text-[18px] font-bold text-[var(--ui-text-primary)] tracking-tight">
                            Tier {tier}
                          </Text>
                          <Text variant="label" className="text-[11px] font-bold tracking-wider uppercase" style={{ color: tierColor }}>
                            {tierCourses.length} {tierCourses.length === 1 ? 'course' : 'courses'}
                          </Text>
                        </div>
                        <Text variant="body" className="text-[13px] text-[var(--ui-text-muted)] m-0 mb-4">
                          {TIER_TAGLINE[tier]}
                        </Text>

                        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                          {tierCourses.map(course => (
                            <CourseCard
                              key={course.code}
                              course={course}
                              tierColor={tierColor}
                              canvasToken={canvasToken}
                              onOpenNotebook={() => openCourseNotebook(course)}
                              onSyncCanvas={() => syncCanvasForCourse(course)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Stagger>
          </div>
        )}
      </div>
    </Fade>
  );
};
