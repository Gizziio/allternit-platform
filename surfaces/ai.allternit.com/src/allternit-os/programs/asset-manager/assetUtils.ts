/**
 * Asset Manager Utilities
 */

import { DriveEntry } from '../../services/FileSystemService';

export const getFileIcon = (entry: DriveEntry): string => {
  if (entry.type === 'folder') return '📁';
  
  const mimeType = entry.mimeType || '';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.includes('markdown') || mimeType.includes('text')) return '📝';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return '💻';
  return '📄';
};

export const isPreviewable = (entry: DriveEntry): boolean => {
  if (entry.type === 'folder') return false;
  const mimeType = entry.mimeType || '';
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType.startsWith('audio/') ||
         mimeType.includes('pdf') ||
         mimeType.includes('text') ||
         mimeType.includes('markdown');
};
