/**
 * Course Downloader Module
 * Orchestrates the download process for Udemy courses
 * 
 * Features:
 * - Download videos, articles, files, and subtitles
 * - Progress tracking and pause/resume support
 * - Quality selection
 * - Subtitle download and conversion (VTT to SRT)
 */

import fs from 'fs/promises';
import path from 'path';
import UdemyService, { UdemyCourse, UdemyCourseContent, DownloadOptions } from './udemy.service';
import CourseStorageManager, { 
  CourseMetadata, 
  ChapterMetadata, 
  LectureMetadata,
  DownloadProgress 
} from './course-storage.manager';

export interface DownloadCallbacks {
  onProgress?: (progress: DownloadProgress) => void;
  onLectureComplete?: (lectureId: number, fileName: string) => void;
  onLectureError?: (lectureId: number, error: string) => void;
  onCourseComplete?: (courseId: number, totalFiles: number, totalSize: number) => void;
  onCourseError?: (courseId: number, error: Error) => void;
}

export interface DownloadResult {
  success: boolean;
  courseId: number;
  courseTitle: string;
  totalFiles: number;
  totalSize: number;
  failedLectures: number;
  error?: string;
}

export interface CourseInfo {
  course: UdemyCourse;
  metadata: CourseMetadata | null;
  exists: boolean;
  downloadPath: string;
}

class CourseDownloader {
  private service: UdemyService;
  private storage: CourseStorageManager;
  private abortController: AbortController | null = null;
  private activeDownloads: Map<number, boolean> = new Map();

  constructor(service: UdemyService, storage: CourseStorageManager) {
    this.service = service;
    this.storage = storage;
  }

  /**
   * Get course info without downloading
   */
  async getCourseInfo(courseId: number, courseTitle: string): Promise<CourseInfo> {
    const exists = await this.storage.courseExists(courseId, courseTitle);
    const metadata = exists ? await this.storage.loadMetadata(courseId, courseTitle) : null;
    const downloadPath = this.storage.getCourseDir(courseId, courseTitle);

    // Fetch course details from API
    const course = await this.service.fetchCourseDetails(courseId);

    return {
      course,
      metadata,
      exists,
      downloadPath,
    };
  }

  /**
   * Download entire course
   */
  async downloadCourse(
    courseId: number,
    courseTitle: string,
    options: DownloadOptions = {},
    callbacks: DownloadCallbacks = {}
  ): Promise<DownloadResult> {
    this.abortController = new AbortController();
    const result: DownloadResult = {
      success: false,
      courseId,
      courseTitle,
      totalFiles: 0,
      totalSize: 0,
      failedLectures: 0,
    };

    let metadata: CourseMetadata = {
      id: courseId,
      title: courseTitle,
      headline: '',
      url: this.service.getCourseUrl(courseId),
      image_240x135: '',
      published_title: '',
      downloadDate: new Date().toISOString(),
      status: 'downloading',
      chapters: [],
      totalFiles: 0,
      totalSize: 0,
    };

    try {
      // Initialize course directory
      await this.storage.initializeCourse(courseId, courseTitle);

      // Fetch course content
      const content = await this.service.fetchCourseContent(courseId);

      // Build course structure
      const chapters: ChapterMetadata[] = [];
      let currentChapter: { id: number; title: string; index: number } | null = null;
      let chapterIndex = 0;
      let lectureIndex = 0;
      let totalFiles = 0;

      // Process curriculum items
      for (const item of content.results) {
        if (this.abortController.signal.aborted) {
          metadata.status = 'partial';
          break;
        }

        if (item._class === 'chapter') {
          // Save previous chapter
          if (currentChapter) {
            chapters.push({
              id: currentChapter.id,
              title: currentChapter.title,
              index: currentChapter.index,
              lectures: [],
            });
          }

          currentChapter = {
            id: item.id,
            title: item.title,
            index: chapterIndex,
          };
          chapterIndex++;
          lectureIndex = 0;
        } else if (currentChapter) {
          // Process lecture
          const lectureMeta: LectureMetadata = {
            id: item.id,
            title: item.title,
            type: this.mapLectureType(item._class, item.asset?.asset_type),
            index: lectureIndex,
            status: 'pending',
          };

          try {
            await this.downloadLecture(
              item,
              courseId,
              courseTitle,
              currentChapter.index,
              currentChapter.title,
              lectureIndex,
              options,
              callbacks,
              lectureMeta
            );

            totalFiles++;
          } catch (error) {
            lectureMeta.status = 'failed';
            lectureMeta.error = (error as Error).message;
            result.failedLectures++;
            callbacks.onLectureError?.(item.id, (error as Error).message);
          }

          chapters[chapters.length - 1]?.lectures.push(lectureMeta);
          lectureIndex++;
        }
      }

      // Save final chapter
      if (currentChapter) {
        chapters.push({
          id: currentChapter.id,
          title: currentChapter.title,
          index: currentChapter.index,
          lectures: [],
        });
      }

      metadata.chapters = chapters;
      metadata.totalFiles = totalFiles;
      metadata.status = this.abortController.signal.aborted ? 'partial' : 'completed';
      metadata.totalSize = await this.storage.getCourseSize(courseId, courseTitle);

      await this.storage.saveMetadata(metadata);

      result.totalFiles = totalFiles;
      result.totalSize = metadata.totalSize;
      result.success = !this.abortController.signal.aborted && result.failedLectures === 0;

      callbacks.onCourseComplete?.(courseId, totalFiles, metadata.totalSize);

      return result;
    } catch (error) {
      metadata.status = 'failed';
      await this.storage.saveMetadata(metadata).catch(() => {});

      result.error = (error as Error).message;
      callbacks.onCourseError?.(courseId, error as Error);
      throw error;
    }
  }

