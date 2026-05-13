'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Play, CheckCircle, BookOpen, Clock } from 'lucide-react';
import { GlassSurface } from '@/design/glass/GlassSurface';
import { Fade } from '@/design/animation/Fade';
import { Text } from '@/components/typography/Text';
import { SlideScene } from './scenes/SlideScene';
import { QuizScene } from './scenes/QuizScene';
import { VideoScene } from './scenes/VideoScene';

const ACCENT = 'var(--accent-primary)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const STATUS_SUCCESS = 'var(--status-success)';
const BORDER_SUBTLE = 'var(--ui-border-muted)';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Scene {
  type: 'slide' | 'quiz' | 'video';
  title: string;
  content?: string;
  questions?: QuizQuestion[];
  videoUrl?: string;
  duration: number;
}

interface LessonSceneData {
  version: string;
  scenes: Scene[];
}

interface ALABSLesson {
  id: string;
  courseId: string;
  moduleNumber: number;
  lessonNumber: number;
  title: string;
  description: string;
  sceneJson: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  status: 'draft' | 'published' | 'archived';
  courseCode: string;
  courseTitle: string;
}

interface LessonPlayerProps {
  lesson: ALABSLesson;
  onClose: () => void;
  onProgressUpdate?: (progress: number) => void;
}

