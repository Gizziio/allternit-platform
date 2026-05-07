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
  MicrosoftWordLogo,
  MicrosoftExcelLogo,
  FilePpt,
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

  // Allternit Extensions
  {
    id: 'extensions',
    title: 'Extensions',
    icon: PuzzlePiece,
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'br-addin-word',
        label: 'Word',
        icon: MicrosoftWordLogo,
        payload: 'browser-extensions',
      },
      {
        id: 'br-addin-excel',
        label: 'Excel',
        icon: MicrosoftExcelLogo,
        payload: 'browser-extensions',
      },
      {
        id: 'br-addin-ppt',
        label: 'PowerPoint',
        icon: FilePpt,
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
