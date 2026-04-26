/**
 * Google AI Provider for Allternit SDK
 */

export class AllternitGoogleAI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: unknown[]): Promise<unknown> {
    throw new Error('Google AI provider not yet implemented');
  }
}

export default AllternitGoogleAI;
