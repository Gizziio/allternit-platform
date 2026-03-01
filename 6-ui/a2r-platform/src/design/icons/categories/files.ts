/**
 * File Icons
 * 
 * Icons for files, folders, and document management.
 * 
 * @module @a2r/platform/icons/categories/files
 */

export const fileIcons = [
  'file',
  'folder',
  'image',
  'video',
  'audio',
  'code',
  'document',
  'pdf',
  'zip',
  'download-file',
  'upload-file',
  'file-text',
  'file-code',
  'file-json',
  'folder-open',
  'folder-plus',
  'folder-minus',
  'folder-tree',
  'archive',
  'trash',
  'trash-2',
] as const;

export type FileIconType = typeof fileIcons[number];
