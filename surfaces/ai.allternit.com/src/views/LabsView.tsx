"use client";

import React, { useEffect } from 'react';
import { Fade } from '@/design/animation/Fade';
import { CertificationsPanel } from './CertificationsPanel';
import { ResearchTab } from './research/ResearchTab';
import { DiscoveryFeed } from './discovery/DiscoveryFeed';
import { LessonPlayer } from './labs/components/LessonPlayer';
import { LessonPlayerErrorBoundary } from './labs/components/LessonPlayerErrorBoundary';

// Modularized Labs components
import { useLabsManager } from './labs/main/useLabsManager';
import { LabsViewHeader } from './labs/main/LabsViewHeader';
import { LabsTracksTab } from './labs/main/LabsTracksTab';
import { LabsClassroomTab } from './labs/main/LabsClassroomTab';
import { LabsSettingsTab } from './labs/main/LabsSettingsTab';

export function LabsView() {
  const {
    activeTab, setActiveTab,
    canvasToken, canvasDomain,
    notification, showNotification,
    courses, coursesLoading,
    lessons, lessonsLoading, setLessons,
    activeLesson, setActiveLesson,
    generatingLesson, setGeneratingLesson,
    saveConfig,
    openCourseNotebook,
    syncCanvasForCourse,
  } = useLabsManager();

  // Listen for Discovery → Research navigation
  useEffect(() => {
    const handler = (e: CustomEvent<{ notebookId?: string }>) => {
      setActiveTab('research');
      if (e.detail?.notebookId) {
        window.dispatchEvent(new CustomEvent('allternit:research-open-notebook', {
          detail: { notebookId: e.detail.notebookId }
        }));
      }
    };
    window.addEventListener('allternit:open-research-notebook' as any, handler);
    return () => window.removeEventListener('allternit:open-research-notebook' as any, handler);
  }, [setActiveTab]);

  // Listen for ShellRail → Research navigation
  useEffect(() => {
    const handler = () => setActiveTab('research');
    window.addEventListener('allternit:open-labs-research' as any, handler);
    return () => window.removeEventListener('allternit:open-labs-research' as any, handler);
  }, [setActiveTab]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-canvas)] relative overflow-hidden">
      {/* ── Header ── */}
      <LabsViewHeader 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        notification={notification} 
      />

      {/* ── Content ── */}
      {activeTab === 'research' ? (
        <div className="flex-1 overflow-hidden min-h-0 relative z-[1]">
          <ResearchTab />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8 px-9 relative z-[1]">
          {activeTab === 'discovery' && (
            <Fade in direction="up" distance={20}>
              <DiscoveryFeed />
            </Fade>
          )}

          {activeTab === 'tracks' && (
            <LabsTracksTab
              courses={courses}
              coursesLoading={coursesLoading}
              canvasToken={canvasToken}
              openCourseNotebook={openCourseNotebook}
              syncCanvasForCourse={syncCanvasForCourse}
            />
          )}

          {activeTab === 'classroom' && (
            <LabsClassroomTab
              lessons={lessons}
              lessonsLoading={lessonsLoading}
              courses={courses}
              generatingLesson={generatingLesson}
              setGeneratingLesson={setGeneratingLesson}
              setLessons={setLessons}
              showNotification={showNotification}
              setActiveLesson={setActiveLesson}
            />
          )}

          {activeTab === 'certifications' && (
            <Fade in direction="up" distance={20}>
              <CertificationsPanel />
            </Fade>
          )}

          {activeTab === 'settings' && (
            <LabsSettingsTab
              canvasToken={canvasToken}
              canvasDomain={canvasDomain}
              saveConfig={saveConfig}
            />
          )}
        </div>
      )}

      {/* Lesson Player Overlay */}
      {activeLesson && (
        <LessonPlayerErrorBoundary onClose={() => setActiveLesson(null)}>
          <LessonPlayer
            lesson={activeLesson}
            onClose={() => setActiveLesson(null)}
            onProgressUpdate={(progress) => {
              if (progress >= 100) {
                showNotification(`Completed: ${activeLesson.title}`);
              }
            }}
          />
        </LessonPlayerErrorBoundary>
      )}
    </div>
  );
}

export default LabsView;
