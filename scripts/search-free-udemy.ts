import { chromium } from 'playwright';

const urls = [
  'https://www.udemy.com/courses/search/?q=LangChain%20RAG&price=price-free',
  'https://www.udemy.com/courses/search/?q=OpenCV&price=price-free',
  'https://www.udemy.com/courses/search/?q=n8n&price=price-free',
  'https://www.udemy.com/courses/search/?q=GitHub%20Copilot&price=price-free',
  'https://www.udemy.com/courses/search/?q=Cursor%20AI&price=price-free',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  
  for (const url of urls) {
    console.log(`\n--- ${url} ---`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(4000);
      
      // Try multiple selectors for course cards
      const courses = await page.$$eval(
        '[data-purpose="course-card-title"], .course-card--course-title--2VMmZ, h3[class*="course-title"], a[href*="/course/"] h3, [class*="course-title"]',
        (els: any[]) => els
          .map(el => {
            const anchor = el.closest ? el.closest('a[href*="/course/"]') : null;
            return {
              title: el.textContent?.trim() || '',
              url: anchor ? (anchor as HTMLAnchorElement).href : '',
            };
          })
          .filter(c => c.title && c.url)
          .filter((c, i, arr) => arr.findIndex((x: any) => x.url === c.url) === i)
          .slice(0, 5)
      );
      
      for (const c of courses) {
        console.log(`  ${c.title}`);
        console.log(`    ${c.url}`);
      }
      if (courses.length === 0) {
        const html = await page.content();
        const hasBlock = html.includes('robot') || html.includes('captcha') || html.includes('verify');
        console.log(`  No courses found. Block detected: ${hasBlock}`);
      }
    } catch (e) {
      console.log('  ERROR:', (e as Error).message);
    }
  }
  
  await browser.close();
})();
