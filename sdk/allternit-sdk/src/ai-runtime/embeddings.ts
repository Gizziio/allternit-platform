import type { HarnessConfig } from './harness/types.js';
import { HarnessError, HarnessErrorCode } from './harness/types.js';

export interface EmbeddingsCreateRequest {
  model: string;
  input: string | string[];
}

export interface Embedding {
  object: 'embedding';
  embedding: number[];
  index: number;
}

export interface EmbeddingsResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
}

/** OpenAI-compatible embeddings client using the harness auth configuration. */
export class AllternitEmbeddings {
  constructor(private readonly config: HarnessConfig) {}

  async create(request: EmbeddingsCreateRequest): Promise<EmbeddingsResponse> {
    if (!request?.model || (typeof request.input !== 'string' && !Array.isArray(request.input))) {
      throw new HarnessError(HarnessErrorCode.CONFIG_INVALID, 'Embeddings require model and input');
    }

    let baseURL: string;
    let authorization: string;
    if (this.config.mode === 'byok') {
      const openai = this.config.byok?.openai;
      if (!openai?.apiKey) throw new HarnessError(HarnessErrorCode.AUTHENTICATION_ERROR, 'OpenAI API key not configured');
      baseURL = openai.baseURL ?? 'https://api.openai.com/v1';
      authorization = `Bearer ${openai.apiKey}`;
    } else if (this.config.mode === 'cloud') {
      if (!this.config.cloud) throw new HarnessError(HarnessErrorCode.CONFIG_INVALID, 'Cloud configuration missing');
      baseURL = `${this.config.cloud.baseURL.replace(/\/$/, '')}/v1`;
      authorization = `Bearer ${this.config.cloud.accessToken}`;
    } else if (this.config.mode === 'local') {
      if (!this.config.local) throw new HarnessError(HarnessErrorCode.CONFIG_INVALID, 'Local configuration missing');
      baseURL = this.config.local.baseURL;
      authorization = '';
    } else {
      throw new HarnessError(HarnessErrorCode.MODE_UNSUPPORTED, 'Embeddings are not supported in subprocess mode');
    }

    const response = await fetch(`${baseURL.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new HarnessError(HarnessErrorCode.API_ERROR, `Embeddings request failed with status ${response.status}`);
    }
    return response.json() as Promise<EmbeddingsResponse>;
  }
}
