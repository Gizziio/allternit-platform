/**
 * Rust Bridge for Local NLP
 * GAP-79: NLP Entity Extraction
 * 
 * WIH: GAP-79, Owner: T3-A1
 * 
 * Provides TypeScript-to-Rust bridge for:
 * - rust-bert: Ready-to-use transformer models
 * - candle: Lightweight ML framework
 * 
 * Native modules loaded dynamically when available.
 */

import type {
  Entity,
  EntityType,
  EntityRelation,
  ExtractionResult,
  EntitySpan,
  RustBridgeConfig,
} from './types.js';

// Native module interface
interface NativeNlpModule {
  initNativeModule: () => string;
  getAvailableBackends: () => string[];
  extractEntities: (requestJson: string) => Promise<string>;
  analyzeSentiment: (requestJson: string) => Promise<string>;
  generateEmbeddings: (requestJson: string) => Promise<string>;
  initNlpEngine: (modelsPath?: string) => Promise<boolean>;
  getVersion: () => string;
}

// Dynamic native module loader
let nativeModule: NativeNlpModule | null = null;

async function loadNativeModule(): Promise<NativeNlpModule | null> {
  if (nativeModule) return nativeModule;
  
  try {
    // Try to load the native module
    const mod = await import('../../native/index.js');
    nativeModule = mod as NativeNlpModule;
    console.log('[RustBridge] Native module loaded:', nativeModule.initNativeModule());
    return nativeModule;
  } catch (e) {
    console.warn('[RustBridge] Native module not available, using stub implementations');
    return null;
  }
}

/**
 * Bridge status
 */
export interface BridgeStatus {
  rustBertAvailable: boolean;
  candleAvailable: boolean;
  loadedModels: string[];
  lastError?: string;
}

/**
 * Rust bridge for NLP operations
 */
export class RustBridge {
  private config: RustBridgeConfig;
  private status: BridgeStatus = {
    rustBertAvailable: false,
    candleAvailable: false,
    loadedModels: [],
  };
  private native: NativeNlpModule | null = null;

