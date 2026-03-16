/**
 * OpenClaw parity contract derived from vendor snapshot docs/dist.
 * Source references:
 * - 3-adapters/vendor-integration/vendor/openclaw/docs/web/control-ui.md
 * - 3-adapters/vendor-integration/vendor/openclaw/dist/control-ui/assets/index-*.js
 */

export const OPENCLAW_VENDOR_VERSION = '2026.1.29';

export const OPENCLAW_PARITY_ROUTES = [
  'chat',
  'overview',
  'channels',
  'instances',
  'sessions',
  'cron',
  'skills',
  'nodes',
  'config',
  'debug',
  'logs',
] as const;

export const OPENCLAW_PARITY_RPC_METHODS = [
  'chat.history',
  'chat.send',
  'chat.abort',
  'chat.inject',
  'channels.status',
  'web.login.start',
  'sessions.list',
  'sessions.patch',
  'sessions.delete',
  'cron.list',
  'cron.add',
  'cron.update',
  'cron.run',
  'cron.remove',
  'skills.list',
  'skills.status',
  'skills.update',
  'skills.install',
  'node.list',
  'exec.approvals.get',
  'exec.approvals.set',
  'config.get',
  'config.set',
  'config.apply',
  'config.schema',
  'logs.tail',
  'update.run',
] as const;

/**
 * DAG critical-path milestones for native A2R parity execution.
 * Kept in-code so UI/backend work can validate against a single source.
 */
export const OPENCLAW_PARITY_CRITICAL_PATH = [
  'N0_contract',
  'N1_agent_transport_split',
  'N2_agent_session_domain',
  'N3_agent_studio_model_binding',
  'N4_mode_differentiation_ux',
  'N5_agent_presence_animation',
  'N6_native_action_parity',
  'N7_parity_validation_gate',
] as const;
