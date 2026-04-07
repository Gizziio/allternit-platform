/**
 * @license
 * Copyright 2024 Google LLC
 * Modified for Allternit - Allternit Google AI Provider
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Contains the list of OpenAPI data types
 * as defined by https://swagger.io/docs/specification/data-models/data-types/
 * @public
 */
export declare enum SchemaType {
    /** String type. */
    STRING = "string",
    /** Number type. */
    NUMBER = "number",
    /** Integer type. */
    INTEGER = "integer",
    /** Boolean type. */
    BOOLEAN = "boolean",
    /** Array type. */
    ARRAY = "array",
    /** Object type. */
    OBJECT = "object"
}
/**
 * @public
 */
export declare enum ExecutableCodeLanguage {
    LANGUAGE_UNSPECIFIED = "language_unspecified",
    PYTHON = "python"
}
/**
 * Possible outcomes of code execution.
 * @public
 */
export declare enum Outcome {
    OUTCOME_UNSPECIFIED = "outcome_unspecified",
    OUTCOME_OK = "outcome_ok",
    OUTCOME_FAILED = "outcome_failed",
    OUTCOME_DEADLINE_EXCEEDED = "outcome_deadline_exceeded"
}
/**
 * Possible roles.
 * @public
 */
export declare const POSSIBLE_ROLES: readonly ["user", "model", "function", "system"];
/**
 * Harm categories that would cause prompts or candidates to be blocked.
 * @public
 */
export declare enum HarmCategory {
    HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
    HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
    HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
    HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
    HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY"
}
/**
 * Threshold above which a prompt or candidate will be blocked.
 * @public
 */
export declare enum HarmBlockThreshold {
    HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
    BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
    BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
    BLOCK_NONE = "BLOCK_NONE"
}
/**
 * Probability that a prompt or candidate matches a harm category.
 * @public
 */
export declare enum HarmProbability {
    HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED",
    NEGLIGIBLE = "NEGLIGIBLE",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH"
}
/**
 * Reason that a prompt was blocked.
 * @public
 */
export declare enum BlockReason {
    BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED",
    SAFETY = "SAFETY",
    OTHER = "OTHER"
}
/**
 * Reason that a candidate finished.
 * @public
 */
export declare enum FinishReason {
    FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
    STOP = "STOP",
    MAX_TOKENS = "MAX_TOKENS",
    SAFETY = "SAFETY",
    RECITATION = "RECITATION",
    LANGUAGE = "LANGUAGE",
    BLOCKLIST = "BLOCKLIST",
    PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
    SPII = "SPII",
    MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL",
    OTHER = "OTHER"
}
/**
 * Task type for embedding content.
 * @public
 */
export declare enum TaskType {
    TASK_TYPE_UNSPECIFIED = "TASK_TYPE_UNSPECIFIED",
    RETRIEVAL_QUERY = "RETRIEVAL_QUERY",
    RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT",
    SEMANTIC_SIMILARITY = "SEMANTIC_SIMILARITY",
    CLASSIFICATION = "CLASSIFICATION",
    CLUSTERING = "CLUSTERING"
}
/**
 * @public
 */
export declare enum FunctionCallingMode {
    MODE_UNSPECIFIED = "MODE_UNSPECIFIED",
    AUTO = "AUTO",
    ANY = "ANY",
    NONE = "NONE"
}
/**
 * The mode of the predictor to be used in dynamic retrieval.
 * @public
 */
export declare enum DynamicRetrievalMode {
    MODE_UNSPECIFIED = "MODE_UNSPECIFIED",
    MODE_DYNAMIC = "MODE_DYNAMIC"
}
/**
 * Fields common to all Schema types.
 * @internal
 */
