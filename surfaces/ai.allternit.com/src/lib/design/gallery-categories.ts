/**
 * Gallery category mapping for bundled design skills. Feeds the P0
 * use-case gallery (mapping doc §6): each bundled skill id resolves to a
 * gallery category, a display label, and the closest Kimi use-case category.
 */

export type GalleryCategoryId =
  | 'posters'
  | 'infographics'
  | 'social'
  | 'product'
  | 'education'
  | 'science'
  | 'art'
  | 'decks'
  | 'dashboards'
  | 'landing-pages'
  | 'mobile'
  | 'brand-systems'
  | 'docs'
  | 'email'
  | 'personal';

export interface GalleryCategory {
  category: GalleryCategoryId;
  label: string;
  kimiCategory: string;
}

export const GALLERY_CATEGORIES: Record<string, GalleryCategory> = {
  // First-party A:// Studio skills (skills/<id>-skill/SKILL.md)
  poster: { category: 'posters', label: 'Posters', kimiCategory: 'Visual posters' },
  infographic: { category: 'infographics', label: 'Infographics', kimiCategory: 'Infographics' },
  'social-creative': { category: 'social', label: 'Social', kimiCategory: 'Social media' },
  'product-launch': { category: 'product', label: 'Product', kimiCategory: 'Product shots' },
  'edu-visual': { category: 'education', label: 'Education', kimiCategory: 'Education' },
  'scientific-figure': { category: 'science', label: 'Science', kimiCategory: 'Research & science' },
  'generative-art': { category: 'art', label: 'Art', kimiCategory: 'Illustrations & art' },
  'pitch-deck': { category: 'decks', label: 'Decks', kimiCategory: 'Presentations' },
  'email-newsletter': { category: 'email', label: 'Email', kimiCategory: 'Email' },
  'personal-site': { category: 'personal', label: 'Personal', kimiCategory: 'Professions' },
  'saas-landing': { category: 'landing-pages', label: 'Landing pages', kimiCategory: 'Webpages' },
  dashboard: { category: 'dashboards', label: 'Dashboards', kimiCategory: 'Dashboards' },
  'magazine-deck': { category: 'decks', label: 'Decks', kimiCategory: 'Presentations' },
  'design-system-from-brief': { category: 'brand-systems', label: 'Brand systems', kimiCategory: 'Brand systems' },
  'mobile-app': { category: 'mobile', label: 'Mobile', kimiCategory: 'Mobile apps' },
  // Vendored open-design example plugins (plugins/examples/)
  'docs-page': { category: 'docs', label: 'Docs', kimiCategory: 'Documents' },
  'blog-post': { category: 'docs', label: 'Docs', kimiCategory: 'Content' },
  'data-report': { category: 'docs', label: 'Docs', kimiCategory: 'Content' },
  'html-ppt-zhangzara-cartesian': { category: 'decks', label: 'Decks', kimiCategory: 'Presentations' },
};

export function getGalleryCategory(skillId: string): GalleryCategory | undefined {
  return GALLERY_CATEGORIES[skillId];
}
