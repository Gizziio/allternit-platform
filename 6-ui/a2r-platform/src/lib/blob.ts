/**
 * Blob storage utilities
 * Uses local filesystem or S3-compatible storage for file uploads
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface BlobUploadResult {
  url: string;
  pathname: string;
  contentType: string;
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

  // In development, save to local filesystem
  if (process.env.NODE_ENV === "development") {
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

  // Production: Use S3 or other cloud storage
  // TODO: Implement S3 upload for production
  throw new Error("Production blob storage not implemented");
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
  // TODO: Implement blob deletion
  console.warn(`deleteBlob not implemented for ${url}`);
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
