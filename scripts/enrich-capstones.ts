import fs from 'fs/promises';
import path from 'path';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

async function getMyCourses() {
  const courses: any[] = [];
  let page = 1;
  while (true) {
    const resp = await fetch(`${BASE_URL}/courses?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    courses.push(...data);
    page++;
    if (page > 5) break;
  }
  return courses.filter(c => c.course_code?.startsWith('ALABS-'));
}

async function loadCapstoneMarkdown(courseCode: string): Promise<string | null> {
  const dir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-content', courseCode);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const capFile = files.find(f => f.toLowerCase().includes('capstone') && f.endsWith('.md'));
  if (!capFile) return null;
  return await fs.readFile(path.join(dir, capFile), 'utf-8');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList: false | 'ul' | 'ol' = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) out.push(`<p>${inlineFormatting(text)}</p>`);
      paragraphBuffer = [];
    }
  }

  function closeList() {
    if (inList) {
      out.push(`</${inList}>`);
      inList = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }
  }

  function inlineFormatting(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[ \]/g, '<input type="checkbox" disabled>')
      .replace(/\[x\]/gi, '<input type="checkbox" checked disabled>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        out.push('</pre></div>');
        inCodeBlock = false;
      } else {
        flushParagraph(); closeList(); closeBlockquote();
        out.push(`<div style="background:#f4f4f4;padding:12px;border-radius:6px;margin:12px 0;"><pre style="margin:0;overflow-x:auto;">`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph(); closeList(); closeBlockquote();
      out.push(`<h1>${inlineFormatting(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph(); closeList(); closeBlockquote();
      out.push(`<h2>${inlineFormatting(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph(); closeList(); closeBlockquote();
      out.push(`<h3>${inlineFormatting(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph(); closeList();
      if (!inBlockquote) {
        out.push('<blockquote style="border-left:4px solid #e2e8f0;padding-left:16px;margin:16px 0;color:#475569;">');
        inBlockquote = true;
      }
      out.push(`<p>${inlineFormatting(trimmed.slice(2))}</p>`);
      continue;
    } else if (inBlockquote && trimmed === '') {
      closeBlockquote(); continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    const ulMatch = trimmed.match(/^- (.+)$/);
    const olMatch = trimmed.match(/^\d+\. (.+)$/);

    if (ulMatch) {
      flushParagraph();
      if (inList !== 'ul') {
        if (inList) closeList();
        out.push('<ul>');
        inList = 'ul';
      }
      out.push(`<li>${inlineFormatting(ulMatch[1])}</li>`);
      continue;
    }

    if (olMatch) {
      flushParagraph();
      if (inList !== 'ol') {
        if (inList) closeList();
        out.push('<ol>');
        inList = 'ol';
      }
      out.push(`<li>${inlineFormatting(olMatch[1])}</li>`);
      continue;
    }

    if ((inList || inBlockquote) && trimmed === '') {
      closeList(); closeBlockquote(); continue;
    }

    if (trimmed === '---') {
      flushParagraph(); closeList(); closeBlockquote(); out.push('<hr>'); continue;
    }

    if (trimmed === '') {
      flushParagraph(); continue;
    }

    paragraphBuffer.push(inlineFormatting(trimmed));
  }

  flushParagraph(); closeList(); closeBlockquote();
  if (inCodeBlock) out.push('</pre></div>');
  return out.join('\n');
}

async function getAssignments(courseId: number): Promise<any[]> {
  const assignments: any[] = [];
  let page = 1;
  while (true) {
    const data = await canvasApi('GET', `/courses/${courseId}/assignments?per_page=100&page=${page}`) as any[];
    if (!Array.isArray(data) || data.length === 0) break;
    assignments.push(...data);
    page++;
    if (page > 5) break;
  }
  return assignments;
}

async function createAssignmentGroups(courseId: number) {
  // Check existing groups
  const groups = await canvasApi('GET', `/courses/${courseId}/assignment_groups?per_page=100`) as any[];
  const hasChallenges = groups.some(g => g.name === 'Module Challenges');
  const hasCapstone = groups.some(g => g.name === 'Capstone Project');
  
  if (!hasChallenges) {
    await canvasApi('POST', `/courses/${courseId}/assignment_groups`, {
      assignment_group: { name: 'Module Challenges', group_weight: 0 }
    });
    console.log(`  ✅ Created assignment group: Module Challenges`);
  }
  if (!hasCapstone) {
    await canvasApi('POST', `/courses/${courseId}/assignment_groups`, {
      assignment_group: { name: 'Capstone Project', group_weight: 100 }
    });
    console.log(`  ✅ Created assignment group: Capstone Project`);
  }
  
  return groups;
}

async function moveAssignmentToGroup(courseId: number, assignmentId: number, groupName: string) {
  const groups = await canvasApi('GET', `/courses/${courseId}/assignment_groups?per_page=100`) as any[];
  const group = groups.find(g => g.name === groupName);
  if (!group) return;
  
  await canvasApi('PUT', `/courses/${courseId}/assignments/${assignmentId}`, {
    assignment: { assignment_group_id: group.id }
  });
}

async function enrichCourse(courseId: number, courseCode: string) {
  console.log(`\n--- Enriching ${courseCode} ---`);
  
  // Create assignment groups
  await createAssignmentGroups(courseId);
  
  const capstoneMd = await loadCapstoneMarkdown(courseCode);
  const capstoneHtml = capstoneMd ? markdownToHtml(capstoneMd) : null;
  
  const assignments = await getAssignments(courseId);
  
  for (const assignment of assignments) {
    if (assignment.name.toLowerCase().includes('capstone')) {
      if (!assignment.description || assignment.description.length < 50) {
        const html = capstoneHtml || `<h1>${assignment.name}</h1><p>Complete the capstone project as described in the course materials.</p>`;
        await canvasApi('PUT', `/courses/${courseId}/assignments/${assignment.id}`, {
          assignment: { description: html }
        });
        console.log(`  ✅ Enriched capstone description`);
      }
      await moveAssignmentToGroup(courseId, assignment.id, 'Capstone Project');
      console.log(`  📁 Moved capstone to Capstone Project group`);
    } else if (assignment.name.toLowerCase().includes('challenge')) {
      await moveAssignmentToGroup(courseId, assignment.id, 'Module Challenges');
    }
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Enriching assignments in ${courses.length} courses...\n`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await enrichCourse(course.id, course.course_code);
  }
  
  console.log('\n✅ Capstone descriptions enriched and assignments organized!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
