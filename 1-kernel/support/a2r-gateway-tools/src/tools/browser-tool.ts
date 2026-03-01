/**
 * Browser Tool for Agents
 * Ported from OpenClaw dist/agents/tools/browser-tool.js
 * 
 * Actions:
 * - status, start, stop, profiles, tabs, open, focus, close
 * - snapshot, screenshot, navigate, console, pdf, upload, dialog, act
 */

import type { ToolResult } from '../../types/index.js';
import type { BrowserToolParams } from './browser-tool.schema.js';

export interface BrowserToolContext {
  callGatewayTool: (tool: string, params: unknown) => Promise<unknown>;
  resolveNodeId?: (nodeRef: string) => Promise<string | null>;
  sandboxBridgeUrl?: string;
  allowHostControl?: boolean;
}

const DEFAULT_BROWSER_PROXY_TIMEOUT_MS = 20_000;

export function createBrowserTool(ctx: BrowserToolContext) {
  const targetDefault = ctx.sandboxBridgeUrl ? 'sandbox' : 'host';
  const hostHint = ctx.allowHostControl === false 
    ? 'Host target blocked by policy.' 
    : 'Host target allowed.';

  return {
    name: 'browser',
    label: 'Browser',
    description: [
      'Control the browser via browser control server (status/start/stop/profiles/tabs/open/snapshot/screenshot/actions).',
      'Profiles: use profile="chrome" for Chrome extension relay takeover.',
      'Use profile="a2r" for the isolated A2R-managed browser.',
      'When using refs from snapshot (e.g. e12), keep the same tab: prefer passing targetId from the snapshot response.',
      'For stable refs across calls, use snapshot with refs="aria".',
      'Use snapshot+act for UI automation.',
      `target selects browser location (sandbox|host|node). Default: ${targetDefault}.`,
      hostHint,
    ].join(' '),

    parameters: {
      action: { type: 'string', required: true },
      target: { type: 'string', enum: ['sandbox', 'host', 'node'], optional: true },
      node: { type: 'string', optional: true },
      profile: { type: 'string', optional: true },
      targetId: { type: 'string', optional: true },
      targetUrl: { type: 'string', optional: true },
      url: { type: 'string', optional: true },
      snapshotFormat: { type: 'string', enum: ['ai', 'aria'], optional: true },
      refs: { type: 'string', enum: ['aria', 'role'], optional: true },
      mode: { type: 'string', enum: ['efficient'], optional: true },
      labels: { type: 'boolean', optional: true },
      maxChars: { type: 'number', optional: true },
      limit: { type: 'number', optional: true },
      interactive: { type: 'boolean', optional: true },
      compact: { type: 'boolean', optional: true },
      depth: { type: 'number', optional: true },
      fullPage: { type: 'boolean', optional: true },
      type: { type: 'string', enum: ['png', 'jpeg'], optional: true },
      request: { type: 'object', optional: true },
      timeoutMs: { type: 'number', optional: true },
    },

    async execute(args: BrowserToolParams): Promise<ToolResult> {
      const { action } = args;

      switch (action) {
        case 'status': {
          const result = await browserProxy(ctx, {
            method: 'GET',
            path: '/',
            profile: args.profile,
            timeoutMs: args.timeoutMs,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            details: result,
          };
        }

        case 'start': {
          const status = await browserProxy(ctx, {
            method: 'POST',
            path: '/start',
            profile: args.profile,
            timeoutMs: args.timeoutMs ?? 15000,
          });
          return {
            content: [{ type: 'text', text: 'Browser started' }],
            details: status,
          };
        }

        case 'stop': {
          const status = await browserProxy(ctx, {
            method: 'POST',
            path: '/stop',
            profile: args.profile,
            timeoutMs: args.timeoutMs ?? 15000,
          });
          return {
            content: [{ type: 'text', text: 'Browser stopped' }],
            details: status,
          };
        }

        case 'profiles': {
          const result = await browserProxy(ctx, {
            method: 'GET',
            path: '/profiles',
            timeoutMs: args.timeoutMs,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result.profiles, null, 2) }],
            details: result,
          };
        }

        case 'tabs': {
          const result = await browserProxy(ctx, {
            method: 'GET',
            path: '/tabs',
            profile: args.profile,
            timeoutMs: args.timeoutMs,
          });
          const tabs = result.tabs ?? [];
          return {
            content: [{ type: 'text', text: `Tabs: ${tabs.length}` }],
            details: { tabs },
          };
        }

        case 'open': {
          if (!args.targetUrl) {
            throw new Error('targetUrl is required for open action');
          }
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/tabs/open',
            profile: args.profile,
            body: { url: args.targetUrl },
            timeoutMs: args.timeoutMs ?? 15000,
          });
          return {
            content: [{ type: 'text', text: `Opened tab: ${result.tab?.targetId}` }],
            details: result,
          };
        }

        case 'focus': {
          if (!args.targetId) {
            throw new Error('targetId is required for focus action');
          }
          await browserProxy(ctx, {
            method: 'POST',
            path: '/tabs/focus',
            profile: args.profile,
            body: { targetId: args.targetId },
            timeoutMs: args.timeoutMs ?? 5000,
          });
          return {
            content: [{ type: 'text', text: `Focused tab: ${args.targetId}` }],
            details: { ok: true },
          };
        }

        case 'close': {
          if (args.targetId) {
            await browserProxy(ctx, {
              method: 'DELETE',
              path: `/tabs/${encodeURIComponent(args.targetId)}`,
              profile: args.profile,
              timeoutMs: args.timeoutMs ?? 5000,
            });
            return {
              content: [{ type: 'text', text: `Closed tab: ${args.targetId}` }],
              details: { ok: true },
            };
          } else {
            await browserProxy(ctx, {
              method: 'POST',
              path: '/act',
              profile: args.profile,
              body: { kind: 'close' },
              timeoutMs: args.timeoutMs ?? 5000,
            });
            return {
              content: [{ type: 'text', text: 'Closed current tab' }],
              details: { ok: true },
            };
          }
        }

        case 'snapshot': {
          const query: Record<string, string> = {
            format: args.snapshotFormat === 'aria' ? 'aria' : 'ai',
          };
          if (args.targetId) query.targetId = args.targetId;
          if (typeof args.limit === 'number') query.limit = String(args.limit);
          if (typeof args.maxChars === 'number') query.maxChars = String(args.maxChars);
          if (args.refs) query.refs = args.refs;
          if (typeof args.interactive === 'boolean') query.interactive = String(args.interactive);
          if (typeof args.compact === 'boolean') query.compact = String(args.compact);
          if (typeof args.depth === 'number') query.depth = String(args.depth);
          if (args.mode) query.mode = args.mode;
          if (args.labels) query.labels = 'true';

          const result = await browserProxy(ctx, {
            method: 'GET',
            path: '/snapshot',
            query,
            profile: args.profile,
            timeoutMs: args.timeoutMs ?? 20000,
          });

          if (result.format === 'ai') {
            if (args.labels && result.imagePath) {
              return {
                content: [
                  { type: 'image_url', image_url: { url: result.imagePath } },
                  { type: 'text', text: result.snapshot },
                ],
                details: result,
              };
            }
            return {
              content: [{ type: 'text', text: result.snapshot }],
              details: result,
            };
          }

          return {
            content: [{ type: 'text', text: result.snapshot }],
            details: result,
          };
        }

        case 'screenshot': {
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/screenshot',
            profile: args.profile,
            body: {
              targetId: args.targetId,
              fullPage: args.fullPage,
              ref: args.ref,
              element: args.element,
              type: args.type ?? 'png',
            },
            timeoutMs: args.timeoutMs ?? 20000,
          });

          return {
            content: [
              { type: 'image_url', image_url: { url: result.path } },
            ],
            details: result,
          };
        }

        case 'start_recording': {
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/recording/start',
            profile: args.profile,
            body: {
              targetId: args.targetId,
              format: args.format ?? 'gif',
              fps: args.fps ?? 10,
              quality: args.quality ?? 80,
              maxDurationSecs: args.maxDurationSecs,
            },
            timeoutMs: args.timeoutMs ?? 10000,
          });

          return {
            content: [
              { type: 'text', text: `Recording started: ${result.recordingId}` },
            ],
            details: result,
          };
        }

        case 'stop_recording': {
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/recording/stop',
            profile: args.profile,
            body: {
              recordingId: args.recordingId,
              save: args.save ?? true,
            },
            timeoutMs: args.timeoutMs ?? 60000,
          });

          return {
            content: [
              { type: 'text', text: `Recording saved: ${result.filePath}` },
              { type: 'image_url', image_url: { url: result.filePath } },
            ],
            details: result,
          };
        }

        case 'recording_status': {
          const result = await browserProxy(ctx, {
            method: 'GET',
            path: `/recording/${args.recordingId}/status`,
            profile: args.profile,
            timeoutMs: args.timeoutMs ?? 5000,
          });

          return {
            content: [
              { type: 'text', text: `Recording ${result.status}: ${result.framesCaptured} frames` },
            ],
            details: result,
          };
        }

        case 'navigate': {
          if (!args.targetUrl) {
            throw new Error('targetUrl is required for navigate action');
          }
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/navigate',
            profile: args.profile,
            body: { url: args.targetUrl, targetId: args.targetId },
            timeoutMs: args.timeoutMs ?? 15000,
          });
          return {
            content: [{ type: 'text', text: `Navigated to ${args.targetUrl}` }],
            details: result,
          };
        }

        case 'act': {
          if (!args.request || typeof args.request !== 'object') {
            throw new Error('request is required for act action');
          }
          const result = await browserProxy(ctx, {
            method: 'POST',
            path: '/act',
            profile: args.profile,
            body: args.request,
            timeoutMs: args.timeoutMs ?? 20000,
          });
          return {
            content: [{ type: 'text', text: `Action performed: ${args.request.kind}` }],
            details: result,
          };
        }

        default:
          throw new Error(`Unknown browser action: ${action}`);
      }
    },
  };
}

interface ProxyParams {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  profile?: string;
  timeoutMs?: number;
}

async function browserProxy(ctx: BrowserToolContext, params: ProxyParams): Promise<any> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_BROWSER_PROXY_TIMEOUT_MS;

  const result = await ctx.callGatewayTool('browser.proxy', {
    method: params.method,
    path: params.path,
    query: params.query,
    body: params.body,
    timeoutMs,
    profile: params.profile,
  });

  const parsed = (result as any)?.payload;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Browser proxy failed');
  }

  return parsed;
}
