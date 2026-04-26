/**
 * Anthropic Provider for Allternit SDK
 */
export class AllternitAI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async chat(messages) {
        throw new Error('Anthropic provider not yet implemented');
    }
}
export default AllternitAI;
