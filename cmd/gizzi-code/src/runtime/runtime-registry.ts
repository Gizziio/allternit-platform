import type { DiscoveredRuntime, DiscoveredCli } from './runtime-discovery';

export interface RegisteredRuntime {
  id: string;
  name: string;
  host: string;
  agentClis: DiscoveredCli[];
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: number;
  registeredAt: number;
  workspaceId?: string;
}

class RuntimeRegistry {
  private runtimes = new Map<string, RegisteredRuntime>();

  register(name: string, runtime: DiscoveredRuntime, workspaceId?: string): RegisteredRuntime {
    const id = `rt-${runtime.host}-${Date.now()}`;
    const entry: RegisteredRuntime = {
      id,
      name,
      host: runtime.host,
      agentClis: runtime.agentClis,
      status: 'online',
      lastHeartbeat: Date.now(),
      registeredAt: Date.now(),
      workspaceId,
    };
    this.runtimes.set(id, entry);
    return entry;
  }

  upsertByHost(name: string, runtime: DiscoveredRuntime): RegisteredRuntime {
    const existing = this.getByHost(runtime.host);
    if (existing) {
      const updated = {
        ...existing,
        agentClis: runtime.agentClis,
        status: 'online' as const,
        lastHeartbeat: Date.now(),
      };
      this.runtimes.set(existing.id, updated);
      return updated;
    }
    return this.register(name, runtime);
  }

  getByHost(host: string): RegisteredRuntime | undefined {
    return Array.from(this.runtimes.values()).find((r) => r.host === host);
  }

  getById(id: string): RegisteredRuntime | undefined {
    return this.runtimes.get(id);
  }

  list(): RegisteredRuntime[] {
    return Array.from(this.runtimes.values());
  }

  remove(id: string): boolean {
    return this.runtimes.delete(id);
  }

  markOffline(id: string): void {
    const r = this.runtimes.get(id);
    if (r) this.runtimes.set(id, { ...r, status: 'offline' });
  }

  heartbeat(id: string): void {
    const r = this.runtimes.get(id);
    if (r) this.runtimes.set(id, { ...r, lastHeartbeat: Date.now(), status: 'online' });
  }
}

export const runtimeRegistry = new RuntimeRegistry();
