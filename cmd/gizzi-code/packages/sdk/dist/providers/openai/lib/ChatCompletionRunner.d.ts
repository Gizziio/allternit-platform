import { type ChatCompletionMessageParam, type ChatCompletionCreateParamsNonStreaming } from '../resources/chat/completions';
import { type BaseFunctionsArgs, RunnableTools } from './RunnableFunction';
import { AbstractChatCompletionRunner, AbstractChatCompletionRunnerEvents, RunnerOptions } from './AbstractChatCompletionRunner';
import AllternitOpenAI from '../index';
import { AutoParseableTool } from '../lib/parser';
export interface ChatCompletionRunnerEvents extends AbstractChatCompletionRunnerEvents {
    content: (content: string) => void;
}
export type ChatCompletionToolRunnerParams<FunctionsArgs extends BaseFunctionsArgs> = Omit<ChatCompletionCreateParamsNonStreaming, 'tools'> & {
    tools: RunnableTools<FunctionsArgs> | AutoParseableTool<any, true>[];
};
export declare class ChatCompletionRunner<ParsedT = null> extends AbstractChatCompletionRunner<ChatCompletionRunnerEvents, ParsedT> {
    static runTools<ParsedT>(client: AllternitOpenAI, params: ChatCompletionToolRunnerParams<any[]>, options?: RunnerOptions): ChatCompletionRunner<ParsedT>;
    _addMessage(this: ChatCompletionRunner<ParsedT>, message: ChatCompletionMessageParam, emit?: boolean): void;
}
//# sourceMappingURL=ChatCompletionRunner.d.ts.map