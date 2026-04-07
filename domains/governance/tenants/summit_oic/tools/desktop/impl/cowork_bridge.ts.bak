/**
 * Cowork Bridge for A2Rchitech
 * Routes visual grounding tasks to the UI-TARS-Operator on port 3008.
 */
const UI_TARS_URL = 'http://127.0.0.1:3008';

export const desktop_tools = {
  connect: async (args: { endpoint_ref: string, display_name?: string }) => {
    const res = await fetch(`${UI_TARS_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: args.endpoint_ref, display_name: args.display_name })
    });
    return await res.json(); // Returns { session_id: "...", status: "connected" }
  },

  screenshot: async (args: { session_id: string, scope: string }) => {
    const res = await fetch(`${UI_TARS_URL}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: args.session_id, scope: args.scope })
    });
    return await res.json(); // Returns { artifact_path: "...", timestamp: "..." }
  },

  click: async (args: { session_id: string, x: number, y: number, button: string }) => {
    // Policy Check: This tool is 'high risk'. The Kernel wrapper should have already 
    // verified the 'confirmed_steps' flag in the plan before calling this.
    const res = await fetch(`${UI_TARS_URL}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return await res.json();
  },

  type: async (args: { session_id: string, text: string }) => {
    const res = await fetch(`${UI_TARS_URL}/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return await res.json();
  },

  wait: async (args: { session_id: string, seconds: number }) => {
    const res = await fetch(`${UI_TARS_URL}/wait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return await res.json();
  },

  hotkey: async (args: { session_id: string, keys: string[] }) => {
    const res = await fetch(`${UI_TARS_URL}/hotkey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return await res.json();
  }
};
