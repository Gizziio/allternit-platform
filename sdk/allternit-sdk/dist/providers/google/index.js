/**
 * Google AI Provider for Allternit SDK
 */
export class AllternitGoogleAI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async chat(messages) {
        throw new Error('Google AI provider not yet implemented');
    }
}
export default AllternitGoogleAI;
