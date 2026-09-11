import type { FabricSession } from '@/lib/dispatch/fabric-session-client';
import type { AppMode } from '@/shell/ShellHeader';

export type FabricDriveKind = 'chat' | 'bot' | 'code' | 'aci' | 'desktop';

export const FABRIC_DRIVE_KINDS: Array<{
  id: FabricDriveKind;
  label: string;
  hint: string;
  surface: 'chat' | 'cowork' | 'bot' | 'code' | 'browser' | 'desktop';
}> = [
  { id: 'chat', label: 'Chat', hint: 'Regular agent sessions', surface: 'chat' },
  { id: 'bot', label: 'Bots', hint: 'Named bots and cowork runs', surface: 'bot' },
  { id: 'code', label: 'Code', hint: 'Repo sessions with a live terminal', surface: 'code' },
  { id: 'aci', label: 'ACI', hint: 'Computer-use / browser-driven sessions', surface: 'browser' },
  { id: 'desktop', label: 'Desktop', hint: 'Live display of this machine — view and control', surface: 'desktop' },
];

export function fabricSessionKind(session: Pick<FabricSession, 'surface' | 'agentID' | 'title' | 'directory'>): FabricDriveKind {
  const surface = String(session.surface || '').toLowerCase();
  const agent = String(session.agentID || '').toLowerCase();
  const title = String(session.title || '').toLowerCase();
  const directory = String(session.directory || '').toLowerCase();

  if (
    surface === 'code'
    || title.includes('code mode')
    || title.includes('gizzi')
    || title.startsWith('cli-')
    || title.includes('cli-')
    || agent.includes('gizzi')
    || directory.includes('/code')
  ) {
    return 'code';
  }
  if (
    surface === 'browser'
    || surface === 'aci'
    || agent.includes('aci')
    || title.includes('aci')
    || title.includes('computer use')
    || title.includes('computer-use')
  ) {
    return 'aci';
  }
  if (
    surface === 'bot'
    || surface === 'cowork'
    || agent.startsWith('bot')
    || agent.includes('bot-')
    || title.includes('bot ')
    || title.startsWith('bot')
  ) {
    return 'bot';
  }
  return 'chat';
}

export function fabricKindSurface(kind: FabricDriveKind): 'chat' | 'cowork' | 'bot' | 'code' | 'browser' | 'desktop' {
  return FABRIC_DRIVE_KINDS.find((entry) => entry.id === kind)?.surface ?? 'chat';
}

/**
 * Map a fabric drive kind to the platform app mode so desktop views mounted
 * in the fabric session surface (bot launchpad/chat, ACI viewport) see the
 * same mode the desktop shell would set — e.g. the composer dock highlights
 * Bots when the Bots rail is active, not Chat.
 */
export function fabricKindAppMode(kind: FabricDriveKind): AppMode {
  switch (kind) {
    case 'bot':
      return 'bot';
    case 'code':
      return 'code';
    case 'aci':
    case 'desktop':
      return 'browser';
    case 'chat':
    default:
      return 'chat';
  }
}

/** Reverse of {@link fabricKindAppMode} for `allternit:switch-mode` events. */
export function fabricAppModeKind(mode: string): FabricDriveKind | null {
  switch (mode) {
    case 'bot':
      return 'bot';
    case 'code':
      return 'code';
    case 'browser':
      return 'aci';
    case 'chat':
    case 'cowork':
      // Fabric has no cowork kind; cowork sessions surface as chat.
      return 'chat';
    default:
      return null;
  }
}
