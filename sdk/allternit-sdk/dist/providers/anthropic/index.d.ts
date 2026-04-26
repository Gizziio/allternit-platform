/**
 * Anthropic Provider for Allternit SDK
 */
export declare class AllternitAI {
    private apiKey;
    constructor(apiKey: string);
    chat(messages: unknown[]): Promise<unknown>;
}
export default AllternitAI;
