/**
 * Source type definitions for search result icons and categorization.
 */

export type SourceType =
  | 'web'
  | 'news'
  | 'academic'
  | 'blog'
  | 'social'
  | 'github'
  | 'docs'
  | 'video'
  | 'image'
  | 'shopping'
  | 'map'
  | 'finance'
  | 'legal'
  | 'medical'
  | 'other';

export const SOURCE_LABELS: Record<SourceType, string> = {
  web: 'Web',
  news: 'News',
  academic: 'Academic',
  blog: 'Blog',
  social: 'Social',
  github: 'GitHub',
  docs: 'Docs',
  video: 'Video',
  image: 'Image',
  shopping: 'Shopping',
  map: 'Map',
  finance: 'Finance',
  legal: 'Legal',
  medical: 'Medical',
  other: 'Other',
};
