/**
 * Browser Mode Rail Configuration
 *
 * Structure (mirrors Chat/Cowork/Code modes):
 * - New Tab (top action)
 * - Agent Hub (shared)
 * - A://Extensions (browser tools)
 * - Sessions (dynamic — browser agent sessions)
 */

import {
  Plus,
  Robot,
  PuzzlePiece,
  ChatTeardropText,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

export const BROWSER_RAIL_CONFIG: RailConfigSection[] = [
  // New Session — Top action (browser agent / computer-use session)
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

  // A://Extensions — Browser tools & addins
  {
    id: 'extensions',
    title: 'A://Extensions',
    icon: PuzzlePiece,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'br-extensions',
        label: 'A://Extensions',
        icon: PuzzlePiece,
        payload: 'browser-extensions',
      },
    ],
  },

  // Sessions — Dynamic browser agent sessions
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
