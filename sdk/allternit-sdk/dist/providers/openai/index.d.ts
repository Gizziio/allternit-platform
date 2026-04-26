/**
 * OpenAI Provider for Allternit SDK
 */
export declare class AllternitOpenAI {
    private apiKey;
    constructor(apiKey: string);
    chat(messages: unknown[]): Promise<unknown>;
}
export default AllternitOpenAI;
