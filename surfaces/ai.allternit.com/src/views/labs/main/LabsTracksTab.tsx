import React from "react";
import { RefreshCw } from 'lucide-react';
import { Fade } from '@/design/animation/Fade';
import { Stagger } from '@/design/animation/Stagger';
import { Text } from '@/components/typography/Text';
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
        {coursesLoading && (
          <div className="flex items-center justify-center p-12 gap-3 text-[var(--ui-text-secondary)]">
            <RefreshCw size={20} className="animate-spin" />
            <Text variant="body">Loading courses…</Text>
          </div>
        )}
        <Stagger staggerDelay={0.08} direction="up" distance={20}>
          {(['CORE', 'OPS', 'AGENTS', 'ADV'] as const).map(tier => {
            const TierIcon = getTierIcon(tier);
            const tierColor = getTierColor(tier);
            const tierCourses = courses.filter(c => c.tier === tier);
            if (tierCourses.length === 0) return null;
            return (
              <div key={tier} className="mb-[52px]">
                <div className="flex items-center gap-3.5 mb-5">
                  <div 
                    className="size-9 rounded-xl flex items-center justify-center shrink-0 border border-solid"
                    style={{ background: `${tierColor}14`, borderColor: `${tierColor}28` }}
                  >
                    <TierIcon size={18} color={tierColor} />
                  </div>
                  <div>
                    <Text variant="researchHeading" className="text-[22px] font-black italic text-[var(--ui-text-primary)] tracking-tight">Tier {tier}</Text>
                  </div>
                  <div 
                    className="flex-1 h-px"
                    style={{ background: `linear-gradient(to right,${tierColor}25,transparent)` }}
                  />
                  <Text variant="label" className="text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-muted)]">{tierCourses.length} courses</Text>
                </div>

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
            );
          })}
        </Stagger>
      </div>
    </Fade>
  );
};
