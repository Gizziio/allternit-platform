import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBotAllternitBusStore } from './bot-allternit-bus';

const mockClients = new Map<string, ReturnType<typeof createMockClient>>();

function createMockClient() {
  const state = { connected: false };
  return {
    get connected() {
      return state.connected;
    },
    connect: vi.fn(() => {
      state.connected = true;
    }),
    disconnect: vi.fn(() => {
      state.connected = false;
    }),
    send: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    broadcast: vi.fn(),
  };
}

vi.mock('@/lib/messaging/allternit-bus.service', () => ({
  createAllternitBusClient: vi.fn((config: { identity: string }) => {
    const client = createMockClient();
    mockClients.set(config.identity, client);
    return client;
  }),
}));

describe('bot-allternit-bus', () => {
  beforeEach(() => {
    mockClients.clear();
    useBotAllternitBusStore.setState({
      clients: new Map(),
      statuses: new Map(),
      lastEnvelope: new Map(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a client per bot and tracks status', () => {
    useBotAllternitBusStore.getState().connect('bot-a');
    expect(useBotAllternitBusStore.getState().clients.has('bot-a')).toBe(true);
  });

  it('disconnects and cleans up a bot client', () => {
    const store = useBotAllternitBusStore.getState();
    store.connect('bot-a');
    store.disconnect('bot-a');
    expect(store.clients.has('bot-a')).toBe(false);
    expect(store.getStatus('bot-a')).toBe('disconnected');
  });

  it('sends a message through the bot client', async () => {
    const store = useBotAllternitBusStore.getState();
    store.connect('bot-a');
    await store.send('bot-a', 'bot-b', 'handoff', { task: 'review code' });
    const client = mockClients.get('bot-a');
    expect(client?.send).toHaveBeenCalledWith('bot-b', 'handoff', { task: 'review code' });
  });
});
