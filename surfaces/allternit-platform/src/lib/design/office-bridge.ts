/**
 * Allternit Studio <-> Office Add-in Bridge
 * 
 * This file bridges the specialized Office logic from surfaces/allternit-extensions/allternit-office-addin
 * into the native Allternit Studio workspace.
 */

// Native manifests from the Office Add-in project
export const OFFICE_HOSTS = {
  EXCEL: {
    id: 'excel',
    label: 'Excel',
    commands: [
      { id: 'excel:analyze', label: 'Analyze Sheet', icon: 'ChartLine' },
      { id: 'excel:model', label: 'Build DCF Model', icon: 'Calculator' },
      { id: 'excel:chart', label: 'Generate Charts', icon: 'ChartBar' },
      { id: 'excel:clean', label: 'Clean Data', icon: 'Broom' }
    ],
    skills: ['range-operations', 'formula-generation', 'financial-modeling']
  },
  POWERPOINT: {
    id: 'powerpoint',
    label: 'Slides',
    commands: [
      { id: 'ppt:outline', label: 'Generate Deck', icon: 'Layout' },
      { id: 'ppt:design', label: 'Apply Brand DNA', icon: 'Palette' },
      { id: 'ppt:rewrite', label: 'Rewrite Slide', icon: 'Pencil' }
    ],
    skills: ['slide-operations', 'shape-text', 'slide-design']
  },
  WORD: {
    id: 'word',
    label: 'Word',
    commands: [
      { id: 'word:rewrite', label: 'Professional Rewrite', icon: 'TextT' },
      { id: 'word:redline', label: 'Review & Redline', icon: 'Pen' },
      { id: 'word:structure', label: 'Reorganize Doc', icon: 'List' }
    ],
    skills: ['body-text', 'tracked-changes', 'formatting']
  }
};

export type OfficeHostType = keyof typeof OFFICE_HOSTS;