  constructor(config: RustBridgeConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize native modules
   */
  private async initialize(): Promise<void> {
    // Try to load native module
    this.native = await loadNativeModule();
    
    if (this.native) {
      const backends = this.native.getAvailableBackends();
      this.status.rustBertAvailable = backends.includes('rust-bert');
      this.status.candleAvailable = backends.includes('candle');
      
      // Initialize NLP engine
      try {
        await this.native.initNlpEngine(this.config.modelCacheDir);
        console.log('[RustBridge] NLP engine initialized');
      } catch (e) {
        console.warn('[RustBridge] Failed to initialize NLP engine:', e);
      }
    } else {
      console.warn('[RustBridge] Native modules not available. Run `npm run build` in native/ to compile.');
      this.status.lastError = 'Native modules not built. Run build script to compile.';
    }
  }

  /**
   * Get current bridge status
   */
  getStatus(): BridgeStatus {
    return { ...this.status };
  }

  /**
   * Check if rust-bert is available
   */
  isRustBertAvailable(): boolean {
    return this.status.rustBertAvailable;
  }

  /**
   * Check if candle is available
   */
  isCandleAvailable(): boolean {
    return this.status.candleAvailable;
  }

  /**
   * Perform NER using rust-bert
   */
  async nerWithRustBert(
    text: string,
    modelName = 'dslim/bert-base-NER'
  ): Promise<Entity[]> {
    if (!this.native || !this.status.rustBertAvailable) {
      throw new Error('rust-bert not available. Native module not loaded.');
    }

    const request = { text, model: modelName, min_confidence: 0.7 };
    const response = await this.native.extractEntities(JSON.stringify(request));
    const result = JSON.parse(response);
    
    return result.entities.map((e: any) => ({
      id: `ner_${e.label}_${e.start}`,
      text: e.text,
      type: mapBertLabelToEntityType(e.label),
      startPos: e.start,
      endPos: e.end,
      confidence: e.score,
      normalizedForm: e.text,
    }));
  }

  /**
   * Perform NER using candle
   * STUBBED - Requires native module
   */
  async nerWithCandle(
    text: string,
    modelPath?: string
  ): Promise<Entity[]> {
    if (!this.status.candleAvailable) {
      throw new Error('candle not available. Native module not loaded.');
    }

    // STUBBED - Would call candle native function
    console.warn(`[RustBridge] Candle NER stubbed. Would use model: ${modelPath ?? 'default'}`);
    
    return [];
  }

  /**
   * Get embeddings using rust-bert
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.native || !this.status.rustBertAvailable) {
      throw new Error('rust-bert not available');
    }

    const request = { texts };
    const response = await this.native.generateEmbeddings(JSON.stringify(request));
    const result = JSON.parse(response);
    
    return result.embeddings;
  }

  /**
   * Sentiment analysis using rust-bert
   */
  async sentimentAnalysis(text: string): Promise<{
    label: 'positive' | 'neutral' | 'negative';
    score: number;
  }> {
    if (!this.native || !this.status.rustBertAvailable) {
      throw new Error('rust-bert not available');
    }

    const request = { text };
    const response = await this.native.analyzeSentiment(JSON.stringify(request));
    const result = JSON.parse(response);
    
    return {
      label: result.label as 'positive' | 'neutral' | 'negative',
      score: result.score,
    };
  }

  /**
   * Zero-shot classification using rust-bert
   * STUBBED - Requires native module
   */
  async zeroShotClassification(
    text: string,
    labels: string[]
  ): Promise<Array<{ label: string; score: number }>> {
    if (!this.status.rustBertAvailable) {
      throw new Error('rust-bert not available');
    }

    // STUBBED - Would call zero-shot model
    console.warn(`[RustBridge] Zero-shot stubbed for labels: ${labels.join(', ')}`);
    
    return labels.map(label => ({
      label,
      score: Math.random(),
    }));
  }

  /**
   * Summarization using rust-bert
   * STUBBED - Requires native module
   */
  async summarize(text: string, maxLength = 150): Promise<string> {
    if (!this.status.rustBertAvailable) {
      throw new Error('rust-bert not available');
    }

    // STUBBED - Would call summarization model
    console.warn(`[RustBridge] Summarization stubbed, maxLength: ${maxLength}`);
    
    return `[STUB SUMMARY] ${text.slice(0, maxLength)}...`;
  }

  /**
   * Question answering using rust-bert
   * STUBBED - Requires native module
   */
  async questionAnswer(context: string, question: string): Promise<string> {
    if (!this.status.rustBertAvailable) {
      throw new Error('rust-bert not available');
    }

    // STUBBED - Would call QA model
    console.warn(`[RustBridge] QA stubbed`);
    
    return `[STUB ANSWER] Would answer "${question}" from context`;
  }

  /**
   * Load a model
   * STUBBED - Requires native module
   */
  async loadModel(modelName: string, backend: 'rust-bert' | 'candle' = 'rust-bert'): Promise<void> {
    console.warn(`[RustBridge] Load model stubbed: ${modelName} (${backend})`);
    this.status.loadedModels.push(`${backend}:${modelName}`);
  }

  /**
   * Unload a model
   * STUBBED - Requires native module
   */
  async unloadModel(modelName: string): Promise<void> {
    console.warn(`[RustBridge] Unload model stubbed: ${modelName}`);
    this.status.loadedModels = this.status.loadedModels.filter(m => !m.includes(modelName));
  }
}

/**
 * Create Rust bridge from environment
 */
export function createRustBridgeFromEnv(): RustBridge {
  return new RustBridge({
    rustBertLib: process.env['RUST_BERT_LIB'],
    candleLib: process.env['CANDLE_LIB'],
    modelCacheDir: process.env['NLP_MODEL_CACHE'] ?? './models',
    timeoutMs: parseInt(process.env['NLP_TIMEOUT_MS'] ?? '30000', 10),
  });
}

/**
 * Singleton bridge instance
 */
let globalBridge: RustBridge | null = null;

/**
 * Get or create global Rust bridge
 */
export function getGlobalBridge(): RustBridge {
  if (!globalBridge) {
    globalBridge = createRustBridgeFromEnv();
  }
  return globalBridge;
}

/**
 * Convert raw entity spans to Entity objects
 */
export function spansToEntities(
  spans: EntitySpan[],
  text: string
): Entity[] {
  return spans.map((span, index) => ({
    id: `ner_${span.label}_${index}_${span.start}`,
    text: span.text,
    type: mapBertLabelToEntityType(span.label),
    startPos: span.start,
    endPos: span.end,
    confidence: span.score,
    normalizedForm: span.text,
  }));
}

/**
 * Map BERT NER labels to EntityType
 */
function mapBertLabelToEntityType(label: string): EntityType {
  const mapping: Record<string, EntityType> = {
    'PER': 'person',
    'PERSON': 'person',
    'ORG': 'organization',
    'ORGANIZATION': 'organization',
    'LOC': 'location',
    'LOCATION': 'location',
    'MISC': 'concept',
  };

  // Handle B- and I- prefixes (B-PER, I-PER)
  const baseLabel = label.replace(/^[BI]-/, '');
  return mapping[baseLabel] ?? 'concept';
}
