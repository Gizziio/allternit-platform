/**
 * Google AI Provider for Allternit SDK
 */
export declare class AllternitGoogleAI {
    private apiKey;
    constructor(apiKey: string);
    chat(messages: unknown[]): Promise<unknown>;
}
export default AllternitGoogleAI;
