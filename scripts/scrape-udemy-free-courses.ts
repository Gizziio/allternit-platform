#!/usr/bin/env tsx
/**
 * Scrape free AI courses from Udemy using Playwright with real Chrome profile
 */

import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PROFILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
const SEARCH_QUERIES = [
  'chatgpt prompt engineering',
  'langchain',
  'python machine learning',
  'AI agents',
  'RAG retrieval augmented generation',
  'computer vision python',
];

interface Course {
  id: number;
  title: string;
  url: string;
  rating: number;
  numReviews: number;
  isFree: boolean;
}

async function searchUdemy(browser: any, query: string): Promise<Course[]> {
  const page = await browser.newPage();
  const searchUrl = `https://www.udemy.com/courses/search/?q=${encodeURIComponent(query)}&price=price-free&sort=highest-rated`;
  
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for course cards to load
    await page.waitForSelector('[data-purpose="course-title-url"]', { timeout: 10000 });
    
    // Extract course data from the page
    const courses = await page.evaluate(() => {
      const results: any[] = [];
      const cards = document.querySelectorAll('[data-purpose="course-title-url"]');
      
      cards.forEach(card => {
        const link = card.closest('a') || card;
        const href = (link as HTMLAnchorElement).href || '';
        const idMatch = href.match(/course\/(\d+)/);
        const id = idMatch ? parseInt(idMatch[1]) : 0;
        
        const title = card.textContent?.trim() || '';
        
        // Find rating in parent container
        let container = card.closest('[class*="course-card"]') || card.closest('div[class*="styles_course-card"]') || card.parentElement?.parentElement?.parentElement;
        const ratingEl = container?.querySelector('[data-purpose="rating-number"]');
        const rating = ratingEl ? parseFloat(ratingEl.textContent || '0') : 0;
        
        const reviewsEl = container?.querySelector('[data-purpose="reviews-text"]');
        const reviewsText = reviewsEl?.textContent || '';
        const numReviews = parseInt(reviewsText.replace(/[\(\),]/g, '')) || 0;
        
        if (id && title) {
          results.push({ id, title, url: href, rating, numReviews, isFree: true });
        }
      });
      
      return results;
    });
    
    return courses;
  } catch (error) {
    console.error(`Error searching "${query}":`, (error as Error).message);
    return [];
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Launching Chrome with real profile...\n');
  
  const browser = await chromium.launchPersistentContext(CHROME_PROFILE + '/Default', {
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  
  const allCourses = new Map<number, Course>();
  
  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: "${query}"...`);
    const courses = await searchUdemy(browser, query);
    console.log(`  Found ${courses.length} courses`);
    
    for (const course of courses) {
      if (!allCourses.has(course.id)) {
        allCourses.set(course.id, course);
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  
  const sorted = Array.from(allCourses.values()).sort((a, b) => b.rating - a.rating);
  console.log(`\n✅ Total unique free courses found: ${sorted.length}\n`);
  
  sorted.forEach((c, i) => {
    console.log(`${i + 1}. ${c.title}`);
    console.log(`   ID: ${c.id} | Rating: ${c.rating}⭐ (${c.numReviews} reviews)`);
    console.log(`   URL: ${c.url}\n`);
  });
  
  fs.writeFileSync('/tmp/udemy-free-courses-scraped.json', JSON.stringify(sorted, null, 2));
}

main().catch(console.error);
