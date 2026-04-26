/**
 * Course Storage Manager
 * Handles local filesystem storage for downloaded Udemy courses
 * 
 * Directory Structure:
 * {basePath}/
 *   courses/
 *     {course-id}-{course-slug}/
 *       metadata.json          - Course metadata
 *       chapters/
 *         {chapter-index}-{chapter-slug}/
 *           {lecture-index}-{lecture-slug}.mp4
 *           {lecture-index}-{lecture-slug}.srt
 *           {lecture-index}-{lecture-slug}.html      (articles)
 *           {lecture-index}-{lecture-slug}.pdf       (files)
 *       subtitles/
 *         {locale}.vtt
 *       resources/
 *         {resource-filename}
 */

import fs from 'fs/promises';
import path from 'path';

export interface CourseMetadata {
  id: number;
  title: string;
  headline: string;
  description?: string;
  url: string;
  image_240x135: string;
  published_title: string;
  num_subscribers?: number;
  num_lectures?: number;
  downloadDate: string;
  status: 'downloading' | 'completed' | 'failed' | 'partial';
  chapters: ChapterMetadata[];
  totalFiles: number;
  totalSize: number;
}

export interface ChapterMetadata {
  id: number;
  title: string;
  index: number;
  lectures: LectureMetadata[];
}

export interface LectureMetadata {
  id: number;
  title: string;
  type: 'video' | 'article' | 'file' | 'quiz' | 'practice' | 'url';
  index: number;
  fileName?: string;
  fileSize?: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'skipped';
  quality?: string;
  subtitle?: string;
  error?: string;
}

export interface DownloadProgress {
  courseId: number;
  chapterIndex: number;
  lectureIndex: number;
  lectureId: number;
  fileName: string;
  downloaded: number;
  total: number;
  speed: number; // bytes per second
  eta: number; // seconds
}

export interface CourseStorageConfig {
  basePath: string;
  videoQuality?: string;
  downloadSubtitles?: boolean;
  defaultSubtitle?: string;
  skipQuizLectures?: boolean;
}

class CourseStorageManager {
  private config: CourseStorageConfig;

  constructor(config: CourseStorageConfig) {
    this.config = config;
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\./g, '_')
      .trim()
      .substring(0, 200);
  }

  /**
   * Create slug from title for directory names
   */
  private createSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  /**
   * Get course directory path
   */
  getCourseDir(courseId: number, courseTitle: string): string {
    const slug = this.createSlug(courseTitle);
    return path.join(this.config.basePath, 'courses', `${courseId}-${slug}`);
  }

  /**
   * Get course metadata path
   */
  getMetadataPath(courseId: number, courseTitle: string): string {
    return path.join(this.getCourseDir(courseId, courseTitle), 'metadata.json');
  }

  /**
   * Initialize course directory structure
   */
  async initializeCourse(courseId: number, courseTitle: string): Promise<string> {
    const courseDir = this.getCourseDir(courseId, courseTitle);
    const chaptersDir = path.join(courseDir, 'chapters');
    const subtitlesDir = path.join(courseDir, 'subtitles');
    const resourcesDir = path.join(courseDir, 'resources');

    await fs.mkdir(chaptersDir, { recursive: true });
    await fs.mkdir(subtitlesDir, { recursive: true });
    await fs.mkdir(resourcesDir, { recursive: true });

    return courseDir;
  }

  /**
   * Initialize chapter directory structure
   */
  async initializeChapter(courseId: number, courseTitle: string, chapterIndex: number, chapterTitle: string): Promise<string> {
    const chapterDir = this.getChapterDir(courseId, courseTitle, chapterIndex, chapterTitle);
    await fs.mkdir(chapterDir, { recursive: true });
    return chapterDir;
  }

  /**
   * Save course metadata
   */
  async saveMetadata(metadata: CourseMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(metadata.id, metadata.title);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Load course metadata
   */
  async loadMetadata(courseId: number, courseTitle: string): Promise<CourseMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(courseId, courseTitle);
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data) as CourseMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get chapter directory path
   */
  getChapterDir(courseId: number, courseTitle: string, chapterIndex: number, chapterTitle: string): string {
    const courseDir = this.getCourseDir(courseId, courseTitle);
    const slug = this.createSlug(chapterTitle);
    return path.join(courseDir, 'chapters', `${chapterIndex}-${slug}`);
  }

  /**
   * Get lecture file path
   */
  getLecturePath(
    courseId: number,
    courseTitle: string,
    chapterIndex: number,
    chapterTitle: string,
    lectureIndex: number,
    lectureTitle: string,
    extension: string
  ): string {
    const chapterDir = this.getChapterDir(courseId, courseTitle, chapterIndex, chapterTitle);
    const slug = this.createSlug(lectureTitle);
    return path.join(chapterDir, `${lectureIndex}-${slug}.${extension}`);
  }

  /**
   * Check if course exists locally
   */
  async courseExists(courseId: number, courseTitle: string): Promise<boolean> {
    const courseDir = this.getCourseDir(courseId, courseTitle);
    try {
      await fs.access(courseDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all downloaded courses
   */
  async listCourses(): Promise<Array<{ id: number; title: string; metadata: CourseMetadata | null }>> {
    const coursesDir = path.join(this.config.basePath, 'courses');
    const courses: Array<{ id: number; title: string; metadata: CourseMetadata | null }> = [];

    try {
      const entries = await fs.readdir(coursesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const match = entry.name.match(/^(\d+)-(.+)$/);
          if (match) {
            const id = parseInt(match[1], 10);
            const title = match[2].replace(/-/g, ' ');
            const metadata = await this.loadMetadata(id, title);
            courses.push({ id, title, metadata });
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return courses;
  }

  /**
   * Get total size of a course
   */
  async getCourseSize(courseId: number, courseTitle: string): Promise<number> {
    const courseDir = this.getCourseDir(courseId, courseTitle);
    let totalSize = 0;

    async function calculateSize(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }

    try {
      await calculateSize(courseDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return totalSize;
  }

  /**
   * Delete a course
   */
  async deleteCourse(courseId: number, courseTitle: string): Promise<void> {
    const courseDir = this.getCourseDir(courseId, courseTitle);
    await fs.rm(courseDir, { recursive: true, force: true });
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  /**
   * Format duration for display
   */
  static formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export { CourseStorageManager };
export default CourseStorageManager;
