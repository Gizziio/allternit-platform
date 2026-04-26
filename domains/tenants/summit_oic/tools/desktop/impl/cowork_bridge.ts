/**
 * Cowork Bridge for Allternit
 * Routes desktop automation tasks to the ACU gateway (port 8760).
 */
const ACU_URL = process.env.ACU_GATEWAY_URL ?? 'http://127.0.0.1:8760';

function makeRunId(): string {
  return `cb-${Math.random().toString(36).slice(2, 14)}`;
}

async function acuPost(session_id: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${ACU_URL}/v1/computer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, session_id, run_id: makeRunId(), parameters: {}, ...extra }),
  });
  if (!res.ok) throw new Error(`ACU ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json();
}

export const desktop_tools = {
  screenshot: async (args: { session_id: string; scope?: string }) => {
    const data = await acuPost(args.session_id, 'screenshot', {
      parameters: { full_page: args.scope === 'full' },
    });
    const dataUrl: string = data.extracted_content?.data_url ?? '';
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
