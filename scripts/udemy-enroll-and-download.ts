#!/usr/bin/env tsx
/**
 * Udemy Free Course Enrollment Helper + Auto-Downloader
 *
 * 1. Opens curated free AI courses in Chrome tabs
 * 2. Polls subscribed-courses API every 10 seconds
 * 3. Auto-downloads any newly enrolled courses
 *
 * Usage:
 *   tsx scripts/udemy-enroll-and-download.ts
 */

import { spawn } from 'child_process';
import axios from 'axios';
import path from 'path';
import os from 'os';
import fs from 'fs';
import UdemyService from '../services/udemy-downloader/src/udemy.service';
import CourseStorageManager from '../services/udemy-downloader/src/course-storage.manager';
import CourseDownloader from '../services/udemy-downloader/src/course-downloader.module';

const TOKEN_FILE = path.join(os.homedir(), '.udemy-token');
const DOWNLOAD_PATH = path.join(os.homedir(), 'Downloads', 'UdemyCourses');

// Curated free AI courses found via web search
const FREE_AI_COURSES = [
  { title: 'ChatGPT: Learn The Basics', url: 'https://www.udemy.com/course/chatgpt-learn-the-basics/' },
  { title: 'ChatGPT Prompt Engineering (Free Course)', url: 'https://www.udemy.com/course/chatgpt-prompt-engineering-free-course/' },
  { title: 'Prompt Engineering with Python and ChatGPT API (Free)', url: 'https://www.udemy.com/course/prompt-engineering-with-python-and-chatgpt-api-free-course/' },
  { title: 'Build Custom GPT with ChatGPT: Step by Step Free Guide', url: 'https://www.udemy.com/course/build-custom-gpt-with-chatgpt-step-by-step-free-guide/' },
  { title: 'How I Made My Own ChatGPT Coder', url: 'https://www.udemy.com/course/how-i-made-my-own-chatgpt-coder-that-codes-anything/' },
  { title: 'Mini-Course in ChatGPT', url: 'https://www.udemy.com/course/free-mini-course-in-chat-gpt-ai/' },
  { title: 'Exploring ChatGPT in 2 hours: Practical Guide', url: 'https://www.udemy.com/course/exploring-chatgpt-in-2-hours-practical-guide-for-beginners/' },
  { title: 'ChatGPT SEO for Beginners', url: 'https://www.udemy.com/course/chatgpt-seo-for-beginners-ai/' },
  { title: 'Master Chat GPT: A Comprehensive Beginner\'s Guide', url: 'https://www.udemy.com/course/master-chat-gpt-a-comprehensive-beginners-guide/' },
  { title: 'Make Teaching Easier with Artificial Intelligence (Chat GPT)', url: 'https://www.udemy.com/course/make-teaching-easier-with-artificial-intelligence-chat-gpt/' },
];

function loadToken(): string {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
  } catch {
    console.error('No token found. Run: tsx scripts/udemy-token-watcher.ts');
    process.exit(1);
  }
}

async function fetchEnrolledCourses(token: string): Promise<{ id: number; title: string }[]> {
  const allCourses: { id: number; title: string }[] = [];
  let page = 1;

  while (true) {
    const response = await axios.get(
      'https://www.udemy.com/api-2.0/users/me/subscribed-courses',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ordering: '-last_accessed',
          p: page,
          page_size: 100,
          'fields[course]': 'id,url,title,headline,published_title',
        },
        timeout: 30000,
      }
    );

    const results = response.data?.results || [];
    allCourses.push(...results.map((c: any) => ({ id: c.id, title: c.title })));

    if (!response.data?.next) break;
    page++;
  }

  return allCourses;
}

async function downloadCourses(token: string, courses: { id: number; title: string }[]) {
  const service = new UdemyService('www', 40000);
  service.setAccessToken(token);

  const storage = new CourseStorageManager({
    basePath: DOWNLOAD_PATH,
  });

  const downloader = new CourseDownloader(service, storage);

  console.log(`\n🚀 Starting download of ${courses.length} newly enrolled courses...\n`);

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    console.log(`[${i + 1}/${courses.length}] Downloading: ${course.title}`);

    try {
      await downloader.downloadCourse(
        course.id,
        course.title,
        {},
        {
          onProgress: (progress) => {
            const pct = progress.total > 0
              ? Math.round((progress.downloaded / progress.total) * 100)
              : 0;
            process.stdout.write(`  ${progress.fileName}: ${pct}%\r`);
          },
          onLectureComplete: (lectureId, fileName) => {
            console.log(`  ✓ ${fileName}`);
          },
          onLectureError: (lectureId, error) => {
            console.error(`  ✗ Lecture ${lectureId}: ${error}`);
          },
          onCourseComplete: (courseId, totalFiles, totalSize) => {
            const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`  ✅ Completed: ${totalFiles} files, ${sizeMB} MB\n`);
          },
          onCourseError: (courseId, error) => {
            console.error(`  ❌ Course error: ${error.message}\n`);
          },
        }
      );
    } catch (error: any) {
      console.error(`  ❌ Failed to download: ${error.message}\n`);
    }
  }
}

async function main() {
  const token = loadToken();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Udemy Free AI Course Enrollment + Auto-Downloader           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get baseline enrolled courses
  console.log('Checking currently enrolled courses...');
  let enrolledCourses = await fetchEnrolledCourses(token);
  console.log(`You currently have ${enrolledCourses.length} enrolled courses.\n`);

  const initialIds = new Set(enrolledCourses.map(c => c.id));

  // Open free courses in Chrome
  console.log(`Opening ${FREE_AI_COURSES.length} free AI courses in Chrome...\n`);
  for (const course of FREE_AI_COURSES) {
    spawn('open', ['-a', 'Google Chrome', course.url], {
      detached: true,
      stdio: 'ignore',
    });
    await new Promise(r => setTimeout(r, 500)); // Don't overwhelm Chrome
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ACTION REQUIRED:');
  console.log('1. In each Chrome tab, click the "Enroll" button (it\'s free)');
  console.log('2. This script will auto-detect new enrollments every 10 seconds');
  console.log('3. Once detected, courses will be downloaded automatically');
  console.log('4. Press Ctrl+C to stop monitoring');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Course tabs opened:');
  FREE_AI_COURSES.forEach((c, i) => console.log(`  ${i + 1}. ${c.title}`));
  console.log('');

  let hasDownloaded = false;
  let checks = 0;

  const interval = setInterval(async () => {
    checks++;
    try {
      const current = await fetchEnrolledCourses(token);
      const newCourses = current.filter(c => !initialIds.has(c.id));

      if (newCourses.length > 0) {
        console.log(`\n🎉 Detected ${newCourses.length} new enrollments!`);
        clearInterval(interval);
        await downloadCourses(token, newCourses);
        hasDownloaded = true;
        console.log('\n✅ All done!');
        process.exit(0);
      }

      if (checks % 6 === 0) {
        console.log(`Still waiting... (${checks * 10}s elapsed, ${current.length} total enrolled)`);
      }
    } catch (error: any) {
      console.error(`Error checking enrollments: ${error.message}`);
    }
  }, 10000);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
