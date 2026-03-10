/**
 * Multimedia API Clients
 * 
 * API integrations for image, audio, and video generation.
 */

// ============================================================================
// Image Generation (FLUX via Replicate)
// ============================================================================

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
}

export interface ImageGenerationResult {
  url: string;
  width: number;
  height: number;
  seed: number;
}

export async function generateImage(
  params: ImageGenerationParams,
  apiKey: string
): Promise<ImageGenerationResult> {
  // Replicate FLUX API
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify({
      version: 'flux-1.1-pro',
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        width: params.width || 1024,
        height: params.height || 1024,
        num_inference_steps: params.steps || 28,
        guidance_scale: params.guidance || 3.5,
        seed: params.seed,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.statusText}`);
  }

  const prediction = await response.json();
  
  // Poll for result
  return await pollForResult(prediction.urls.get, apiKey);
}

async function pollForResult(
  pollUrl: string,
  apiKey: string
): Promise<ImageGenerationResult> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(pollUrl, {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
    });
    
    const prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      return {
        url: prediction.output?.[0] || prediction.output,
        width: 1024,
        height: 1024,
        seed: prediction.input?.seed || Math.floor(Math.random() * 1000000),
      };
    } else if (prediction.status === 'failed') {
      throw new Error('Image generation failed');
    }
  }
  
  throw new Error('Image generation timed out');
}

// ============================================================================
// Audio Generation (ElevenLabs)
// ============================================================================

export interface AudioGenerationParams {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface AudioGenerationResult {
  url: string;
  durationSecs: number;
  voiceId: string;
}

export async function generateAudio(
  params: AudioGenerationParams,
  apiKey: string
): Promise<AudioGenerationResult> {
  const voiceId = params.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
  const modelId = params.modelId || 'eleven_turbo_v2';
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: params.text,
        model_id: modelId,
        voice_settings: {
          stability: params.stability || 0.5,
          similarity_boost: params.similarityBoost || 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Audio generation failed: ${response.statusText}`);
  }

  // Get audio blob
  const audioBlob = await response.blob();
  const url = URL.createObjectURL(audioBlob);
  
  // Estimate duration (rough: 150 chars per second)
  const durationSecs = params.text.length / 150;
  
  return {
    url,
    durationSecs,
    voiceId,
  };
}

// ============================================================================
// Video Generation (Kling API)
// ============================================================================

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  duration?: number; // seconds
  width?: number;
  height?: number;
  fps?: number;
}

export interface VideoGenerationResult {
  url: string;
  durationSecs: number;
  width: number;
  height: number;
}

export async function generateVideo(
  params: VideoGenerationParams,
  apiKey: string
): Promise<VideoGenerationResult> {
  // Kling AI Video API (placeholder - actual API may differ)
  const response = await fetch('https://api.klingai.com/v1/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      duration: params.duration || 5,
      width: params.width || 720,
      height: params.height || 1280,
      fps: params.fps || 24,
    }),
  });

  if (!response.ok) {
    throw new Error(`Video generation failed: ${response.statusText}`);
  }

  const job = await response.json();
  
  // Poll for result
  return await pollForVideoResult(job.id, apiKey);
}

async function pollForVideoResult(
  jobId: string,
  apiKey: string
): Promise<VideoGenerationResult> {
  const maxAttempts = 60; // 5 minutes
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const response = await fetch(`https://api.klingai.com/v1/videos/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    const video = await response.json();
    
    if (video.status === 'completed') {
      return {
        url: video.video_url,
        durationSecs: video.duration || 5,
        width: video.width || 720,
        height: video.height || 1280,
      };
    } else if (video.status === 'failed') {
      throw new Error('Video generation failed');
    }
  }
  
  throw new Error('Video generation timed out');
}

// ============================================================================
// Search API (Tavily)
// ============================================================================

export interface SearchParams {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function performSearch(
  params: SearchParams,
  apiKey: string
): Promise<SearchResponse> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: params.query,
      max_results: params.maxResults || 5,
      include_domains: params.includeDomains,
      exclude_domains: params.excludeDomains,
      search_depth: 'advanced',
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    results: data.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      content: r.content,
      score: r.score,
    })),
    query: params.query,
  };
}

// ============================================================================
// Unified Generation Service
// ============================================================================

export interface GenerationConfig {
  replicateApiKey?: string;
  elevenlabsApiKey?: string;
  klingApiKey?: string;
  tavilyApiKey?: string;
}

export class GenerationService {
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    if (!this.config.replicateApiKey) {
      throw new Error('Replicate API key not configured');
    }
    return generateImage(params, this.config.replicateApiKey);
  }

  async generateAudio(params: AudioGenerationParams): Promise<AudioGenerationResult> {
    if (!this.config.elevenlabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    return generateAudio(params, this.config.elevenlabsApiKey);
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    if (!this.config.klingApiKey) {
      throw new Error('Kling API key not configured');
    }
    return generateVideo(params, this.config.klingApiKey);
  }

  async search(params: SearchParams): Promise<SearchResponse> {
    if (!this.config.tavilyApiKey) {
      throw new Error('Tavily API key not configured');
    }
    return performSearch(params, this.config.tavilyApiKey);
  }
}
