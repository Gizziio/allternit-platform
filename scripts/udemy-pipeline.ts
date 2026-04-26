#!/usr/bin/env tsx
/**
 * Udemy Course Download Pipeline
 *
 * This script:
 * 1. Acquires a valid Udemy access token (auto-extract or manual/login)
 * 2. Validates the token
 * 3. Fetches all enrolled courses
 * 4. Downloads each course using the CourseDownloader service
 *
 * Usage:
 *   tsx scripts/udemy-pipeline.ts [--token <token>] [--email <email> --password <password>]
 *
 * Environment variables:
 *   UDEMY_ACCESS_TOKEN  - Pre-provided access token
 *   UDEMY_EMAIL         - Udemy login email
 *   UDEMY_PASSWORD      - Udemy login password
 *   UDEMY_DOWNLOAD_PATH - Where to save courses (default: ~/Downloads/UdemyCourses)
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import UdemyServiceModule from '../services/udemy-downloader/src/udemy.service';
import CourseStorageManagerModule from '../services/udemy-downloader/src/course-storage.manager';
import CourseDownloaderModule from '../services/udemy-downloader/src/course-downloader.module';
import type { UdemyCourse } from '../services/udemy-downloader/src/udemy.service';

const UdemyService = (UdemyServiceModule as any).default || UdemyServiceModule;
const CourseStorageManager = (CourseStorageManagerModule as any).default || CourseStorageManagerModule;
const CourseDownloader = (CourseDownloaderModule as any).default || CourseDownloaderModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_FILE = path.join(os.homedir(), '.udemy-token');
const DEFAULT_DOWNLOAD_PATH = path.join(os.homedir(), 'Downloads', 'UdemyCourses');

interface PipelineConfig {
  token?: string;
  email?: string;
  password?: string;
  downloadPath: string;
}

function parseArgs(): PipelineConfig {
  const args = process.argv.slice(2);
  const config: PipelineConfig = {
    downloadPath: process.env.UDEMY_DOWNLOAD_PATH || DEFAULT_DOWNLOAD_PATH,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--token':
        config.token = args[++i];
        break;
      case '--email':
        config.email = args[++i];
        break;
      case '--password':
        config.password = args[++i];
        break;
      case '--download-path':
        config.downloadPath = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Udemy Course Download Pipeline

Usage:
  tsx scripts/udemy-pipeline.ts [options]

Options:
  --token <token>           Use this access token directly
  --email <email>           Udemy email for direct login
  --password <password>     Udemy password for direct login
  --download-path <path>    Where to save courses (default: ~/Downloads/UdemyCourses)
  --help                    Show this help

Environment variables:
  UDEMY_ACCESS_TOKEN        Pre-provided access token
  UDEMY_EMAIL               Udemy login email
  UDEMY_PASSWORD            Udemy login password
  UDEMY_DOWNLOAD_PATH       Download destination

Token acquisition priority:
  1. --token argument
  2. UDEMY_ACCESS_TOKEN env var
  3. Saved token file (~/.udemy-token)
  4. Chrome cookie auto-extraction
  5. Firefox cookie auto-extraction
  6. Direct login (--email + --password or env vars)
        `);
        process.exit(0);
    }
  }

  // Override with env vars if not provided via args
  if (!config.token && process.env.UDEMY_ACCESS_TOKEN) {
    config.token = process.env.UDEMY_ACCESS_TOKEN;
  }
  if (!config.email && process.env.UDEMY_EMAIL) {
    config.email = process.env.UDEMY_EMAIL;
  }
  if (!config.password && process.env.UDEMY_PASSWORD) {
    config.password = process.env.UDEMY_PASSWORD;
  }

  return config;
}

async function loadSavedToken(): Promise<string | undefined> {
  try {
    const token = await fs.readFile(TOKEN_FILE, 'utf-8');
    return token.trim();
  } catch {
    return undefined;
  }
}

async function saveToken(token: string): Promise<void> {
  await fs.writeFile(TOKEN_FILE, token, { mode: 0o600 });
  console.log(`Token saved to ${TOKEN_FILE}`);
}

function extractChromeToken(): string | undefined {
  try {
    const scriptPath = path.join(__dirname, 'extract-udemy-token.py');
    const result = execSync(`python3 "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch {
    return undefined;
  }
}

function extractFirefoxToken(): string | undefined {
  try {
    const home = os.homedir();
    const profilesDir = path.join(home, 'Library/Application Support/Firefox/Profiles');
    const profiles = require('fs').readdirSync(profilesDir).filter((d: string) =>
      require('fs').statSync(path.join(profilesDir, d)).isDirectory()
    );

    for (const profile of profiles) {
      const dbPath = path.join(profilesDir, profile, 'cookies.sqlite');
      if (!require('fs').existsSync(dbPath)) continue;

      const tmpDb = path.join(os.tmpdir(), `udemy-ff-${Date.now()}.sqlite`);
      require('fs').copyFileSync(dbPath, tmpDb);

      try {
        const result = execSync(
          `sqlite3 "${tmpDb}" "SELECT value FROM moz_cookies WHERE host LIKE '%udemy.com' AND name = 'access_token' LIMIT 1;"`,
          { encoding: 'utf-8', timeout: 5000 }
        );
        require('fs').unlinkSync(tmpDb);
        const token = result.trim();
        if (token) return token;
      } catch {
        try { require('fs').unlinkSync(tmpDb); } catch {}
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function loginDirect(email: string, password: string): Promise<string | undefined> {
  try {
    const response = await axios.post(
      'https://www.udemy.com/api-2.0/auth/login',
      { email, password },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    // The access token might be in cookies or response body depending on Udemy's API
    const cookies = response.headers['set-cookie'] || [];
    for (const cookie of cookies) {
      const match = cookie.match(/access_token=([^;]+)/);
      if (match) return match[1];
    }
    if (response.data?.access_token) {
      return response.data.access_token;
    }
    if (response.data?.tokens?.access) {
      return response.data.tokens.access;
    }
  } catch (error: any) {
    console.error('Direct login failed:', error.response?.data?.detail || error.message);
  }
  return undefined;
}

async function acquireToken(config: PipelineConfig): Promise<string> {
  // 1. Explicit token argument
  if (config.token) {
    console.log('Using provided access token.');
    return config.token;
  }

  // 2. Saved token file
  const saved = await loadSavedToken();
  if (saved) {
    console.log('Using saved token from', TOKEN_FILE);
    return saved;
  }

  // 3. Chrome cookies
  const chromeToken = extractChromeToken();
  if (chromeToken) {
    console.log('Extracted token from Chrome cookies.');
    await saveToken(chromeToken);
    return chromeToken;
  }

  // 4. Firefox cookies
  const ffToken = extractFirefoxToken();
  if (ffToken) {
    console.log('Extracted token from Firefox cookies.');
    await saveToken(ffToken);
    return ffToken;
  }

  // 5. Direct login
  if (config.email && config.password) {
    console.log('Attempting direct login...');
    const loginToken = await loginDirect(config.email, config.password);
    if (loginToken) {
      console.log('Login successful.');
      await saveToken(loginToken);
      return loginToken;
    }
  }

  // 6. Failed - provide instructions
  console.error(`
❌ Could not acquire Udemy access token automatically.

The following methods were attempted:
  • Chrome cookie extraction
  • Firefox cookie extraction
  • Saved token file (~/.udemy-token)
  • Direct login (if credentials provided)

To proceed, please provide your access token using ONE of these methods:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 1: Manual Token Copy (Fastest)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Open Chrome (or Firefox) and go to https://www.udemy.com
2. Make sure you are logged in
3. Press F12 (or Cmd+Option+I) to open Developer Tools
4. Go to the Console tab
5. Paste this command and press Enter:

   document.cookie.split('; ').find(c => c.startsWith('access_token='))?.split('=')[1]

6. Copy the resulting string (it's your access token)
7. Run this script again with:

   tsx scripts/udemy-pipeline.ts --token "PASTE_TOKEN_HERE"

Or save it to a file so it's reused:

   echo "PASTE_TOKEN_HERE" > ~/.udemy-token
   chmod 600 ~/.udemy-token

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2: Direct Login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Set environment variables and run:

   export UDEMY_EMAIL="your@email.com"
   export UDEMY_PASSWORD="your_password"
   tsx scripts/udemy-pipeline.ts

Or pass them directly:

   tsx scripts/udemy-pipeline.ts --email "your@email.com" --password "your_password"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 3: Browser Extension
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Install "EditThisCookie" or "Cookie-Editor" extension in Chrome,
open it on udemy.com, find the "access_token" cookie, copy its value.
  `);
  process.exit(1);
}

async function validateToken(token: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const response = await axios.get(
      'https://www.udemy.com/api-2.0/users/me/',
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );
    return { valid: true, user: response.data };
  } catch (error: any) {
    return {
      valid: false,
      user: undefined,
    };
  }
}

async function fetchEnrolledCourses(token: string): Promise<UdemyCourse[]> {
  const allCourses: UdemyCourse[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await axios.get(
      'https://www.udemy.com/api-2.0/users/me/subscribed-courses',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ordering: '-last_accessed',
          p: page,
          page_size: pageSize,
          'fields[course]': 'id,url,title,headline,published_title,num_subscribers,image_240x135,image_480x270',
        },
        timeout: 30000,
      }
    );

    const results: UdemyCourse[] = response.data?.results || [];
    allCourses.push(...results);

    console.log(`  Fetched page ${page}: ${results.length} courses (total so far: ${allCourses.length})`);

    if (!response.data?.next) break;
    page++;
  }

  return allCourses;
}

async function downloadCourses(
  token: string,
  courses: UdemyCourse[],
  downloadPath: string
): Promise<void> {
  const service = new UdemyService('www', 40000);
  service.setAccessToken(token);

  const storage = new CourseStorageManager({
    basePath: downloadPath,
  });

  const downloader = new CourseDownloader(service, storage);

  console.log(`\nStarting downloads to: ${downloadPath}`);
  console.log(`Total courses to download: ${courses.length}\n`);

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    console.log(`[${i + 1}/${courses.length}] Downloading: ${course.title}`);

    try {
      const result = await downloader.downloadCourse(
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
            console.log(`  Completed: ${totalFiles} files, ${sizeMB} MB\n`);
          },
          onCourseError: (courseId, error) => {
            console.error(`  Course error: ${error.message}\n`);
          },
        }
      );

      if (!result.success) {
        console.error(`  Warning: course completed with ${result.failedLectures} failed lectures\n`);
      }
    } catch (error: any) {
      console.error(`  Failed to download course: ${error.message}\n`);
    }
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Udemy Course Download Pipeline                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const config = parseArgs();

  // Acquire token
  console.log('Step 1: Acquiring access token...\n');
  const token = await acquireToken(config);
  await saveToken(token);

  // Validate token
  console.log('\nStep 2: Validating token...');
  const validation = await validateToken(token);
  if (!validation.valid) {
    console.error('\n❌ Token is invalid or expired. Please obtain a fresh token.');
    try { await fs.unlink(TOKEN_FILE); } catch {}
    process.exit(1);
  }
  console.log('✓ Token is valid.');
  if (validation.user) {
    console.log(`  User: ${validation.user.display_name || validation.user.email}`);
  }

  // Fetch courses
  console.log('\nStep 3: Fetching enrolled courses...');
  const courses = await fetchEnrolledCourses(token);
  console.log(`✓ Found ${courses.length} enrolled courses.`);

  if (courses.length === 0) {
    console.log('\nNo courses to download.');
    process.exit(0);
  }

  // Display courses
  console.log('\nCourses:');
  courses.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.title} (${c.published_title})`);
  });

  // Download
  console.log('\nStep 4: Downloading courses...');
  await downloadCourses(token, courses, config.downloadPath);

  console.log('\n✅ Pipeline complete!');
}

main().catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
