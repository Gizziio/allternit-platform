import type { LocalModelProvider, LocalRuntimeEngine } from "./types";

export class LocalProviderRegistry {
  private readonly providers = new Map<string, LocalModelProvider>();

  register(provider: LocalModelProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Local model provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    return () => this.providers.delete(provider.id);
  }

  replace(provider: LocalModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LocalModelProvider | undefined {
    return this.providers.get(id);
  }

  forEngine(engine: LocalRuntimeEngine): LocalModelProvider[] {
    return [...this.providers.values()].filter((provider) => provider.engine === engine);
  }

  list(): LocalModelProvider[] {
    return [...this.providers.values()];
  }
}

export const localProviderRegistry = new LocalProviderRegistry();
