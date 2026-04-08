import {
  useNativeAgentStore,
  type CreateSessionInput,
  type NativeSession,
} from "./native-agent.store";
import type { SessionEvent } from "./session-ledger";

function buildEvent(
  sessionId: string,
  type: SessionEvent["type"],
  payload: Record<string, unknown>,
  extras: Partial<SessionEvent> = {},
): SessionEvent {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    actor: "ui",
    type,
    payload,
    createdAt: new Date().toISOString(),
    seq: Date.now(),
    ...extras,
  };
}

export async function createCanonicalSession(
  name?: string,
  description?: string,
  options: CreateSessionInput = {},
): Promise<NativeSession> {
  const store = useNativeAgentStore.getState();
  const session = await store.createSession(name, description, options);
  const surface = options.originSurface;
  const sessionMode = options.sessionMode ?? "regular";

  store.appendOptimisticEvent(
    session.id,
    buildEvent(
      session.id,
      "session.created",
      {
        name: session.name ?? name ?? null,
        description: session.description ?? description ?? null,
      },
      {
        actor: "system",
        surface,
      },
    ),
  );

  if (surface) {
    store.appendOptimisticEvent(
      session.id,
      buildEvent(
        session.id,
        "ui.surface.changed",
        { surface },
        { surface },
      ),
    );
  }

  store.appendOptimisticEvent(
    session.id,
    buildEvent(
      session.id,
      "agent.mode.changed",
      { sessionMode },
      { surface },
    ),
  );

  if (options.agentId || options.agentName) {
    store.appendOptimisticEvent(
      session.id,
      buildEvent(
        session.id,
        "agent.profile.selected",
        {
          agentId: options.agentId ?? null,
          agentName: options.agentName ?? null,
        },
        { surface },
      ),
    );
  }

  if (options.agentFeatures) {
    store.appendOptimisticEvent(
      session.id,
      buildEvent(
        session.id,
        "agent.capabilities.changed",
        { capabilities: options.agentFeatures },
        { surface },
      ),
    );
  }

  return session;
}
