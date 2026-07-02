export interface UdemyPublicCourse {
  id: number;
  title: string;
  headline: string;
  url: string;
  image_240x135: string;
  rating: number;
  num_reviews: number;
  num_subscribers: number;
  price: string;
  is_paid: boolean;
  level: string;
  lang: string;
  num_lectures: number;
  published_title: string;
  category?: string;
  topics?: string[];
}

export interface A2LabsCategory {
  id: string;
  tier: 'CORE' | 'OPS' | 'AGENTS';
  label: string;
  description: string;
  searchQueries: string[];
}

export type TierFilter = 'ALL' | 'CORE' | 'OPS' | 'AGENTS';
export type PriceFilter = 'free' | 'paid' | 'all';
export type LevelFilter = 'all' | 'Beginner' | 'Intermediate' | 'Expert';