export interface BaseSchema {
    /** Optional. Description of the value. */
    description?: string;
    /** If true, the value can be null. */
    nullable?: boolean;
}
export interface StringSchema extends BaseSchema {
    type: typeof SchemaType.STRING;
    format?: "date-time";
    enum?: never;
}
export interface EnumStringSchema extends BaseSchema {
    type: typeof SchemaType.STRING;
    format: "enum";
    enum: string[];
}
export type StringSchemaType = StringSchema | EnumStringSchema;
export interface NumberSchema extends BaseSchema {
    type: typeof SchemaType.NUMBER;
    format?: "float" | "double";
}
export interface IntegerSchema extends BaseSchema {
    type: typeof SchemaType.INTEGER;
    format?: "int32" | "int64";
}
export interface BooleanSchema extends BaseSchema {
    type: typeof SchemaType.BOOLEAN;
}
export interface ArraySchema extends BaseSchema {
    type: typeof SchemaType.ARRAY;
    items: Schema;
    minItems?: number;
    maxItems?: number;
}
export interface ObjectSchema extends BaseSchema {
    type: typeof SchemaType.OBJECT;
    properties: {
        [k: string]: Schema;
    };
    required?: string[];
}
export type Schema = StringSchemaType | NumberSchema | IntegerSchema | BooleanSchema | ArraySchema | ObjectSchema;
/**
 * Content type for both prompts and response candidates.
 * @public
 */
export interface Content {
    role: string;
    parts: Part[];
}
/**
 * Content part - includes text or image part types.
 * @public
 */
export type Part = TextPart | InlineDataPart | FunctionCallPart | FunctionResponsePart | FileDataPart | ExecutableCodePart | CodeExecutionResultPart;
export interface TextPart {
    text: string;
    inlineData?: never;
    functionCall?: never;
    functionResponse?: never;
    fileData?: never;
    executableCode?: never;
    codeExecutionResult?: never;
}
export interface InlineDataPart {
    text?: never;
    inlineData: GenerativeContentBlob;
    functionCall?: never;
    functionResponse?: never;
    fileData?: never;
    executableCode?: never;
    codeExecutionResult?: never;
}
export interface FunctionCallPart {
    text?: never;
    inlineData?: never;
    functionCall: FunctionCall;
    functionResponse?: never;
    fileData?: never;
    executableCode?: never;
    codeExecutionResult?: never;
}
export interface FunctionResponsePart {
    text?: never;
    inlineData?: never;
    functionCall?: never;
    functionResponse: FunctionResponse;
    fileData?: never;
    executableCode?: never;
    codeExecutionResult?: never;
}
export interface FileDataPart {
    text?: never;
    inlineData?: never;
    functionCall?: never;
    functionResponse?: never;
    fileData: FileData;
    executableCode?: never;
    codeExecutionResult?: never;
}
export interface ExecutableCodePart {
    text?: never;
    inlineData?: never;
    functionCall?: never;
    functionResponse?: never;
    fileData?: never;
    executableCode: ExecutableCode;
    codeExecutionResult?: never;
}
export interface CodeExecutionResultPart {
    text?: never;
    inlineData?: never;
    functionCall?: never;
    functionResponse?: never;
    fileData?: never;
    executableCode?: never;
    codeExecutionResult: CodeExecutionResult;
}
/**
 * Interface for sending an image.
 * @public
 */
export interface GenerativeContentBlob {
    mimeType: string;
    data: string;
}
/**
 * Data pointing to a file uploaded with the Files API.
 * @public
 */
export interface FileData {
    mimeType: string;
    fileUri: string;
}
/**
 * Code generated by the model that is meant to be executed.
 * @public
 */
export interface ExecutableCode {
    language: ExecutableCodeLanguage;
    code: string;
}
/**
 * Result of executing the `ExecutableCode`.
 * @public
 */
export interface CodeExecutionResult {
    outcome: Outcome;
    output: string;
}
/**
 * A predicted FunctionCall returned from the model.
 * @public
 */
export interface FunctionCall {
    name: string;
    args: object;
}
/**
 * The result output from a FunctionCall.
 * @public
 */
export interface FunctionResponse {
    name: string;
    response: object;
}
/**
 * Structured representation of a function declaration.
 * @public
 */
