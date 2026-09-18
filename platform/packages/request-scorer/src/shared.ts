// Inlined from manifest-shared — no external dependency needed
export const TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;
export type Tier = (typeof TIERS)[number];

export const SPECIFICITY_CATEGORIES = [
  'coding',
  'web_browsing',
  'data_analysis',
  'image_generation',
  'video_generation',
  'social_media',
  'email_management',
  'calendar_management',
  'trading',
] as const;
export type SpecificityCategory = (typeof SPECIFICITY_CATEGORIES)[number];
