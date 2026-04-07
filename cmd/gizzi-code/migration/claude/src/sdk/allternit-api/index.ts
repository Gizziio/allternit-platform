/**
 * Allternit API SDK
 * TEMPORARY SHIM - Replaces @anthropic-ai/sdk
 */

export class AllternitAPI {
  apiKey: string | null
  baseURL: string

  constructor(options: { apiKey?: string; baseURL?: string } = {}) {
    this.apiKey = options.apiKey || null
    this.baseURL = options.baseURL || 'https://api.allternit.com'
  }

  messages = {
    create: async (params: unknown): Promise<unknown> => {
      return { content: [] }
    },
    stream: async function* (params: unknown): AsyncGenerator<unknown> {
      yield { type: 'content_block_delta', delta: { text: '' } }
    }
  }

  beta = {
    messages: {
      create: async (params: unknown): Promise<unknown> => {
        return { content: [] }
      },
      stream: async function* (params: unknown): AsyncGenerator<unknown> {
        yield { type: 'content_block_delta', delta: { text: '' } }
      }
    }
  }
}

// Error exports
export class AllternitError extends Error {}
export class APIError extends AllternitError {
  status?: number
  headers?: Record<string, string>
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}
export class APIUserAbortError extends APIError {}
export class APIConnectionError extends APIError {}

export default AllternitAPI
