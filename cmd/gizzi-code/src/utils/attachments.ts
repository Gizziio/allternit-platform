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

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { AUTO_MODE_ATTACHMENT_CONFIG, PLAN_MODE_ATTACHMENT_CONFIG, RELEVANT_MEMORIES_CONFIG, TODO_REMINDER_CONFIG, VERIFY_PLAN_REMINDER_CONFIG, collectRecentSuccessfulTools, collectSurfacedMemories, createAttachmentMessage, extractAgentMentions, extractAtMentionedFiles, extractMcpResourceMentions, filterDuplicateMemoryAttachments, filterToBundledAndMcp, generateFileAttachment, getAgentListingDeltaAttachment, getAgentPendingMessageAttachments, getAttachmentMessages, getAttachments, getChangedFiles, getCompactionReminderAttachment, getContextEfficiencyAttachment, getDateChangeAttachments, getDeferredToolsDeltaAttachment, getDirectoriesToProcess, getMcpInstructionsDeltaAttachment, getQueuedCommandAttachments, getVerifyPlanReminderTurnCount, memoryFilesToAttachments, memoryHeader, parseAtMentionedFileLines, readMemoriesForSurfacing, resetSentSkillNames, startRelevantMemoryPrefetch, suppressNextSkillListing, tryGetPDFReference } from "../shared/utils/attachments.js";
export type { AgentMentionAttachment, AlreadyReadFileAttachment, AsyncHookResponseAttachment, CompactFileReferenceAttachment, FileAttachment, HookAttachment, HookCancelledAttachment, HookErrorDuringExecutionAttachment, HookNonBlockingErrorAttachment, HookPermissionDecisionAttachment, HookSuccessAttachment, HookSystemMessageAttachment, MemoryPrefetch, PDFReferenceAttachment, TeamContextAttachment, TeammateMailboxAttachment } from "../shared/utils/attachments.js";
