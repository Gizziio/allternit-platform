import type { Publication, ContentType } from '@/types/publication';

export interface DiscoveryItem {
  id: string;
  type: 'article' | 'video' | 'publication' | 'gallery' | 'research';
  title: string;
  subtitle: string;
  excerpt: string;
  imageUrl?: string;
  badge: string;
  badgeColor: string;
  ctaLabel: string;
  ctaAction: 'notebook' | 'external' | 'read';
  ctaTarget?: string;
  date: string;
  readTime: string;
}

const TYPE_MAP: Record<ContentType, DiscoveryItem['type']> = {
  signal: 'article',
  feature: 'article',
  index: 'publication',
  annual: 'publication',
  course: 'gallery',
  lesson: 'article',
};

const BADGE_MAP: Record<ContentType, string> = {
  signal: 'Daily Brief',
  feature: 'Weekly Feature',
  index: 'Quarterly Index',
  annual: 'Annual Report',
  course: 'A://Labs Course',
  lesson: 'Lab Lesson',
};

const COLOR_MAP: Record<ContentType, string> = {
  signal: '#10b981',
  feature: '#3b82f6',
  index: '#f59e0b',
  annual: '#f59e0b',
  course: '#8b5cf6',
  lesson: '#ec4899',
};

const CTA_MAP: Record<ContentType, string> = {
  signal: 'Read Brief',
  feature: 'Read Feature',
  index: 'Open Report',
  annual: 'Read Annual',
  course: 'Start Learning',
  lesson: 'Open Lesson',
};

export function mapPublicationToDiscoveryItem(pub: Publication): DiscoveryItem {
  const ct = pub.contentType;
  return {
    id: pub.id,
    type: TYPE_MAP[ct] ?? 'article',
    title: pub.title,
    subtitle: pub.subtitle ?? pub.series ?? 'Allternit Research',
    excerpt: pub.abstract,
    badge: BADGE_MAP[ct] ?? 'Publication',
    badgeColor: COLOR_MAP[ct] ?? '#6b7280',
    ctaLabel: CTA_MAP[ct] ?? 'Read',
    ctaAction: ct === 'course' ? 'external' : 'read',
    ctaTarget: pub.slug,
    date: (pub.publishedAt ?? pub.createdAt).slice(0, 10),
    readTime: `${pub.readingTime} min read`,
  };
}

export function getHeroPriority(pub: Publication): number {
  const TYPE_SCORE: Record<ContentType, number> = {
    annual: 100,
    index: 80,
    feature: 60,
    signal: 40,
    course: 30,
    lesson: 20,
  };

  let score = TYPE_SCORE[pub.contentType] ?? 0;

  if (pub.featured) score += 50;

  const ms = Date.now() - new Date(pub.publishedAt ?? pub.createdAt).getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - days * 4);

  return score;
}
