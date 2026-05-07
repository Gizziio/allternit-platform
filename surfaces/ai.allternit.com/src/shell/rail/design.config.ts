import {
  Plus,
  Palette,
  ChatTeardropText,
  Question,
  DeviceMobile,
  VideoCamera,
  FileText,
  Layout,
  TreeStructure,
  GitBranch,
  Storefront,
  Rows,
  Globe,
} from '@phosphor-icons/react';
import { type RailConfigSection } from './rail.config';

export const DESIGN_RAIL_CONFIG: RailConfigSection[] = [
  // New Design — top quick action
  {
    id: 'new-design',
    title: '',
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'ds-new-design',
        label: 'New Design',
        icon: Plus,
        payload: 'design',
        isAction: true,
        shortcut: '⌘N',
      },
    ],
  },

  // Sessions — design session history (ProjectRailSection)
  {
    id: 'sessions',
    title: 'Sessions',
    icon: ChatTeardropText,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [],
  },

  // Canvas Views — in-project navigation (replaces the right-panel VIEW_ICONS strip)
  {
    id: 'canvas-views',
    title: 'Canvas',
    icon: Palette,
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'ds-view-questions',
        label: 'Discovery',
        icon: Question,
        payload: 'design-view-questions',
      },
      {
        id: 'ds-view-mobile',
        label: 'Mobile',
        icon: DeviceMobile,
        payload: 'design-view-mobile',
      },
      {
        id: 'ds-view-video',
        label: 'Video',
        icon: VideoCamera,
        payload: 'design-view-video',
      },
      {
        id: 'ds-view-docs',
        label: 'Documents',
        icon: FileText,
        payload: 'design-view-docs',
      },
      {
        id: 'ds-view-handoff',
        label: 'Handoff',
        icon: Layout,
        payload: 'design-view-handoff',
      },
      {
        id: 'ds-view-graph',
        label: 'Skill Graph',
        icon: TreeStructure,
        payload: 'design-view-graph',
      },
      {
        id: 'ds-view-pipeline',
        label: 'Pipeline',
        icon: GitBranch,
        payload: 'design-view-pipeline',
      },
      {
        id: 'ds-view-market',
        label: 'Marketplace',
        icon: Storefront,
        payload: 'design-view-market',
      },
      {
        id: 'ds-view-compare',
        label: 'Compare',
        icon: Rows,
        payload: 'design-view-compare',
      },
    ],
  },

  // Marketplace — design asset discovery
  {
    id: 'design-market',
    title: 'Marketplace',
    icon: Globe,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'ds-design-marketplace',
        label: 'Design Market',
        icon: Globe,
        payload: 'design-marketplace',
      },
    ],
  },

];
