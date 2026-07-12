import {
  BrowserEventSchema,
  BrowserObservationSchema,
  type ActionIntent,
  type BrowserEvent,
  type BrowserObservation,
  type BrowserProvider,
  type ProviderCapabilities,
  type ProviderKind,
} from '@allternit/computer-use-protocol';

export interface RemoteBrowserProviderOptions {
  capabilities: ProviderCapabilities;
  baseUrl: string;
  token?: string;
  fetchImpl?: FetchLike;
}

export type FetchLike = (input: URL, init: RequestInit) => Promise<Response>;

export class RemoteBrowserProvider implements BrowserProvider {
  readonly capabilities: ProviderCapabilities;
  private readonly baseUrl: URL;
  private readonly token?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: RemoteBrowserProviderOptions) {
    this.capabilities = options.capabilities;
    this.baseUrl = new URL(options.baseUrl);
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async observe(sessionId: string): Promise<BrowserObservation> {
    const payload = await this.request('POST', '/v1/browser/observe', { sessionId });
    return BrowserObservationSchema.parse(payload);
  }

  async execute(action: ActionIntent): Promise<BrowserEvent[]> {
    const payload = await this.request('POST', '/v1/browser/actions', { action });
    if (!Array.isArray(payload)) throw new Error('Remote browser provider returned a non-array action response');
    return payload.map((event) => BrowserEventSchema.parse(event));
  }

  async close(sessionId: string): Promise<void> {
    await this.request('POST', '/v1/browser/close', { sessionId });
  }

  private async request(method: string, path: string, body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Remote browser provider ${this.capabilities.provider} failed ${path}: ${response.status}`);
    }
    if (response.status === 204) return undefined;
    return response.json();
  }
}

export function createBrowserUseProvider(options: Omit<RemoteBrowserProviderOptions, 'capabilities'>): RemoteBrowserProvider {
  return new RemoteBrowserProvider({
    ...options,
    capabilities: {
      provider: 'browser-use',
      capabilities: [
        'navigate', 'observe.dom', 'observe.accessibility', 'observe.screenshot',
        'interact.pointer', 'interact.keyboard', 'tabs', 'files.download', 'record', 'replay',
      ],
      local: false,
      attachedToUserSession: false,
      supportsPrivateNetwork: false,
      supportsPersistentProfile: true,
      limits: { maxRunMs: 30 * 60_000 },
    },
  });
}

export function createStagehandProvider(options: Omit<RemoteBrowserProviderOptions, 'capabilities'>): RemoteBrowserProvider {
  return new RemoteBrowserProvider({
    ...options,
    capabilities: {
      provider: 'stagehand',
      capabilities: [
        'navigate', 'observe.dom', 'observe.accessibility', 'observe.screenshot',
        'interact.pointer', 'interact.keyboard', 'tabs', 'network.inspect', 'console.inspect',
      ],
      local: false,
      attachedToUserSession: false,
      supportsPrivateNetwork: false,
      supportsPersistentProfile: true,
      limits: { maxRunMs: 30 * 60_000 },
    },
  });
}

export interface ExtensionTabProviderOptions {
  send: (message: ExtensionTabProviderMessage) => Promise<unknown>;
}

export type ExtensionTabProviderMessage =
  | { type: 'browser.observe'; sessionId: string }
  | { type: 'browser.execute'; action: ActionIntent }
  | { type: 'browser.close'; sessionId: string };

export class ExtensionTabProvider implements BrowserProvider {
  readonly capabilities: ProviderCapabilities = {
    provider: 'extension-tab',
    capabilities: [
      'navigate', 'observe.dom', 'observe.accessibility', 'observe.screenshot',
      'interact.pointer', 'interact.keyboard', 'tabs', 'files.upload', 'files.download',
    ],
    local: true,
    attachedToUserSession: true,
    supportsPrivateNetwork: true,
    supportsPersistentProfile: true,
    limits: { maxTabs: 1, maxObservationChars: 24_000 },
  };

  private readonly send: ExtensionTabProviderOptions['send'];

  constructor(options: ExtensionTabProviderOptions) {
    this.send = options.send;
  }

  async observe(sessionId: string): Promise<BrowserObservation> {
    const payload = await this.send({ type: 'browser.observe', sessionId });
    return BrowserObservationSchema.parse(payload);
  }

  async execute(action: ActionIntent): Promise<BrowserEvent[]> {
    const payload = await this.send({ type: 'browser.execute', action });
    if (!Array.isArray(payload)) throw new Error('Extension tab provider returned a non-array action response');
    return payload.map((event) => BrowserEventSchema.parse(event));
  }

  async close(sessionId: string): Promise<void> {
    await this.send({ type: 'browser.close', sessionId });
  }
}

export function providerKind(provider: BrowserProvider): ProviderKind {
  return provider.capabilities.provider;
}
