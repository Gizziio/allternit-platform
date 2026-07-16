export * from "./types";
export * from "./catalog";
export * from "./loopback";
export * from "./provider-registry";
export * from "./router";
export * from "./providers/ollama";
export * from "./providers/browser-webgpu";
export * from "./providers/bonsai-webgpu";
export * from "./providers/bonsai-owned-webgpu";

import { localProviderRegistry } from "./provider-registry";
import { BrowserWebGpuProvider } from "./providers/browser-webgpu";
import { bonsaiWebGpuProvider } from "./providers/bonsai-webgpu";
import { bonsaiOwnedWebGpuProvider } from "./providers/bonsai-owned-webgpu";
import { OllamaLocalProvider, type OllamaProviderOptions } from "./providers/ollama";

let defaultsRegistered = false;

export function registerDefaultLocalProviders(options: { ollama?: OllamaProviderOptions } = {}) {
  if (!defaultsRegistered) {
    localProviderRegistry.register(new OllamaLocalProvider(options.ollama));
    localProviderRegistry.register(new BrowserWebGpuProvider());
    localProviderRegistry.register(bonsaiWebGpuProvider);
    localProviderRegistry.register(bonsaiOwnedWebGpuProvider);
    defaultsRegistered = true;
  }
  return localProviderRegistry;
}
