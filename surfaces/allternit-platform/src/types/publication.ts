export type PublicationType =
  | 'paper'
  | 'report'
  | 'blog'
  | 'economic'
  | 'safety'
  | 'course'
  | 'lesson';

export type ContentType =
  | 'signal'
  | 'feature'
  | 'index'
  | 'annual'
  | 'course'
  | 'lesson';

export type PublicationStatus = 'draft' | 'published' | 'archived';

export interface Publication {
  id: string;
  slug: string;
  type: PublicationType;
  contentType: ContentType;
  status: PublicationStatus;
  title: string;
  subtitle?: string;
  abstract: string;
  authors: string[];
  teams: string[];
  tags: string[];
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  content: {
    markdown?: string;
    html?: string;
    pdfUrl?: string;
  };
  readingTime: number;
  featured?: boolean;
  series?: string;
  issueNumber?: string;
  metrics: {
    views: number;
    uniqueVisitors: number;
    downloads: number;
    citationCount: number;
  };
  license: string;
  accessLevel: 'public' | 'registered' | 'restricted';
}
