/**
 * Fabric Session client for the Dispatch / Remote hub.
 *
 * Talks to a paired runtime through the Allternit cloud relay using the
 * capability-native session-worker path. In development the Vite dev server can
 * proxy these calls to a local gizzi-code instance.
 */

import {
  FabricSessionClient,
  WebPushClient,
  type FabricSessionClientOptions,
  type WebPushClientOptions,
  type FabricSession,
  type FabricSessionWithStatus,
  type FabricSessionDetail,
  type FabricSessionEvent,
  type FabricPermissionRequest,
  type FabricQuestionRequest,
  type PushSubscriptionJSON,
  type FabricLease,
  type FabricBrain,
  type FabricBrainModel,
  type FabricModelRef,
  type FabricBot,
  type FabricAciRun,
  type FabricAciFrame,
} from '@allternit/sdk/runtime';
import { env } from '@/lib/env';
import { resolveOperatorGatewayUrl, isLoopbackUrl } from '@/lib/operator-gateway';
import { isFabricSessionPwaHost } from '@/lib/fabric-session-pwa';

export type {
  FabricSession,
  FabricSessionWithStatus,
  FabricSessionDetail,
  FabricSessionEvent,
  FabricPermissionRequest,
  FabricQuestionRequest,
  PushSubscriptionJSON,
  FabricLease,
  FabricBrain,
  FabricBrainModel,
  FabricModelRef,
  FabricBot,
  FabricAciRun,
  FabricAciFrame,
};

const CLOUD_API_BASE = env(
  'NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL',
  'https://api.allternit.com'
)!.replace(/\/$/, '');

const PUSH_WORKER_BASE = (
  env('VITE_FABRIC_SESSION_PUSH_URL') ||
  env('VITE_REMOTE_CONTROL_PUSH_URL') ||
  env('NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL') ||
  'https://push.fabrictransport.allternit.com'
).replace(/\/$/, '');

export interface FabricSessionInit {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  direct?: boolean;
  baseUrl?: string;
}

export interface WebPushInit {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  baseUrl?: string;
  pushBaseUrl?: string;
}

function defaultFabricSessionBaseUrl(): string {
  if (typeof window === 'undefined') return CLOUD_API_BASE;
  const isDesktop = Boolean(window.allternit || window.allternitSidecar);
  const origin = window.location.origin;
  if (isDesktop || isLoopbackUrl(origin)) {
    return resolveOperatorGatewayUrl({
      windowUrl: (window as unknown as { __ALLTERNIT_GATEWAY_URL__?: string }).__ALLTERNIT_GATEWAY_URL__,
      locationOrigin: origin,
      isDesktop,
      fallback: 'http://127.0.0.1:8013',
    });
  }
  if (isFabricSessionPwaHost(window.location.hostname)) {
    return origin;
  }
  return CLOUD_API_BASE;
}

/**
 * Operator client for Fabric Transport. A signed-in human (PWA) and a bot
 * that holds the same Clerk bearer use this. They are not nodes — they drive
 * paired runtimes through the cloud relay.
 */
export function createFabricOperator(init: FabricSessionInit): FabricSessionClient {
  return createFabricSessionClient(init);
}

export function createFabricSessionClient(init: FabricSessionInit): FabricSessionClient {
  const opts: FabricSessionClientOptions = {
    baseUrl: init.baseUrl ?? defaultFabricSessionBaseUrl(),
    runtimeId: init.direct ? undefined : init.runtimeId,
    direct: init.direct ?? false,
    getToken: init.getToken,
  };
  return new FabricSessionClient(opts);
}

export function createWebPushClient(init: WebPushInit): WebPushClient {
  const opts: WebPushClientOptions = {
    baseUrl: init.pushBaseUrl ?? PUSH_WORKER_BASE ?? (init.baseUrl || CLOUD_API_BASE),
    runtimeId: init.runtimeId,
    getToken: init.getToken,
  };
  return new WebPushClient(opts);
}

export { FabricSessionClient, WebPushClient };
