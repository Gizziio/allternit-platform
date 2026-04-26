/**
 * Udemy Downloader Service for Allternit Platform
 * 
 * Provides course download, management, and storage capabilities
 * for integration with A://Labs and Canvas LMS
 */

export { default as UdemyService } from './udemy.service';
export type {
  UdemyCourse,
  UdemyCourseContent,
  UdemyCourseContentResponse,
  UdemyCoursesResponse,
  UdemyUserContext,
  DownloadOptions,
} from './udemy.service';

export { default as CourseStorageManager } from './course-storage.manager';
export type {
  CourseMetadata,
  ChapterMetadata,
  LectureMetadata,
  DownloadProgress,
  CourseStorageConfig,
} from './course-storage.manager';

export { default as CourseDownloader } from './course-downloader.module';
export type {
  DownloadCallbacks,
  DownloadResult,
  CourseInfo,
} from './course-downloader.module';

// Public search
export { default as UdemyPublicSearch } from './udemy-publicsearch';
export type {
  UdemyPublicCourse,
  SearchResponse,
  A2LabsCategory,
} from './udemy-publicsearch';
export { A2LABS_CATEGORIES } from './udemy-publicsearch';

// Re-export utilities
export { CourseStorageManager as StorageUtils } from './course-storage.manager';
