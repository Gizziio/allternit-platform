import React from "react";
import { RefreshCw, School } from 'lucide-react';
import { Fade } from '@/design/animation/Fade';
import { Stagger } from '@/design/animation/Stagger';
import { Text } from '@/components/typography/Text';
import { EmptyState } from '@/components/settings/EmptyState';
import type { ALABSCourse, ALABSLesson } from "./LabsView.constants";
import { L, normalizeLesson } from "./LabsView.constants";
import {
  getTierIcon,
  getTierColor,
  LessonCard
} from "./LabsSharedComponents";

interface LabsClassroomTabProps {
  lessonsLoading: boolean;
  lessons: ALABSLesson[];
  courses: ALABSCourse[];
  generatingLesson: boolean;
  setGeneratingLesson: (gen: boolean) => void;
  setLessons: React.Dispatch<React.SetStateAction<ALABSLesson[]>>;
  showNotification: (msg: string) => void;
  setActiveLesson: (lesson: ALABSLesson) => void;
}

export const LabsClassroomTab: React.FC<LabsClassroomTabProps> = ({
  lessonsLoading,
  lessons,
  courses,
  generatingLesson,
  setGeneratingLesson,
  setLessons,
  showNotification,
  setActiveLesson,
}) => {
  const lessonsByCourse = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.courseId]) acc[lesson.courseId] = [];
    acc[lesson.courseId].push(lesson);
    return acc;
  }, {} as Record<string, ALABSLesson[]>);

  return (
    <Fade in direction="up" distance={20}>
      <div className="min-h-[60vh]">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-px bg-[var(--accent-primary)] opacity-50" />
            <Text variant="label" className="text-[12.5px] font-bold tracking-widest uppercase text-[var(--accent-primary)]">Lesson Catalog</Text>
          </div>
          <Text variant="heading" as="h2" className="text-3xl font-black m-0 mb-1.5 tracking-tight text-[var(--ui-text-primary)] leading-none">
            A://Labs Classroom
          </Text>
          <Text variant="body" className="text-[12px] text-[var(--ui-text-secondary)] m-0 tracking-[0.01em] leading-relaxed">
            Structured lessons across all tracks. Progress is tracked per enrollment.
          </Text>
        </div>

        {lessonsLoading ? (
          <div className="flex items-center justify-center p-12 gap-3 text-[var(--ui-text-secondary)]">
            <RefreshCw size={20} className="animate-spin" />
            <Text variant="body">Loading lessons…</Text>
          </div>
        ) : lessons.length === 0 ? (
          <div className="max-w-[520px]">
            <EmptyState
              icon={<School size={48} strokeWidth={1} />}
              title="No lessons published"
              caption="The lesson catalog is empty. Generate a lesson from any course to get started."
              ctaLabel={generatingLesson ? 'Generating…' : 'Generate from first course'}
              primaryCta
              onCtaClick={async () => {
                const firstCourse = courses[0];
                if (!firstCourse) return;
                setGeneratingLesson(true);
                try {
                  const res = await fetch('/api/v1/lessons/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId: firstCourse.id, targetDuration: 20 }),
                  });
                  const data = await res.json();
                  if (data.lesson) {
                    setLessons(prev => [...prev, normalizeLesson(data.lesson)]);
                    showNotification(`Generated lesson for ${firstCourse.title}`);
                  }
                } catch {
                  showNotification('Failed to generate lesson');
                } finally {
                  setGeneratingLesson(false);
                }
              }}
              className="bg-[var(--bg-secondary)] rounded-2xl border border-solid border-[var(--border-subtle)]"
            />
            {courses.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {courses.slice(1, 6).map(course => (
                  <button type="button"
                    key={course.id}
                    onClick={async () => {
                      setGeneratingLesson(true);
                      try {
                        const res = await fetch('/api/v1/lessons/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ courseId: course.id, targetDuration: 20 }),
                        });
                        const data = await res.json();
                        if (data.lesson) {
                          setLessons(prev => [...prev, normalizeLesson(data.lesson)]);
                          showNotification(`Generated lesson for ${course.title}`);
                        }
                      } catch {
                        showNotification('Failed to generate lesson');
                      } finally {
                        setGeneratingLesson(false);
                      }
                    }}
                    disabled={generatingLesson}
                    className="p-2 px-3.5 rounded-lg border border-solid text-[12px] font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-wait"
                    style={{
                      background: `${getTierColor(course.tier)}12`,
                      borderColor: `${getTierColor(course.tier)}30`,
                      color: getTierColor(course.tier),
                    }}
                  >
                    {generatingLesson ? 'Generating...' : course.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(lessonsByCourse).map(([courseId, courseLessons]) => {
              const course = courses.find(c => c.id === courseId);
              const tierColor = course ? getTierColor(course.tier) : L.accent;
              return (
                <div key={courseId}>
                  <div className="flex items-center gap-3.5 mb-4">
                    <div 
                      className="size-8 rounded-lg flex items-center justify-center shrink-0 border border-solid"
                      style={{ background: `${tierColor}14`, borderColor: `${tierColor}28` }}
                    >
                      {course ? React.createElement(getTierIcon(course.tier), { size: 15, color: tierColor }) : <School size={15} color={tierColor} />}
                    </div>
                    <div>
                      <Text variant="subheading" className="text-[15px] font-extrabold text-[var(--ui-text-primary)]">{course?.title ?? courseLessons[0]?.courseTitle ?? 'Unknown Course'}</Text>
                    </div>
                    <div 
                      className="flex-1 h-px"
                      style={{ background: `linear-gradient(to right,${tierColor}20,transparent)` }}
                    />
                    <Text variant="label" className="text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-muted)]">{courseLessons.length} lessons</Text>
                  </div>
                  <Stagger staggerDelay={0.04} direction="up" distance={12}>
                    {courseLessons.map(lesson => (
                      <LessonCard key={lesson.id} lesson={lesson} onClick={() => setActiveLesson(lesson)} />
                    ))}
                  </Stagger>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Fade>
  );
};