  /**
   * Download a single lecture
   */
  private async downloadLecture(
    item: UdemyCourseContent,
    courseId: number,
    courseTitle: string,
    chapterIndex: number,
    chapterTitle: string,
    lectureIndex: number,
    options: DownloadOptions,
    callbacks: DownloadCallbacks,
    lectureMeta: LectureMetadata
  ): Promise<void> {
    // Ensure chapter directory exists before writing any files
    await this.storage.initializeChapter(courseId, courseTitle, chapterIndex, chapterTitle);

    const assetType = item.asset?.asset_type?.toLowerCase();

    if (item._class === 'quiz' || item._class === 'practice') {
      // Save as URL reference
      const courseUrl = this.service.getCourseUrl(courseId);
      const contentUrl = this.service.getContentUrl(courseId, item.id, item._class);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>${item.title}</title></head>
        <body>
          <h1>${item.title}</h1>
          <p>This is a ${item._class}. Open in browser to complete:</p>
          <a href="${this.service.getBaseUrl()}${contentUrl}">
            Open ${item._class} in Udemy
          </a>
          <script>window.location = "${this.service.getBaseUrl()}${contentUrl}";</script>
        </body>
        </html>
      `;

      const filePath = this.storage.getLecturePath(
        courseId, courseTitle, chapterIndex, chapterTitle,
        lectureIndex, item.title, 'html'
      );
      await fs.writeFile(filePath, htmlContent, 'utf-8');
      lectureMeta.status = 'completed';
      lectureMeta.fileName = `${lectureIndex}-${this.storage['sanitizeFilename'](item.title)}.html`;
      callbacks.onLectureComplete?.(item.id, lectureMeta.fileName);
      return;
    }

    if (assetType === 'article') {
      // Download article as HTML
      const body = item.asset?.data?.body ?? item.asset?.body ?? '';
      const filePath = this.storage.getLecturePath(
        courseId, courseTitle, chapterIndex, chapterTitle,
        lectureIndex, item.title, 'html'
      );

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>${item.title}</title></head>
        <body>${body}</body>
        </html>
      `;

      await fs.writeFile(filePath, htmlContent, 'utf-8');
      lectureMeta.status = 'completed';
      lectureMeta.fileName = `${lectureIndex}-${this.storage['sanitizeFilename'](item.title)}.html`;
      callbacks.onLectureComplete?.(item.id, lectureMeta.fileName);
      return;
    }

    if (assetType === 'file' || assetType === 'e-book' || assetType === 'presentation') {
      // Download file
      const fileUrl = item.asset?.download_urls?.[assetType]?.[0]?.file 
        ?? item.asset?.url_set?.[assetType]?.[0]?.file;

      if (fileUrl) {
        const extension = this.getFileExtension(fileUrl, assetType);
        const filePath = this.storage.getLecturePath(
          courseId, courseTitle, chapterIndex, chapterTitle,
          lectureIndex, item.title, extension
        );

        const data = await this.service.downloadFile(fileUrl);
        await fs.writeFile(filePath, Buffer.from(data));
        
        const stats = await fs.stat(filePath);
        lectureMeta.status = 'completed';
        lectureMeta.fileName = path.basename(filePath);
        lectureMeta.fileSize = stats.size;
        callbacks.onLectureComplete?.(item.id, lectureMeta.fileName);
      }
      return;
    }

    if (assetType?.startsWith('video')) {
      // Download video
      const streams = item.asset?.streams;
      if (!streams?.minQuality) {
        lectureMeta.status = 'skipped';
        lectureMeta.error = 'No video stream available';
        return;
      }

      // Get video URL (quality selection logic)
      let videoUrl = '';
      const quality = options.videoQuality || 'Auto';
      
      if (quality === 'Auto' || quality === 'Best') {
        videoUrl = streams[quality === 'Best' ? 'highest' : 'minQuality'] || streams['720'] || streams['480'] || '';
      } else {
        videoUrl = streams[quality] || '';
      }

      if (!videoUrl) {
        lectureMeta.status = 'skipped';
        lectureMeta.error = 'Video stream not available or DRM protected';
        return;
      }

      lectureMeta.quality = quality;

      // Download video
      const videoPath = this.storage.getLecturePath(
        courseId, courseTitle, chapterIndex, chapterTitle,
        lectureIndex, item.title, 'mp4'
      );

      const startTime = Date.now();
      const videoData = await this.service.downloadFile(videoUrl, {
        'Accept': '*/*',
      });
      await fs.writeFile(videoPath, Buffer.from(videoData));

      const stats = await fs.stat(videoPath);
      const duration = (Date.now() - startTime) / 1000;
      const speed = videoData.byteLength / duration;

      lectureMeta.status = 'completed';
      lectureMeta.fileName = path.basename(videoPath);
      lectureMeta.fileSize = stats.size;

      // Download subtitles if enabled
      if (!options.skipSubtitles && item.asset?.captions?.length) {
        const subtitleLocale = options.defaultSubtitle || 'en';
        const subtitle = item.asset.captions.find(
          (cap) => cap.locale.startsWith(subtitleLocale) || cap.locale === subtitleLocale
        );

        if (subtitle) {
          const vttData = await this.service.downloadFile(subtitle.url);
          const vttPath = this.storage.getLecturePath(
            courseId, courseTitle, chapterIndex, chapterTitle,
            lectureIndex, item.title, 'vtt'
          );
          await fs.writeFile(vttPath, Buffer.from(vttData));

          // Convert VTT to SRT
          const srtContent = this.convertVttToSrt(Buffer.from(vttData).toString('utf-8'));
          const srtPath = this.storage.getLecturePath(
            courseId, courseTitle, chapterIndex, chapterTitle,
            lectureIndex, item.title, 'srt'
          );
          await fs.writeFile(srtPath, srtContent);

          lectureMeta.subtitle = subtitle.locale;
        }
      }

      callbacks.onLectureComplete?.(item.id, lectureMeta.fileName);
    }
  }