export function LessonPlayer({ lesson, onClose, onProgressUpdate }: LessonPlayerProps) {
  const [sceneData, setSceneData] = useState<LessonSceneData | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [completedScenes, setCompletedScenes] = useState<Set<number>>(new Set());
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const savedProgressRef = React.useRef<number>(0);
  const lastSyncedProgress = React.useRef(0);
  const syncErrorTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSyncError = useCallback((msg: string) => {
    if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
    setSyncError(msg);
    syncErrorTimerRef.current = setTimeout(() => setSyncError(null), 5000);
  }, []);

  // Fetch existing enrollment on mount
  useEffect(() => {
    const syncEnrollment = async () => {
      try {
        const res = await fetch(`/api/v1/enrollments?courseId=${lesson.courseId}&lessonId=${lesson.id}`);
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`[LessonPlayer] Failed to load enrollment: ${res.status}`, body);
          showSyncError('Could not load saved progress');
          return;
        }
        setIsAuthenticated(true);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEnrollmentId(data[0].id);
          savedProgressRef.current = data[0].progress || 0;
        }
      } catch (err) {
        console.error('[LessonPlayer] Network error loading enrollment:', err);
        showSyncError('Network error — progress may not be saved');
      }
    };
    syncEnrollment();
  }, [lesson.courseId, lesson.id, showSyncError]);

  // Restore progress once sceneData is loaded
  useEffect(() => {
    if (sceneData && savedProgressRef.current > 0) {
      const scenesToRestore = Math.floor((savedProgressRef.current / 100) * sceneData.scenes.length);
      const restored = new Set<number>();
      for (let i = 0; i < scenesToRestore; i++) restored.add(i);
      setCompletedScenes(restored);
      if (scenesToRestore > 0 && scenesToRestore < sceneData.scenes.length) {
        setCurrentSceneIndex(scenesToRestore);
      }
      savedProgressRef.current = 0; // Reset so we don't restore again
    }
  }, [sceneData]);

  // Sync progress to server whenever completedScenes changes
  useEffect(() => {
    const syncProgress = async () => {
      if (progress === lastSyncedProgress.current) return;
      lastSyncedProgress.current = progress;
      setIsSyncing(true);
      try {
        const res = await fetch('/api/v1/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: lesson.courseId,
            lessonId: lesson.id,
            progress,
            status: progress >= 100 ? 'completed' : 'in_progress',
          }),
        });
        if (res.status === 401) {
          setIsAuthenticated(false);
          setIsSyncing(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`[LessonPlayer] Failed to sync progress: ${res.status}`, body);
          showSyncError('Failed to save progress');
          setIsSyncing(false);
          return;
        }
        setIsAuthenticated(true);
        const data = await res.json();
        if (data.id) setEnrollmentId(data.id);
      } catch (err) {
        console.error('[LessonPlayer] Network error syncing progress:', err);
        showSyncError('Network error — progress not saved');
      } finally {
        setIsSyncing(false);
      }
    };
    syncProgress();
  }, [progress, lesson.courseId, lesson.id, showSyncError]);

  useEffect(() => {
    if (lesson.sceneJson) {
      try {
        const parsed = JSON.parse(lesson.sceneJson) as LessonSceneData;
        setSceneData(parsed);
      } catch (err) {
        console.error('[LessonPlayer] Failed to parse sceneJson:', err);
        setSceneData({
          version: '1.0',
          scenes: [{
            type: 'slide',
            title: lesson.title,
            content: lesson.description || 'No content available for this lesson.',
            duration: lesson.durationMinutes || 5,
          }],
        });
      }
    } else if (lesson.videoUrl) {
      // Fallback: create a video scene from videoUrl
      setSceneData({
        version: '1.0',
        scenes: [{
          type: 'video',
          title: lesson.title,
          videoUrl: lesson.videoUrl,
          content: lesson.description || '',
          duration: lesson.durationMinutes || 5,
        }],
      });
    } else {
      // Fallback: create a single slide from description
      setSceneData({
        version: '1.0',
        scenes: [{
          type: 'slide',
          title: lesson.title,
          content: lesson.description || 'No content available for this lesson.',
          duration: lesson.durationMinutes || 5,
        }],
      });
    }
  }, [lesson]);

  const totalScenes = sceneData?.scenes.length ?? 0;
  const currentScene = sceneData?.scenes[currentSceneIndex];
  const progress = totalScenes > 0 ? Math.round((completedScenes.size / totalScenes) * 100) : 0;

  const handleSceneComplete = useCallback(() => {
    setCompletedScenes(prev => {
      const next = new Set(prev);
      next.add(currentSceneIndex);
      return next;
    });
  }, [currentSceneIndex]);

  const handleQuizComplete = useCallback((score: number) => {
    setQuizScore(score);
    setCompletedScenes(prev => {
      const next = new Set(prev);
      next.add(currentSceneIndex);
      return next;
    });
  }, [currentSceneIndex]);

  const goNext = useCallback(() => {
    if (currentSceneIndex + 1 < totalScenes) {
      setCurrentSceneIndex(i => i + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentSceneIndex, totalScenes]);

  const goPrev = useCallback(() => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(i => i - 1);
    }
  }, [currentSceneIndex]);

  const goToScene = useCallback((idx: number) => {
    if (idx >= 0 && idx < totalScenes) {
      setCurrentSceneIndex(idx);
      setIsFinished(false);
    }
  }, [totalScenes]);

  useEffect(() => {
    onProgressUpdate?.(progress);
  }, [progress, onProgressUpdate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  if (!sceneData) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text variant="body" style={{ color: TEXT_MUTED }}>Loading lesson…</Text>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
      {/* Header */}
      <GlassSurface
        elevation="floating"
        blur="lg"
        border="subtle"
        style={{
          flexShrink: 0,
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: TEXT_MUTED, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.color = TEXT_PRIMARY; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; }}
          >
            <X size={20} />
          </button>
          <div style={{ minWidth: 0 }}>
            <Text variant="subheading" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lesson.title}
            </Text>
            <Text variant="caption" style={{ fontSize: 12, color: TEXT_MUTED }}>
              {lesson.courseCode} · M{lesson.moduleNumber}·L{lesson.lessonNumber}
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--surface-active)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${ACCENT}, rgba(212,176,140,0.6))`,
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <Text variant="caption" style={{ fontSize: 12, color: TEXT_MUTED, fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>
              {progress}%
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color={TEXT_MUTED} />
            <Text variant="caption" style={{ fontSize: 12, color: TEXT_MUTED }}>{lesson.durationMinutes} min</Text>
          </div>

          {/* Sync indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 }}>
            {isSyncing ? (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: ACCENT,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ) : enrollmentId ? (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--success, #4ade80)',
                opacity: 0.8,
              }} title="Progress saved" />
            ) : isAuthenticated === false ? (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: TEXT_MUTED,
                opacity: 0.5,
              }} title="Sign in to save progress" />
            ) : null}
          </div>

          {/* Transient sync error */}
          {syncError && (
            <Text variant="caption" style={{
              fontSize: 12,
              color: 'var(--status-error, #f87171)',
              maxWidth: 200,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }} title={syncError}>
              {syncError}
            </Text>
          )}
        </div>
      </GlassSurface>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
        {isFinished ? (
          <Fade in direction="up" distance={20}>
            <GlassSurfaceBase
              blur="md"
              border="subtle"
              style={{ maxWidth: 560, margin: '0 auto', padding: '48px 40px', textAlign: 'center' }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: `${STATUS_SUCCESS}18`,
                border: `2px solid ${STATUS_SUCCESS}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <CheckCircle size={36} color={STATUS_SUCCESS} />
              </div>
              <Text variant="heading" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: TEXT_PRIMARY }}>
                Lesson Complete
              </Text>
              <Text variant="body" style={{ fontSize: 15, color: TEXT_SECONDARY, margin: '0 0 8px' }}>
                You completed <strong>{lesson.title}</strong>
              </Text>
              {quizScore !== null && (
                <Text variant="body" style={{ fontSize: 14, color: TEXT_MUTED, margin: '0 0 24px' }}>
                  Quiz score: <strong style={{ color: quizScore >= 70 ? STATUS_SUCCESS : ACCENT }}>{quizScore}%</strong>
                </Text>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => { setIsFinished(false); setCurrentSceneIndex(0); setCompletedScenes(new Set()); setQuizScore(null); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', background: 'rgba(255,255,255,.06)',
                    border: `1px solid ${BORDER_SUBTLE}`, borderRadius: 10,
                    color: TEXT_PRIMARY, fontWeight: 600, fontSize: 13,
                    cursor: 'pointer', transition: 'all .18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
                >
                  <Play size={14} /> Replay
                </button>
                <button
                  onClick={onClose}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', background: ACCENT,
                    border: 'none', borderRadius: 10,
                    color: 'var(--surface-canvas)', fontWeight: 600,
                    fontSize: 13, cursor: 'pointer', transition: 'all .18s',
                  }}
                >
                  <BookOpen size={14} /> Back to Classroom
                </button>
              </div>
            </GlassSurfaceBase>
          </Fade>
        ) : currentScene ? (
          <Fade in key={currentSceneIndex} direction="up" distance={16}>
            <div>
              {currentScene.type === 'slide' && (
                <SlideScene title={currentScene.title} content={currentScene.content || ''} />
              )}
              {currentScene.type === 'quiz' && (
                <QuizScene
                  title={currentScene.title}
                  questions={currentScene.questions || []}
                  onComplete={handleQuizComplete}
                />
              )}
              {currentScene.type === 'video' && (
                <VideoScene
                  title={currentScene.title}
                  videoUrl={currentScene.videoUrl || ''}
                  description={currentScene.content}
                  onComplete={handleSceneComplete}
                />
              )}
            </div>
          </Fade>
        ) : null}
      </div>

      {/* Footer Controls */}
      <GlassSurface
        elevation="floating"
        blur="lg"
        border="subtle"
        style={{
          flexShrink: 0,
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <button
          onClick={goPrev}
          disabled={currentSceneIndex === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: 'rgba(255,255,255,.04)',
            border: `1px solid ${BORDER_SUBTLE}`, borderRadius: 8,
            color: currentSceneIndex === 0 ? TEXT_MUTED : TEXT_PRIMARY,
            fontWeight: 500, fontSize: 13, cursor: currentSceneIndex === 0 ? 'not-allowed' : 'pointer',
            transition: 'all .18s', opacity: currentSceneIndex === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={14} /> Previous
        </button>

        {/* Scene dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {sceneData.scenes.map((scene, idx) => {
            const isCompleted = completedScenes.has(idx);
            const isCurrent = idx === currentSceneIndex;
            return (
              <button
                key={idx}
                onClick={() => goToScene(idx)}
                title={scene.title}
                style={{
                  width: isCurrent ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: isCompleted ? STATUS_SUCCESS : isCurrent ? ACCENT : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
              />
            );
          })}
        </div>

        {currentScene?.type === 'slide' && (
          <button
            onClick={() => { handleSceneComplete(); goNext(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: ACCENT,
              border: 'none', borderRadius: 8,
              color: 'var(--surface-canvas)', fontWeight: 600,
              fontSize: 13, cursor: 'pointer', transition: 'all .18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {currentSceneIndex + 1 < totalScenes ? 'Next' : 'Finish'}
            <ChevronRight size={14} />
          </button>
        )}

        {(currentScene?.type === 'quiz' || currentScene?.type === 'video') && (
          <div style={{ width: 80 }} /> /* Spacer — scene manages its own completion */
        )}
      </GlassSurface>
    </div>
  );
}
