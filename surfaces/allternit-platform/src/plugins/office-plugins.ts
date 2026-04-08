/**
 * Office Add-in Feature Plugins
 *
 * Registers the Excel, PowerPoint, and Word Office add-in plugins
 * into the platform feature registry. These plugins appear in the
 * plugin marketplace / shell but are activated within the Office
 * task pane (allternit-office-addin surface), not in the platform shell.
 */

import type { FeaturePlugin } from './feature.types';

const OFFICE_BASE_TAGS = ['office', 'microsoft', 'office-addin', 'ai-automation'];

export const OFFICE_PLUGIN_EXCEL: FeaturePlugin = {
  id: 'allternit-office-excel',
  name: 'Allternit for Excel',
  version: '1.0.0',
  description:
    'AI-powered Excel automation — formulas, charts, tables, financial modeling, and data validation. Generates and executes Office.js code directly in the workbook.',
  icon: 'Table',
  category: 'productivity',
  author: 'Allternit',
  accentColor: '#217346', // Excel green
  views: [],
  enabledByDefault: false,
  builtin: false,
  tags: [...OFFICE_BASE_TAGS, 'excel', 'spreadsheet', 'formulas', 'charts', 'financial-modeling'],
};

export const OFFICE_PLUGIN_POWERPOINT: FeaturePlugin = {
  id: 'allternit-office-powerpoint',
  name: 'Allternit for PowerPoint',
  version: '1.0.0',
  description:
    'AI-powered slide creation, deck design, content generation and presentation automation. Generates and executes Office.js code directly in the presentation.',
  icon: 'Presentation',
  category: 'productivity',
  author: 'Allternit',
  accentColor: '#D24726', // PowerPoint orange-red
  views: [],
  enabledByDefault: false,
  builtin: false,
  tags: [...OFFICE_BASE_TAGS, 'powerpoint', 'slides', 'presentations', 'deck'],
};

export const OFFICE_PLUGIN_WORD: FeaturePlugin = {
  id: 'allternit-office-word',
  name: 'Allternit for Word',
  version: '1.0.0',
  description:
    'AI-powered document drafting, editing, redlining, style application and structured content. Generates and executes Office.js code directly in the document.',
  icon: 'FileText',
  category: 'productivity',
  author: 'Allternit',
  accentColor: '#2B579A', // Word blue
  views: [],
  enabledByDefault: false,
  builtin: false,
  tags: [...OFFICE_BASE_TAGS, 'word', 'documents', 'writing', 'redline', 'tracked-changes'],
};

export const OFFICE_PLUGINS: FeaturePlugin[] = [
  OFFICE_PLUGIN_EXCEL,
  OFFICE_PLUGIN_POWERPOINT,
  OFFICE_PLUGIN_WORD,
];
