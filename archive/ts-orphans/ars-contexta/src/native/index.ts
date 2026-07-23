/**
 * Native Rust/Candle bridge stub.
 * Real bindings are loaded dynamically when the native module is built.
 */

export function initNativeModule(): string {
  return 'native-stub';
}

export function getAvailableBackends(): string[] {
  return [];
}

export async function extractEntities(_requestJson: string): Promise<string> {
  return JSON.stringify({ entities: [], relations: [] });
}

export async function analyzeSentiment(_requestJson: string): Promise<string> {
  return JSON.stringify({ score: 0, label: 'neutral' });
}

export async function generateEmbeddings(_requestJson: string): Promise<string> {
  return JSON.stringify({ embeddings: [] });
}

export async function initNlpEngine(_modelsPath?: string): Promise<boolean> {
  return false;
}

export function getVersion(): string {
  return '0.0.0-stub';
}
