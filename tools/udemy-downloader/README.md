# A://Labs - Udemy Course Downloader & Manager

## Overview

This integration adds Udemy course downloading capabilities to the Allternit platform, enabling courses to be downloaded locally and prepared for future integration with A://Labs and Canvas LMS.

## Architecture

### Components Created

#### 1. Udemy Service (`services/udemy-downloader/src/`)
- **`udemy.service.ts`** - Core API interface for Udemy authentication and data fetching
  - Course listing with search and pagination
  - Course content retrieval (videos, articles, files, quizzes)
  - User profile and authentication
  - File download and streaming support

- **`course-storage.manager.ts`** - Local filesystem storage management
  - Organized directory structure per course
  - Metadata tracking (chapters, lectures, download status)
  - File size calculation and course deletion
  - Cross-platform filename sanitization

- **`course-downloader.module.ts`** - Download orchestration
  - Full course download with progress tracking
  - Support for videos, articles, files, and subtitles
  - VTT to SRT subtitle conversion
  - Error handling and retry logic
  - Abort support for cancellation

#### 2. Platform Integration (`surfaces/allternit-platform/src/`)
- **`views/LabsView.tsx`** - React UI component
  - Three-tab interface: Browse, Downloads, Settings
  - Course grid with download status indicators
  - Real-time download progress
  - Local course management (view, delete)
  - Settings for access token and download path

- **Navigation Integration**
  - Added `"labs"` to `nav.types.ts` ViewType union
  - Added spawn policy in `nav.policy.ts` (singleton view)
  - Registered component in `ShellApp.tsx` view registry
  - Added GraduationCap button in `ShellRail.tsx` footer

## Directory Structure

```
allternit-workspace/
├── services/
│   └── udemy-downloader/
│       ├── src/
│       │   ├── index.ts                      - Main exports
│       │   ├── udemy.service.ts              - Udemy API client
│       │   ├── course-storage.manager.ts     - Filesystem manager
│       │   └── course-downloader.module.ts   - Download orchestrator
│       ├── package.json
│       └── tsconfig.json
│
└── surfaces/allternit-platform/src/
    ├── views/
    │   └── LabsView.tsx                      - Main UI component
    ├── nav/
    │   ├── nav.types.ts                      - Added "labs" type
    │   └── nav.policy.ts                     - Added labs policy
    └── shell/
        ├── ShellApp.tsx                      - Registered LabsView
        └── ShellRail.tsx                     - Added nav button
```

## Usage

### 1. Access the Labs View
Click the **GraduationCap** icon in the bottom-left footer of the Allternit platform to open A://Labs.

### 2. Configure Settings
1. Go to the **Settings** tab
2. Paste your Udemy access token
   - Log in to Udemy in browser
   - Open DevTools (F12)
   - Go to Application/Storage → Cookies → udemy.com
   - Copy the `access_token` value
3. Set your download directory (default: `~/Downloads/UdemyCourses`)
4. Set subdomain (usually `www` or your business subdomain)

### 3. Browse & Download Courses
1. Go to **Browse Courses** tab
2. Click **Refresh** to fetch your enrolled courses from Udemy
3. Click **Download** on any course
4. Monitor progress in the progress bar
5. Access downloaded courses in the **My Downloads** tab

### 4. Manage Downloaded Courses
- **Open Folder** - Opens the course directory
- **Delete** - Removes local course files
- View download date, file count, and total size

## Downloaded Course Structure

Courses are stored in the configured download directory:

```
{downloadPath}/
└── courses/
    └── {course-id}-{course-slug}/
        ├── metadata.json           - Course metadata & status
        ├── chapters/
        │   ├── {index}-{chapter-slug}/
        │   │   ├── {index}-{lecture}.mp4
        │   │   ├── {index}-{lecture}.srt
        │   │   ├── {index}-{lecture}.html      (articles/quizzes)
        │   │   └── {index}-{lecture}.pdf       (files)
        ├── subtitles/
        │   └── {locale}.vtt
        └── resources/
            └── {resource-filename}
```

## Future Integration Points

### Canvas LMS Upload
The downloaded courses are structured and ready for Canvas LMS integration:

1. **Use existing Canvas scripts** at:
   ```
   Desktop/allternit-websites/projects/allternit/source/scripts/canvas/
   ```

2. **Use Summit OIC Canvas skills** at:
   ```
   Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/skills/canvas/
   ```

3. **Upload flow** (to be implemented):
   - Read course metadata from `metadata.json`
   - Create Canvas course via API
   - Create modules from chapters
   - Upload videos/files as module items
   - Create assignments from quizzes

### A://Labs Course Player
- Play downloaded videos locally
- Read articles and view files
- Track learning progress
- Sync with Canvas LMS enrollment

## API Reference

### UdemyService
```typescript
const service = new UdemyService('www', 40000);
service.setAccessToken('your-token');

// Fetch courses
const courses = await service.fetchCourses(page, pageSize, search);

// Fetch course content
const content = await service.fetchCourseContent(courseId);

// Download file
const data = await service.downloadFile(url);
```

### CourseStorageManager
```typescript
const storage = new CourseStorageManager({ basePath: '/path' });

// Initialize course directory
await storage.initializeCourse(courseId, courseTitle);

// Save/load metadata
await storage.saveMetadata(metadata);
const meta = await storage.loadMetadata(courseId, title);

// List all courses
const courses = await storage.listCourses();

// Delete course
await storage.deleteCourse(courseId, title);
```

### CourseDownloader
```typescript
const downloader = new CourseDownloader(service, storage);

// Download course
const result = await downloader.downloadCourse(
  courseId,
  courseTitle,
  {
    videoQuality: '720',
    skipSubtitles: false,
    defaultSubtitle: 'en',
  },
  {
    onProgress: (progress) => console.log(progress),
    onLectureComplete: (id, file) => console.log(file),
    onCourseComplete: (id, files, size) => console.log('Done!'),
  }
);
```

## Technical Notes

### Authentication
- Uses Udemy's official API with Bearer token authentication
- No credential storage - token must be manually obtained
- Token expires periodically and needs refresh

### DRM Protection
- Videos with DRM encryption cannot be downloaded
- DRM-protected videos are marked and skipped
- Other content types (articles, files) still download

### Quality Selection
- Auto: Downloads best available quality
- Best: Highest resolution available
- Specific: 360, 480, 720, 1080 (if available)

### Subtitles
- Downloaded in VTT format
- Automatically converted to SRT for compatibility
- Default language configurable (default: English)

## Development

### Build the service
```bash
cd services/udemy-downloader
npm install
npm run build
```

### Test the UI component
The LabsView is fully integrated into the platform. Start the dev server:
```bash
cd surfaces/allternit-platform
npm run dev
```

## Credits

- **Original Udemy Downloader GUI**: https://github.com/heliomarpm/udemy-downloader-gui
- **Fork of**: https://github.com/FaisalUmair/udemy-downloader-gui
- **License**: MIT

## Next Steps

1. **Backend Service Integration** - Move download logic to backend API for reliability
2. **Canvas LMS Upload** - Implement automatic course upload to Canvas
3. **Course Player** - Build in-platform video/article viewer
4. **Progress Tracking** - Track learning progress and completion
5. **DRM Bypass** - Research legal ways to handle DRM-protected content
6. **Batch Downloads** - Download multiple courses simultaneously
7. **Scheduled Sync** - Automatically sync new courses from Udemy