export interface FunctionDeclaration {
    name: string;
    description?: string;
    parameters?: FunctionDeclarationSchema;
}
export interface FunctionDeclarationSchema {
    type: SchemaType;
    properties: {
        [k: string]: FunctionDeclarationSchemaProperty;
    };
    description?: string;
    required?: string[];
}
export type FunctionDeclarationSchemaProperty = Schema;
export interface FunctionDeclarationsTool {
    functionDeclarations?: FunctionDeclaration[];
}
export interface FunctionCallingConfig {
    mode?: FunctionCallingMode;
    allowedFunctionNames?: string[];
}
export interface CodeExecutionTool {
    codeExecution: {};
}
export interface GoogleSearchRetrieval {
    dynamicRetrievalConfig?: DynamicRetrievalConfig;
}
export interface GoogleSearchRetrievalTool {
    googleSearchRetrieval?: GoogleSearchRetrieval;
}
export interface DynamicRetrievalConfig {
    mode?: DynamicRetrievalMode;
    dynamicThreshold?: number;
}
export type Tool = FunctionDeclarationsTool | CodeExecutionTool | GoogleSearchRetrievalTool;
export interface ToolConfig {
    functionCallingConfig: FunctionCallingConfig;
}
/**
 * Base parameters for a number of methods.
 * @public
 */
export interface BaseParams {
    safetySettings?: SafetySetting[];
    generationConfig?: GenerationConfig;
}
/**
 * Safety setting that can be sent as part of request parameters.
 * @public
 */
export interface SafetySetting {
    category: HarmCategory;
    threshold: HarmBlockThreshold;
}
/**
 * Config options for content-related requests
 * @public
 */
export interface GenerationConfig {
    candidateCount?: number;
    stopSequences?: string[];
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    responseMimeType?: string;
    responseSchema?: ResponseSchema;
    presencePenalty?: number;
    frequencyPenalty?: number;
    responseLogprobs?: boolean;
    logprobs?: number;
}
export type ResponseSchema = Schema;
/**
 * Params passed to getGenerativeModel().
 * @public
 */
export interface ModelParams extends BaseParams {
    model: string;
    tools?: Tool[];
    toolConfig?: ToolConfig;
    systemInstruction?: string | Part | Content;
    cachedContent?: CachedContent;
}
/**
 * Params passed to atomic asynchronous operations.
 * @public
 */
export interface RequestOptions {
    timeout?: number;
    apiVersion?: string;
    apiClient?: string;
    baseUrl?: string;
    customHeaders?: Headers | Record<string, string>;
}
export interface SingleRequestOptions extends RequestOptions {
    signal?: AbortSignal;
}
/**
 * Params for startChat.
 * @public
 */
export interface StartChatParams extends BaseParams {
    history?: Content[];
    tools?: Tool[];
    toolConfig?: ToolConfig;
    systemInstruction?: string | Part | Content;
    cachedContent?: string;
}
export interface CachedContentBase {
    model?: string;
    contents: Content[];
    tools?: Tool[];
    toolConfig?: ToolConfig;
    systemInstruction?: string | Part | Content;
    expireTime?: string;
    displayName?: string;
}
export interface CachedContent extends CachedContentBase {
    name?: string;
    ttl?: string;
    createTime?: string;
    updateTime?: string;
}
/**
 * Request sent to generateContent endpoint.
 * @public
 */
export interface GenerateContentRequest extends BaseParams {
    contents: Content[];
    tools?: Tool[];
    toolConfig?: ToolConfig;
    systemInstruction?: string | Part | Content;
    cachedContent?: string;
}
export interface _GenerateContentRequestInternal extends GenerateContentRequest {
    model?: string;
}
/**
 * A candidate returned as part of a GenerateContentResponse.
 * @public
 */
export interface GenerateContentCandidate {
    index: number;
    content: Content;
    finishReason?: FinishReason;
    finishMessage?: string;
    safetyRatings?: SafetyRating[];
    citationMetadata?: CitationMetadata;
    avgLogprobs?: number;
    logprobsResult?: LogprobsResult;
    groundingMetadata?: GroundingMetadata;
}
/**
 * A safety rating associated with a GenerateContentCandidate
 * @public
 */
