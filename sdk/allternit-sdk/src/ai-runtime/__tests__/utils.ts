/**
 * Test Utilities for Allternit SDK
 * 
 * This module provides mock helpers and test utilities for the SDK test suite.
 */

import { Message, Tool, HarnessStreamChunk } from '../harness/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock user message
 */
export function createUserMessage(content: string): Message {
  return {
    role: 'user',
    content
  };
}

/**
 * Create a mock assistant message
 */
export function createAssistantMessage(content: string): Message {
  return {
    role: 'assistant',
    content
  };
}

/**
 * Create a mock system message
 */
export function createSystemMessage(content: string): Message {
  return {
    role: 'system',
    content
  };
}

/**
 * Create a mock tool message
 */
export function createToolMessage(content: string, toolCallId: string): Message {
  return {
    role: 'tool',
    content,
    tool_call_id: toolCallId
  };
}

/**
 * Create a mock conversation
 */
export function createMockConversation(): Message[] {
  return [
    createSystemMessage('You are a helpful assistant'),
    createUserMessage('Hello'),
    createAssistantMessage('Hi there!'),
    createUserMessage('How are you?')
  ];
}

// ============================================================================
// Mock Tool Factories
// ============================================================================

/**
 * Create a mock calculator tool
 */
export function createCalculatorTool(): Tool {
  return {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate'
        }
      },
      required: ['expression']
    }
  };
}

/**
 * Create a mock weather tool
 */
export function createWeatherTool(): Tool {
  return {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state/country'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit'
        }
      },
      required: ['location']
    }
  };
}

/**
 * Create a mock search tool
 */
export function createSearchTool(): Tool {
  return {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default: 5)'
        }
      },
      required: ['query']
    }
  };
}

// ============================================================================
// Mock API Response Helpers
// ============================================================================

/**
 * Create a mock successful API response
 */
export function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    body: null,
  } as Response;
}

/**
 * Create a mock error API response
 */
export function createMockErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(message),
    headers: new Headers(),
    body: null,
  } as Response;
}

/**
 * Create a mock streaming response from chunks
 */
export function createMockStreamingResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => {
        controller.enqueue(new TextEncoder().encode(chunk + '\n'));
      });
      controller.close();
    }
  });

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: stream,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response;
}

// ============================================================================
// Mock Ollama Response Helpers
// ============================================================================

/**
 * Create a mock Ollama model list response
 */
export function createMockOllamaModels() {
  return {
    models: [
      { name: 'llama2', size: 3825819519, digest: 'fe938a131f3', modified_at: '2024-01-15' },
      { name: 'llama2:13b', size: 7368842240, digest: '1234567890ab', modified_at: '2024-01-15' },
      { name: 'mistral', size: 4113301824, digest: '61e6e7f29bd7', modified_at: '2024-01-10' },
      { name: 'codellama', size: 3825000000, digest: 'abcdef123456', modified_at: '2024-01-05' }
    ]
  };
}

/**
 * Create mock Ollama generate response chunks
 */
export function createMockOllamaGenerateChunks(text: string): string[] {
  const words = text.split(' ');
  return words.map((word, index) => 
    JSON.stringify({ 
      response: index === 0 ? word : ' ' + word, 
      done: index === words.length - 1 
    })
  );
}

/**
 * Create mock Ollama chat response chunks
 */
export function createMockOllamaChatChunks(text: string): string[] {
  const words = text.split(' ');
  return words.map((word, index) => 
    JSON.stringify({ 
      message: { 
        role: 'assistant', 
        content: index === 0 ? word : ' ' + word 
      },
      done: index === words.length - 1 
    })
  );
}

// ============================================================================
// Mock Fetch Helper
// ============================================================================

/**
 * Type for mock fetch implementation
 */
export type MockFetch = ReturnType<typeof createMockFetch>;

/**
 * Create a mock fetch function with tracking
 */
export function createMockFetch() {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  
  let responseQueue: Array<() => Promise<Response>> = [];
  let defaultResponse: Response | null = null;

  const mockFetch = (url: string | URL | Request, options: RequestInit = {}): Promise<Response> => {
    calls.push({ url: url.toString(), options });
    
    if (responseQueue.length > 0) {
      const response = responseQueue.shift()!;
      return response();
    }
    
    if (defaultResponse) {
      return Promise.resolve(defaultResponse);
    }
    
    return Promise.resolve(createMockResponse({}));
  };

  return {
    fetch: mockFetch,
    calls,
    queueResponse: (response: Response | (() => Promise<Response>)) => {
      if (typeof response === 'function') {
        responseQueue.push(response);
      } else {
        responseQueue.push(() => Promise.resolve(response));
      }
    },
    setDefaultResponse: (response: Response) => {
      defaultResponse = response;
    },
    reset: () => {
      calls.length = 0;
      responseQueue = [];
      defaultResponse = null;
    },
    getLastCall: () => calls[calls.length - 1],
    getCallCount: () => calls.length,
  };
}

// ============================================================================
// Test Harness Helpers
// ============================================================================

/**
 * Create valid BYOK configuration for testing
 */
export function createBYOKConfig(providers: ('anthropic' | 'openai' | 'google')[] = ['anthropic']) {
  const config: any = { mode: 'byok', byok: {} };
  
  if (providers.includes('anthropic')) {
    config.byok.anthropic = { apiKey: 'test-anthropic-key' };
  }
  if (providers.includes('openai')) {
    config.byok.openai = { apiKey: 'test-openai-key' };
  }
  if (providers.includes('google')) {
    config.byok.google = { apiKey: 'test-google-key' };
  }
  
  return config;
}

/**
 * Create valid Cloud configuration for testing
 */
export function createCloudConfig() {
  return {
    mode: 'cloud',
    cloud: {
      baseURL: 'https://api.allternit.com',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    }
  };
}

/**
 * Create valid Local configuration for testing
 */
export function createLocalConfig() {
  return {
    mode: 'local',
    local: {
      baseURL: 'http://localhost:11434'
    }
  };
}

/**
 * Create valid Subprocess configuration for testing
 */
export function createSubprocessConfig() {
  return {
    mode: 'subprocess',
    subprocess: {
      command: 'python model.py',
      env: { MODEL_PATH: '/models' },
      cwd: '/app'
    }
  };
}

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Collect all chunks from an async generator
 */
export async function collectAsyncGenerator<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const chunk of generator) {
    results.push(chunk);
  }
  return results;
}

/**
 * Get the first chunk from an async generator
 */
export async function getFirstChunk<T>(generator: AsyncGenerator<T>): Promise<T | undefined> {
  const result = await generator.next();
  return result.value;
}

/**
 * Drain an async generator (consume without collecting)
 */
export async function drainAsyncGenerator<T>(generator: AsyncGenerator<T>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of generator) {
    // Drain
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Check if a value is a valid HarnessStreamChunk
 */
export function isValidStreamChunk(chunk: unknown): boolean {
  if (typeof chunk !== 'object' || chunk === null) return false;
  
  const c = chunk as HarnessStreamChunk;
  const validTypes = ['text', 'tool_call', 'tool_call_complete', 'tool_result', 'error', 'done'];
  
  return 'type' in c && validTypes.includes(c.type);
}

/**
 * Check if error is a HarnessError
 */
export function isHarnessError(error: unknown): boolean {
  return error instanceof Error && 'code' in error;
}
