/**
 * Anthropic Provider for Allternit SDK
 */

export class AllternitAI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: unknown[]): Promise<unknown> {
    throw new Error('Anthropic provider not yet implemented');
  }
}

export default AllternitAI;