export interface SafetyRating {
    category: HarmCategory;
    probability: HarmProbability;
}
/**
 * Citation metadata that may be found on a GenerateContentCandidate.
 * @public
 */
export interface CitationMetadata {
    citationSources: CitationSource[];
}
/**
 * A single citation source.
 * @public
 */
export interface CitationSource {
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
}
/**
 * Logprobs Result
 * @public
 */
export interface LogprobsResult {
    topCandidates: TopCandidates[];
    chosenCandidates: LogprobsCandidate[];
}
export interface TopCandidates {
    candidates: LogprobsCandidate[];
}
export interface LogprobsCandidate {
    token: string;
    tokenID: number;
    logProbability: number;
}
/**
 * Grounding metadata.
 * @public
 */
export interface GroundingMetadata {
    searchEntryPoint?: SearchEntryPoint;
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
    retrievalMetadata?: RetrievalMetadata;
    webSearchQueries: string[];
}
export interface GroundingChunk {
    web?: GroundingChunkWeb;
}
export interface GroundingChunkWeb {
    uri?: string;
    title?: string;
}
export interface GroundingSupport {
    segment?: string;
    groundingChunckIndices?: number[];
    confidenceScores?: number[];
}
export interface GroundingSupportSegment {
    partIndex?: number;
    startIndex?: number;
    endIndex?: number;
    text?: string;
}
export interface SearchEntryPoint {
    renderedContent?: string;
    sdkBlob?: string;
}
export interface RetrievalMetadata {
    googleSearchDynamicRetrievalScore?: number;
}
/**
 * If the prompt was blocked, this will be populated.
 * @public
 */
export interface PromptFeedback {
    blockReason: BlockReason;
    safetyRatings: SafetyRating[];
    blockReasonMessage?: string;
}
/**
 * Individual response from generateContent.
 * @public
 */
export interface GenerateContentResponse {
    candidates?: GenerateContentCandidate[];
    promptFeedback?: PromptFeedback;
    usageMetadata?: UsageMetadata;
}
/**
 * Response object wrapped with helper methods.
 * @public
 */
export interface EnhancedGenerateContentResponse extends GenerateContentResponse {
    text: () => string;
    functionCall: () => FunctionCall | undefined;
    functionCalls: () => FunctionCall[] | undefined;
}
/**
 * Result object returned from generateContent() call.
 * @public
 */
export interface GenerateContentResult {
    response: EnhancedGenerateContentResponse;
}
/**
 * Result object returned from generateContentStream() call.
 * @public
 */
export interface GenerateContentStreamResult {
    stream: AsyncGenerator<EnhancedGenerateContentResponse>;
    response: Promise<EnhancedGenerateContentResponse>;
}
/**
 * Params for calling countTokens.
 * @public
 */
export interface CountTokensRequest {
    generateContentRequest?: GenerateContentRequest;
    contents?: Content[];
}
export interface _CountTokensRequestInternal {
    generateContentRequest?: _GenerateContentRequestInternal;
    contents?: Content[];
}
/**
 * Response from calling countTokens.
 * @public
 */
export interface CountTokensResponse {
    totalTokens: number;
}
/**
 * Params for calling embedContent
 * @public
 */
export interface EmbedContentRequest {
    content: Content;
    taskType?: TaskType;
    title?: string;
}
/**
 * Response from calling embedContent.
 * @public
 */
export interface EmbedContentResponse {
    embedding: ContentEmbedding;
}
/**
 * A single content embedding.
 * @public
 */
export interface ContentEmbedding {
    values: number[];
}
/**
 * Params for calling batchEmbedContents
 * @public
 */
export interface BatchEmbedContentsRequest {
    requests: EmbedContentRequest[];
}
/**
 * Response from calling batchEmbedContents.
 * @public
 */
export interface BatchEmbedContentsResponse {
    embeddings: ContentEmbedding[];
}
/**
 * Metadata on the generation request's token usage.
 * @public
 */
export interface UsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
}
export interface ErrorDetails {
    "@type"?: string;
    reason?: string;
    domain?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map