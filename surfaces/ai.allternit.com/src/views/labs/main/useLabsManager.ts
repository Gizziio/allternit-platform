"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tab, ALABSCourse, ALABSLesson } from './LabsView.constants';
import { LABS_STORAGE_KEY, FALLBACK_COURSES } from './LabsView.constants';
import { notebookApi } from '../../research/hooks/useNotebookApi';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('UseLabsManager');

export function useLabsManager() {
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('https://canvas.instructure.com');
  const [notification, setNotification] = useState<string | null>(null);
  const [courses, setCourses] = useState<ALABSCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [lessons, setLessons] = useState<ALABSLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<ALABSLesson | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Load courses
  useEffect(() => {
    fetch('/api/v1/courses')
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ALABSCourse[]) => {
        if (Array.isArray(data) && data.length > 0) setCourses(data);
        else setCourses(FALLBACK_COURSES);
        setCoursesLoading(false);
      })
      .catch(() => {
        setCourses(FALLBACK_COURSES);
        setCoursesLoading(false);
      });
  }, []);

  // Load lessons
  useEffect(() => {
    fetch('/api/v1/lessons?status=published')
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ALABSLesson[]) => {
        if (Array.isArray(data)) setLessons(data);
        else setLessons([]);
        setLessonsLoading(false);
      })
      .catch(() => {
        setLessons([]);
        setLessonsLoading(false);
      });
  }, []);

  // Config
  useEffect(() => {
    const saved = localStorage.getItem(LABS_STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setCanvasToken(config.canvasToken || '');
        setCanvasDomain(config.canvasDomain || 'https://canvas.instructure.com');
      } catch (err) {
        logger.error({ err: err }, 'Malformed config');
      }
    }
  }, []);

  const saveConfig = useCallback((config: { canvasToken?: string; canvasDomain?: string }) => {
    const current = JSON.parse(localStorage.getItem(LABS_STORAGE_KEY) || '{}');
    localStorage.setItem(LABS_STORAGE_KEY, JSON.stringify({ ...current, ...config }));
    if (config.canvasToken !== undefined) setCanvasToken(config.canvasToken);
    if (config.canvasDomain !== undefined) setCanvasDomain(config.canvasDomain);
  }, []);

  // Notebook integration
  const createCourseNotebook = async (course: ALABSCourse): Promise<string> => {
    const notebook = await notebookApi.createNotebook(
      course.title,
      `${course.code} • ${course.tier} tier • ${course.modules} modules`
    );
    const notebookId = notebook.id;
    localStorage.setItem(`course-notebook-${course.id}`, notebookId);
    localStorage.setItem(`notebook-canvas-${notebookId}`, JSON.stringify({
      courseId: course.id,
      canvasUrl: course.canvasUrl,
    }));

    await notebookApi.addSource(notebookId, {
      type: 'text',
      title: `${course.code} — Course Overview`,
      content: `Course: ${course.title}\nCode: ${course.code}\nTier: ${course.tier}\nModules: ${course.modules}\nCapstone: ${course.capstone}\nDescription: ${course.description}\nCanvas URL: ${course.canvasUrl}`,
      status: 'extracted',
    });

    return notebookId;
  };

  const openCourseNotebook = useCallback(async (course: ALABSCourse) => {
    try {
      await notebookApi.health();
    } catch {
      showNotification('Research engine is offline.');
    }

    try {
      const existing = localStorage.getItem(`course-notebook-${course.id}`);
      let notebookId: string;

      if (existing) {
        notebookId = existing;
        const notebooks = await notebookApi.listNotebooks();
        const found = notebooks.find(n => n.id === notebookId);
        if (!found) notebookId = await createCourseNotebook(course);
      } else {
        notebookId = await createCourseNotebook(course);
      }

      setActiveTab('research');
      window.dispatchEvent(new CustomEvent('allternit:research-open-notebook', {
        detail: { notebookId },
      }));
    } catch (err: any) {
      showNotification(`Failed to open notebook: ${err.message}`);
    }
  }, [showNotification]);

  const syncCanvasForCourse = useCallback(async (course: ALABSCourse) => {
    if (!canvasToken || !course.canvasUrl) {
      showNotification('Canvas token not configured.');
      return;
    }
    const courseIdMatch = course.canvasUrl.match(/\/courses\/(\d+)/);
    if (!courseIdMatch) return;
    const notebookId = localStorage.getItem(`course-notebook-${course.id}`);
    if (!notebookId) return;
    try {
      const result = await notebookApi.canvasSync(notebookId, courseIdMatch[1], canvasToken, canvasDomain);
      showNotification(`Synced ${result.sources_created} Canvas sources`);
    } catch (err: any) {
      showNotification(`Sync failed: ${err.message}`);
    }
  }, [canvasToken, canvasDomain, showNotification]);

  return {
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
  };
}