  /**
   * Convert VTT subtitle format to SRT
   */
  private convertVttToSrt(vttContent: string): string {
    return vttContent
      .split('\n')
      .map((line) => {
        // Convert WebVTT timestamps to SRT format
        return line.replace(
          /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g,
          '$1:$2:$3,$4'
        );
      })
      .filter((line) => !line.startsWith('WEBVTT'))
      .join('\n')
      .trim();
  }

  /**
   * Get file extension from URL or asset type
   */
  private getFileExtension(url: string, assetType: string): string {
    const urlExtension = url.split('.').pop()?.split('?')[0]?.toLowerCase();
    if (urlExtension && ['pdf', 'zip', 'rar', 'doc', 'docx', 'pptx', 'xlsx'].includes(urlExtension)) {
      return urlExtension;
    }

    const extensionMap: Record<string, string> = {
      'file': 'pdf',
      'e-book': 'pdf',
      'presentation': 'pptx',
    };

    return extensionMap[assetType] || 'file';
  }

  /**
   * Map content class to lecture type
   */
  private mapLectureType(
    itemClass: string,
    assetType?: string
  ): 'video' | 'article' | 'file' | 'quiz' | 'practice' | 'url' {
    if (itemClass === 'quiz') return 'quiz';
    if (itemClass === 'practice') return 'practice';
    
    switch (assetType) {
      case 'article':
        return 'article';
      case 'file':
      case 'e-book':
      case 'presentation':
        return 'file';
      case 'videocast':
      case 'video':
        return 'video';
      default:
        return 'url';
    }
  }

  /**
   * Abort active downloads
   */
  abortDownloads(): void {
    this.abortController?.abort();
    this.activeDownloads.clear();
  }

  /**
   * Check if a video has DRM protection
   */
  static hasDRM(assetType: string, streams?: Record<string, string>): boolean {
    if (!streams || !streams.minQuality) {
      return true;
    }
    return false;
  }
}

export default CourseDownloader;
