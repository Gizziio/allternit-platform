/**
 * OpenAI Provider for Allternit SDK
 */
export class AllternitOpenAI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async chat(messages) {
        throw new Error('OpenAI provider not yet implemented');
    }
}
export default AllternitOpenAI;
