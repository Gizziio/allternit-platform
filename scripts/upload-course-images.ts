import * as fs from 'fs';
import * as path from 'path';

const COURSES = [
  { id: '14593493', code: 'ALABS-CORE-COPILOT' },
  { id: '14593495', code: 'ALABS-CORE-PROMPTS' },
  { id: '14593499', code: 'ALABS-OPS-N8N' },
  { id: '14593501', code: 'ALABS-OPS-VISION' },
  { id: '14593503', code: 'ALABS-OPS-RAG' },
  { id: '14593505', code: 'ALABS-AGENTS-ML' },
  { id: '14593507', code: 'ALABS-AGENTS-AGENTS' },
  { id: '14612851', code: 'ALABS-ADV-PLUGINSDK' },
  { id: '14612861', code: 'ALABS-ADV-WORKFLOW' },
  { id: '14612869', code: 'ALABS-ADV-ADAPTERS' },
];

const IMAGE_DIR = 'alabs-course-covers';
const BASE_URL = 'https://canvas.instructure.com/api/v1';
const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';

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
  if (resp.status === 204) return undefined;
  return resp.json();
}

async function uploadFile(courseId: string, filePath: string) {
  const stat = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  const contentType = 'image/png';

  // Step 1: Request upload URL
  const preflight = await canvasApi('POST', `/courses/${courseId}/files`, {
    name: fileName,
    size: stat.size,
    content_type: contentType,
    parent_folder_path: '/',
  }) as any;

  const uploadUrl = preflight.upload_url;
  const uploadParams = preflight.upload_params;

  if (!uploadUrl) {
    throw new Error(`No upload_url returned for course ${courseId}`);
  }

  // Step 2: Build multipart form-data manually
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const fileData = fs.readFileSync(filePath);

  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(uploadParams)) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    ));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  ));
  parts.push(fileData);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed for course ${courseId}: ${response.status} ${text}`);
  }

  const result = await response.json() as any;
  return result;
}

async function setCourseImage(courseId: string, fileId: string | number) {
  await canvasApi('PUT', `/courses/${courseId}`, {
    course: { image_id: fileId },
  });
}

async function main() {
  for (const course of COURSES) {
    const filePath = path.join(IMAGE_DIR, `${course.code}.png`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing image for ${course.code}, skipping.`);
      continue;
    }

    try {
      console.log(`Uploading ${course.code}...`);
      const uploaded = await uploadFile(course.id, filePath);
      await setCourseImage(course.id, uploaded.id);
      console.log(`  ✅ Set course image for ${course.code} (file ${uploaded.id})`);
    } catch (err: any) {
      console.error(`  ❌ Failed for ${course.code}: ${err.message}`);
    }
  }
}

main();
