/**
 * Attachment utilities
 */

export interface Attachment {
  id: string
  filename: string
  contentType: string
  size: number
  data: Buffer | string
}

export function createAttachment(filename: string, data: Buffer | string, contentType?: string): Attachment {
  return {
    id: generateAttachmentId(),
    filename,
    contentType: contentType || inferContentType(filename),
    size: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8'),
    data,
  }
}

export function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'js': 'application/javascript',
    'ts': 'application/typescript',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
  }
  return types[ext || ''] || 'application/octet-stream'
}

function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function validateAttachment(attachment: Attachment): boolean {
  return !!(attachment.id && attachment.filename && attachment.contentType)
}

export function getAttachmentSizeString(attachment: Attachment): string {
  const bytes = attachment.size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default {
  createAttachment,
  inferContentType,
  validateAttachment,
  getAttachmentSizeString,
}
