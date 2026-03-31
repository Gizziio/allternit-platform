export interface GatewaySession {
  id: string;
  agentId: string;
  createdAt: number;
}

export class GatewayAdapter {
  private sessions: Map<string, GatewaySession> = new Map();

  createSession(agentId: string): GatewaySession {
    const session: GatewaySession = {
      id: Math.random().toString(36).substring(2),
      agentId,
      createdAt: Date.now()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): GatewaySession | undefined {
    return this.sessions.get(id);
  }

  closeSession(id: string): void {
    this.sessions.delete(id);
  }
}
