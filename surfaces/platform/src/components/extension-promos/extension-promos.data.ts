/**
 * Extension Promo Content
 *
 * One entry per extension. The `visual` field is an image path / import
 * that the consumer provides — drop a screenshot or product shot there.
 * Rotate these on the login screen and platform dashboard.
 */

export interface ExtensionPromo {
  /** Unique stable id used as React key and for carousel tracking */
  id: string
  /** Badge text shown above the headline ("NEW", "UPDATED", etc.) */
  badge?: string
  /** Accent color for the right panel background and badge */
  accentColor: string
  /** Darker shade used for button ring and hover states */
  accentDark: string
  /** Short display name of the extension */
  extensionName: string
  /** Bold headline — keep to 3–5 words */
  headline: string
  /** 2–3 bullet points */
  bullets: string[]
  /** Primary CTA label */
  ctaLabel: string
  /** Where the CTA navigates (can be overridden by the consumer) */
  ctaHref: string
  /**
   * Path to the product screenshot shown in the right panel.
   * Import the image and pass it here, e.g.:
   *   import excelShot from '@/assets/promos/excel.png'
   */
  visual: string
  /** Alt text for the visual */
  visualAlt: string
}

export const EXTENSION_PROMOS: ExtensionPromo[] = [
  {
    id: 'excel',
    badge: 'NEW',
    accentColor: '#217346',
    accentDark: '#185C38',
    extensionName: 'Excel',
    headline: 'Supercharge your spreadsheets with Allternit',
    bullets: [
      'Build financial models, analyze data, and create charts directly in Excel',
      'Transform complex formulas and messy data into simple conversations',
      'Generate pivot tables, dashboards, and DCF models in seconds',
    ],
    ctaLabel: 'Get Allternit for Excel',
    ctaHref: '/extensions/excel',
    visual: '/assets/promos/excel-preview.svg',
    visualAlt: 'Allternit running inside Microsoft Excel',
  },
  {
    id: 'word',
    badge: 'NEW',
    accentColor: '#2B579A',
    accentDark: '#1E3F72',
    extensionName: 'Word',
    headline: 'Write and edit documents with AI in Word',
    bullets: [
      'Rewrite, improve, and redline documents with tracked changes',
      'Summarize contracts, generate reports, and fill templates instantly',
      'Apply consistent structure and heading hierarchy across any document',
    ],
    ctaLabel: 'Get Allternit for Word',
    ctaHref: '/extensions/word',
    visual: '/assets/promos/word-preview.svg',
    visualAlt: 'Allternit running inside Microsoft Word',
  },
  {
    id: 'powerpoint',
    badge: 'NEW',
    accentColor: '#C43E1C',
    accentDark: '#A33317',
    extensionName: 'PowerPoint',
    headline: 'Create stunning decks with AI in PowerPoint',
    bullets: [
      'Generate full presentation outlines and populate slides automatically',
      'Rewrite slide content, apply design themes, and write speaker notes',
      'Turn raw data into compelling, on-brand presentation slides',
    ],
    ctaLabel: 'Get Allternit for PowerPoint',
    ctaHref: '/extensions/powerpoint',
    visual: '/assets/promos/powerpoint-preview.svg',
    visualAlt: 'Allternit running inside Microsoft PowerPoint',
  },
  {
    id: 'chrome',
    badge: 'NEW',
    accentColor: '#B08D6E',
    accentDark: '#8C6D52',
    extensionName: 'Chrome',
    headline: 'Bring Allternit to every page you visit',
    bullets: [
      'Summarize, extract, and interact with any web page using AI',
      'Research faster with instant page context and inline AI answers',
      'Automate repetitive browser tasks without leaving the page',
    ],
    ctaLabel: 'Get the Chrome Extension',
    ctaHref: '/extensions/chrome',
    visual: '/assets/promos/chrome-preview.svg',
    visualAlt: 'Allternit Chrome extension in the browser',
  },
]
