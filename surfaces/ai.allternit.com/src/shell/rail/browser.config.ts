/**
 * Browser Mode Rail Configuration
 *
 * - New Session (top action)
 * - Agent Hub (shared)
 * - Add-ins & Extensions (Office, Chrome, open-source alternatives)
 * - Sessions (dynamic)
 */

import {
  Plus,
  Robot,
  PuzzlePiece,
  ChatTeardropText,
  AppWindow,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

export const BROWSER_RAIL_CONFIG: RailConfigSection[] = [
  // New Session — Top action
  {
    id: 'new-session',
    title: '',
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'br-new-session',
        label: 'New Session',
        icon: Plus,
        payload: 'browser',
        isAction: true,
      },
    ],
  },

  // Agent Hub — Shared section
  {
    id: 'agent-hub',
    title: 'Agent',
    icon: Robot,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'br-agent-hub',
        label: 'Agent Hub',
        icon: Robot,
        payload: 'agent-hub',
      },
    ],
  },

  // Mini-apps — static entry only; pinned apps injected dynamically by ShellRail
  {
    id: 'mini-apps',
    title: 'Mini-apps',
    icon: AppWindow,
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'br-mini-apps-store',
        label: 'Mini-apps Store',
        icon: AppWindow,
        payload: 'mini-apps-store',
      },
    ],
  },

  // Allternit Extensions (Office add-ins)
  {
    id: 'extensions',
    title: 'Extensions',
    icon: PuzzlePiece,
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'br-extensions-hub',
        label: 'Office & Extensions',
        icon: PuzzlePiece,
        payload: 'browser-extensions',
      },
    ],
  },

  // Sessions — Dynamic computer agent sessions
  {
    id: 'sessions',
    title: 'Sessions',
    icon: ChatTeardropText,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [],
  },
];
