/**
 * Remote-control client for the Dispatch / Remote hub.
 *
 * Talks to a paired runtime through the Allternit cloud relay. In development
 * the Vite dev server can proxy these calls to a local gizzi-code instance.
 */

import {
  RemoteControlClient,
  type RemoteControlClientOptions,
  type RemoteSessionWithStatus,
  type RemoteSessionDetail,
  type RemoteControlEvent,
  type RemotePermissionRequest,
  type RemoteQuestionRequest,
  type PushSubscriptionJSON,
} from '@allternit/sdk/runtime';
import { env } from '@/lib/env';

export type {
  RemoteSessionWithStatus,
  RemoteSessionDetail,
  RemoteControlEvent,
  RemotePermissionRequest,
  RemoteQuestionRequest,
  PushSubscriptionJSON,
};

const CLOUD_API_BASE = env(
  'NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL',
  'https://api.allternit.com'
)!.replace(/\/$/, '');

const PUSH_WORKER_BASE = (
  env('VITE_REMOTE_CONTROL_PUSH_URL') || env('NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL')
)?.replace(/\/$/, '');

export interface RemoteControlInit {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  direct?: boolean;
  baseUrl?: string;
  pushBaseUrl?: string;
}

export function createRemoteControlClient(init: RemoteControlInit): RemoteControlClient {
  const opts: RemoteControlClientOptions = {
    baseUrl: init.baseUrl ?? CLOUD_API_BASE,
    runtimeId: init.direct ? undefined : init.runtimeId,
    direct: init.direct ?? false,
    getToken: init.getToken,
    pushBaseUrl: init.pushBaseUrl ?? PUSH_WORKER_BASE,
  };
  return new RemoteControlClient(opts);
}

export { RemoteControlClient };
