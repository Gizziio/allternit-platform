/** Cowork desktop compatibility bridge through the shared platform SDK. */
import { AllternitComputerUseClient } from '@allternit/sdk/computer-use';

const ACU_URL = process.env.ACU_GATEWAY_URL ?? 'http://127.0.0.1:8760';
const computerUse = new AllternitComputerUseClient({ baseUrl: ACU_URL });

function makeRunId(): string {
  return `cb-${Math.random().toString(36).slice(2, 14)}`;
}

async function acuPost(session_id: string, action: string, extra: Record<string, unknown> = {}) {
  return computerUse.executeCompatibilityAction({
    action,
    session_id,
    run_id: makeRunId(),
    parameters: {},
    ...extra,
  });
}

function screenshotDataUrl(data: Record<string, unknown>): string {
  const content = data.extracted_content;
  if (!content || typeof content !== 'object') return '';
  const value = (content as Record<string, unknown>).data_url;
  return typeof value === 'string' ? value : '';
}

export const desktop_tools = {
  screenshot: async (args: { session_id: string; scope?: string }) => {
    const data = await acuPost(args.session_id, 'screenshot', {
      parameters: { full_page: args.scope === 'full' },
    });
    const dataUrl = screenshotDataUrl(data);
    return { artifact_path: dataUrl, timestamp: new Date().toISOString() };
  },

  click: async (args: { session_id: string; x: number; y: number; button?: string }) => {
    const action = args.button === 'right' ? 'right_click'
      : args.button === 'middle' ? 'middle_click'
      : 'left_click';
    return acuPost(args.session_id, action, { coordinate: [args.x, args.y] });
  },

  type: async (args: { session_id: string; text: string }) => {
    return acuPost(args.session_id, 'type', { text: args.text });
  },

  wait: async (args: { session_id: string; seconds: number }) => {
    return acuPost(args.session_id, 'wait', { parameters: { ms: Math.round(args.seconds * 1000) } });
  },

  hotkey: async (args: { session_id: string; keys: string[] }) => {
    return acuPost(args.session_id, 'key', { key: args.keys.join('+') });
  },
};
