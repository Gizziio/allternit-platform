import fs from 'fs/promises';
import path from 'path';

const UDEMY_DIR = '/Users/macbook/Downloads/UdemyCourses/courses';
const OUTPUT_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/remix-content/extracted-html';

interface ExtractedLecture {
  courseDir: string;
  chapterDir: string;
  fileName: string;
  title: string;
  bodyHtml: string;
  textContent: string;
  wordCount: number;
  isPromotional: boolean;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isPromotionalPage(text: string, title: string): boolean {
  const lower = text.toLowerCase();
  const promoSignals = [
    '5-star review',
    'review means a lot',
    'honest review',
    'explore my other courses',
    'congratulations on completing',
    'thank you for completing',
    'referralcode',
    'udemy.com/course/',
    'dezlearn.com',
    'happy learning',
    'next step',
    'bonus',
    'continue your learning'
  ];
  const score = promoSignals.filter(s => lower.includes(s)).length;
  return score >= 2 || title.toLowerCase().includes('next step') || title.toLowerCase().includes('bonus');
}

async function extractLecture(filePath: string, courseDir: string, chapterDir: string): Promise<ExtractedLecture | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Extract title
  const titleMatch = content.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.html');
  
  // Extract body
  const bodyMatch = content.match(/<body>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1].trim() : content;
  
  const textContent = stripHtml(bodyHtml);
  const wordCount = textContent.split(/\s+/).length;
  
  if (wordCount < 20) return null; // Skip nearly-empty pages
  
  const promotional = isPromotionalPage(textContent, title);
  
  return {
    courseDir,
    chapterDir,
    fileName: path.basename(filePath),
    title,
    bodyHtml,
    textContent,
    wordCount,
    isPromotional: promotional
  };
}

async function findHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const coursePath = path.join(dir, entry.name);
    const chaptersPath = path.join(coursePath, 'chapters');
    
    if (!(await exists(chaptersPath))) continue;
    
    const chapterDirs = await fs.readdir(chaptersPath, { withFileTypes: true });
    for (const chapter of chapterDirs) {
      if (!chapter.isDirectory()) continue;
      const chapterPath = path.join(chaptersPath, chapter.name);
      const lectureFiles = await fs.readdir(chapterPath);
      for (const file of lectureFiles) {
        if (file.endsWith('.html')) {
          files.push(path.join(chapterPath, file));
        }
      }
    }
  }
  
  return files;
}

async function main() {
  console.log('Scanning for HTML lecture files...');
  const htmlFiles = await findHtmlFiles(UDEMY_DIR);
  console.log(`Found ${htmlFiles.length} HTML files`);
  
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  const extracted: ExtractedLecture[] = [];
  const byCourse: Record<string, ExtractedLecture[]> = {};
  
  for (const filePath of htmlFiles) {
    const parts = filePath.split(path.sep);
    const coursesIdx = parts.indexOf('courses');
    const courseDir = parts[coursesIdx + 1];
    const chapterDir = parts[coursesIdx + 3];
    
    const lecture = await extractLecture(filePath, courseDir, chapterDir);
    if (!lecture) continue;
    
    extracted.push(lecture);
    if (!byCourse[courseDir]) byCourse[courseDir] = [];
    byCourse[courseDir].push(lecture);
  }
  
  console.log(`\nExtraction summary:`);
  console.log(`  Total lectures extracted: ${extracted.length}`);
  console.log(`  Promotional pages skipped: ${extracted.filter(e => e.isPromotional).length}`);
  console.log(`  Usable content pages: ${extracted.filter(e => !e.isPromotional).length}`);
  console.log(`  Total words: ${extracted.reduce((sum, e) => sum + e.wordCount, 0)}`);
  
  // Write per-course summaries
  for (const [course, lectures] of Object.entries(byCourse)) {
    const usable = lectures.filter(e => !e.isPromotional);
    const outputPath = path.join(OUTPUT_DIR, `${course}.md`);
    
    let md = `# Extracted Content: ${course}\n\n`;
    md += `**Total lectures:** ${lectures.length}  \n`;
    md += `**Usable content pages:** ${usable.length}  \n`;
    md += `**Promotional/skipped pages:** ${lectures.filter(e => e.isPromotional).length}  \n\n`;
    
    for (const lecture of usable) {
      md += `## ${lecture.title}\n\n`;
      md += `*Chapter: ${lecture.chapterDir} | Words: ${lecture.wordCount}*\n\n`;
      md += `${lecture.textContent}\n\n`;
      md += `---\n\n`;
    }
    
    await fs.writeFile(outputPath, md);
    console.log(`  ✅ ${course}: ${usable.length}/${lectures.length} usable pages → ${outputPath}`);
  }
  
  // Write index JSON
  const index = extracted.map(e => ({
    courseDir: e.courseDir,
    chapterDir: e.chapterDir,
    fileName: e.fileName,
    title: e.title,
    wordCount: e.wordCount,
    isPromotional: e.isPromotional
  }));
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
  
  console.log('\n✅ Extraction complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
