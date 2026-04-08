/**
 * Blob storage utilities
 * Uses local filesystem or S3-compatible storage for file uploads
 */

import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface BlobUploadResult {
  url: string;
  pathname: string;
  contentType: string;
}

interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

// Get S3 configuration from environment
function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

/**
 * Upload a file to blob storage
 * Uses local filesystem in development, S3 in production
 */
export async function uploadFile(
  pathname: string,
  data: Buffer | Blob | string
): Promise<BlobUploadResult> {
  // Determine content type from pathname
  const contentType = getContentType(pathname);

  // Check if S3 is configured
  const s3Config = getS3Config();
  
  if (s3Config && process.env.NODE_ENV === "production") {
    // Production: Use S3
    return uploadToS3(s3Config, pathname, data, contentType);
  }

  // Development: Save to local filesystem
  const uploadDir = join(process.cwd(), "public", "uploads");
  
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  const filePath = join(uploadDir, pathname);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string, "base64");
  
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${pathname}`,
    pathname,
    contentType,
  };
}

/**
 * Upload to S3-compatible storage
 */
async function uploadToS3(
  config: S3Config,
  pathname: string,
  data: Buffer | Blob | string,
  contentType: string
): Promise<BlobUploadResult> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string, "base64");
  
  // Import S3 client dynamically (only when needed)
  // @ts-expect-error - AWS SDK may not be installed in development
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  
  const s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // Required for MinIO and some S3-compatible services
  });

  const key = `uploads/${pathname}`;
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // Construct public URL
  const url = `${config.endpoint}/${config.bucket}/${key}`;

  return {
    url,
    pathname,
    contentType,
  };
}

/**
 * Upload blob data
 */
export async function uploadBlob(
  data: Buffer | Blob | string,
  filename: string,
  contentType: string
): Promise<BlobUploadResult> {
  return uploadFile(filename, data);
}

/**
 * Delete a blob by URL
 */
export async function deleteBlob(url: string): Promise<void> {
  // Check if it's a local file
  if (url.startsWith('/uploads/')) {
    const filePath = join(process.cwd(), "public", url);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
    return;
  }

  // Check if it's an S3 URL
  const s3Config = getS3Config();
  if (s3Config && url.includes(s3Config.endpoint)) {
    // @ts-expect-error - AWS SDK may not be installed in development
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    
    const s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true,
    });

    // Extract key from URL
    const urlObj = new URL(url);
    const key = urlObj.pathname.replace(`/${s3Config.bucket}/`, '');

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      })
    );
    return;
  }

  console.warn(`deleteBlob: Unknown URL format ${url}`);
}

/**
 * Download blob data
 */
export async function downloadBlob(url: string): Promise<Buffer> {
  // Check if it's a local file
  if (url.startsWith('/uploads/')) {
    const filePath = join(process.cwd(), "public", url);
    return readFile(filePath);
  }

  // For S3 URLs, fetch via HTTP
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download blob: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get content type from filename
 */
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    md: "text/markdown",
  };
  return contentTypes[ext ?? ""] ?? "application/octet-stream";
}
