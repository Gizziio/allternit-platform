import type AllternitOpenAI from '../index';
import type { RequestOptions } from '../internal/request-options';
import type { ChatCompletion, ChatCompletionCreateParams, ChatCompletionMessage, ChatCompletionMessageFunctionToolCall, ChatCompletionMessageParam, ParsedChatCompletion } from '../resources/chat/completions';
import type { CompletionUsage } from '../resources/completions';
import type { ChatCompletionToolRunnerParams } from './ChatCompletionRunner';
import type { ChatCompletionStreamingToolRunnerParams } from './ChatCompletionStreamingRunner';
import { BaseEvents, EventStream } from './EventStream';
import { type BaseFunctionsArgs } from './RunnableFunction';
export interface RunnerOptions extends RequestOptions {
    /** How many requests to make before canceling. Default 10. */
    maxChatCompletions?: number;
}
export declare class AbstractChatCompletionRunner<EventTypes extends AbstractChatCompletionRunnerEvents, ParsedT> extends EventStream<EventTypes> {
    #private;
    protected _chatCompletions: ParsedChatCompletion<ParsedT>[];
    messages: ChatCompletionMessageParam[];
    protected _addChatCompletion(this: AbstractChatCompletionRunner<AbstractChatCompletionRunnerEvents, ParsedT>, chatCompletion: ParsedChatCompletion<ParsedT>): ParsedChatCompletion<ParsedT>;
    protected _addMessage(this: AbstractChatCompletionRunner<AbstractChatCompletionRunnerEvents, ParsedT>, message: ChatCompletionMessageParam, emit?: boolean): void;
    /**
     * @returns a promise that resolves with the final ChatCompletion, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
     */
    finalChatCompletion(): Promise<ParsedChatCompletion<ParsedT>>;
    /**
     * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    finalContent(): Promise<string | null>;
    /**
     * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
     * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    finalMessage(): Promise<ChatCompletionMessage>;
    /**
     * @returns a promise that resolves with the content of the final FunctionCall, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    finalFunctionToolCall(): Promise<ChatCompletionMessageFunctionToolCall.Function | undefined>;
    finalFunctionToolCallResult(): Promise<string | undefined>;
    totalUsage(): Promise<CompletionUsage>;
    allChatCompletions(): ChatCompletion[];
    protected _emitFinal(this: AbstractChatCompletionRunner<AbstractChatCompletionRunnerEvents, ParsedT>): void;
    protected _createChatCompletion(client: AllternitOpenAI, params: ChatCompletionCreateParams, options?: RequestOptions): Promise<ParsedChatCompletion<ParsedT>>;
    protected _runChatCompletion(client: AllternitOpenAI, params: ChatCompletionCreateParams, options?: RequestOptions): Promise<ChatCompletion>;
    protected _runTools<FunctionsArgs extends BaseFunctionsArgs>(client: AllternitOpenAI, params: ChatCompletionToolRunnerParams<FunctionsArgs> | ChatCompletionStreamingToolRunnerParams<FunctionsArgs>, options?: RunnerOptions): Promise<void>;
}
export interface AbstractChatCompletionRunnerEvents extends BaseEvents {
    functionToolCall: (functionCall: ChatCompletionMessageFunctionToolCall.Function) => void;
    message: (message: ChatCompletionMessageParam) => void;
    chatCompletion: (completion: ChatCompletion) => void;
    finalContent: (contentSnapshot: string) => void;
    finalMessage: (message: ChatCompletionMessageParam) => void;
    finalChatCompletion: (completion: ChatCompletion) => void;
    finalFunctionToolCall: (functionCall: ChatCompletionMessageFunctionToolCall.Function) => void;
    functionToolCallResult: (content: string) => void;
    finalFunctionToolCallResult: (content: string) => void;
    totalUsage: (usage: CompletionUsage) => void;
}
//# sourceMappingURL=AbstractChatCompletionRunner.d.ts.map