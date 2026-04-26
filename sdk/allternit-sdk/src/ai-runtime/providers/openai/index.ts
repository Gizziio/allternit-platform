/**
 * OpenAI Provider for Allternit SDK
 */

export class AllternitOpenAI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: unknown[]): Promise<unknown> {
    throw new Error('OpenAI provider not yet implemented');
  }
}

export default AllternitOpenAI;
