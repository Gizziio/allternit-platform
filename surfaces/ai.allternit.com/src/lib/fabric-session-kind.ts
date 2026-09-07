import type { FabricSession } from '@/lib/dispatch/fabric-session-client';

export type FabricDriveKind = 'chat' | 'bot' | 'code' | 'aci';

export const FABRIC_DRIVE_KINDS: Array<{
  id: FabricDriveKind;
  label: string;
  hint: string;
  surface: 'chat' | 'cowork' | 'bot' | 'code' | 'browser';
}> = [
  { id: 'chat', label: 'Chat', hint: 'Regular agent sessions', surface: 'chat' },
  { id: 'bot', label: 'Bots', hint: 'Named bots and cowork runs', surface: 'bot' },
  { id: 'code', label: 'Code', hint: 'Repo sessions with a live terminal', surface: 'code' },
  { id: 'aci', label: 'ACI', hint: 'Computer-use / browser-driven sessions', surface: 'browser' },
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

export function fabricKindSurface(kind: FabricDriveKind): 'chat' | 'cowork' | 'bot' | 'code' | 'browser' {
  return FABRIC_DRIVE_KINDS.find((entry) => entry.id === kind)?.surface ?? 'chat';
}
