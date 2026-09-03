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
  type FabricSessionWithStatus,
  type FabricSessionDetail,
  type FabricSessionEvent,
  type FabricPermissionRequest,
  type FabricQuestionRequest,
  type PushSubscriptionJSON,
  type FabricLease,
} from '@allternit/sdk/runtime';
import { env } from '@/lib/env';

export type {
  FabricSessionWithStatus,
  FabricSessionDetail,
  FabricSessionEvent,
  FabricPermissionRequest,
  FabricQuestionRequest,
  PushSubscriptionJSON,
  FabricLease,
};

const CLOUD_API_BASE = env(
  'NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL',
  'https://api.allternit.com'
)!.replace(/\/$/, '');

const PUSH_WORKER_BASE = (
  env('VITE_FABRIC_SESSION_PUSH_URL') ||
  env('VITE_REMOTE_CONTROL_PUSH_URL') ||
  env('NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL')
)?.replace(/\/$/, '');

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

export function createFabricSessionClient(init: FabricSessionInit): FabricSessionClient {
  const opts: FabricSessionClientOptions = {
    baseUrl: init.baseUrl ?? CLOUD_API_BASE,
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
