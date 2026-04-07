import { ToolError } from './ToolError';
import { AllternitError } from '../../core/error';
/**
 * Just Promise.withResolvers(), which is not available in all environments.
 */
function promiseWithResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve, reject: reject };
}
/**
 * A ToolRunner handles the automatic conversation loop between the assistant and tools.
 *
 * A ToolRunner is an async iterable that yields either BetaMessage or BetaMessageStream objects
 * depending on the streaming configuration.
 */
export class BetaToolRunner {
    client;
    /** Whether the async iterator has been consumed */
    #consumed = false;
    /** Whether parameters have been mutated since the last API call */
    #mutated = false;
    /** Current state containing the request parameters */
    #state;
    /** Promise for the last message received from the assistant */
    #message;
    /** Cached tool response to avoid redundant executions */
    #toolResponse;
    /** Promise resolvers for waiting on completion */
    #completion;
    /** Number of iterations (API requests) made so far */
    #iterationCount = 0;
    constructor(client, params) {
        this.client = client;
        this.#state = {
            params: {
                // You can't clone the entire params since there are functions as handlers.
                // You also don't really need to clone params.messages, but it probably will prevent a foot gun
                // somewhere.
                ...params,
                messages: structuredClone(params.messages),
            },
        };
        this.#completion = promiseWithResolvers();
    }
    async *[Symbol.asyncIterator]() {
        if (this.#consumed) {
            throw new AllternitError('Cannot iterate over a consumed stream');
        }
        this.#consumed = true;
        this.#mutated = true;
        this.#toolResponse = undefined;
        try {
            while (true) {
                let stream;
                try {
                    if (this.#state.params.max_iterations &&
                        this.#iterationCount >= this.#state.params.max_iterations) {
                        break;
                    }
                    this.#mutated = false;
                    this.#message = undefined;
                    this.#toolResponse = undefined;
                    this.#iterationCount++;
                    const { max_iterations, ...params } = this.#state.params;
                    if (params.stream) {
                        stream = this.client.beta.messages.stream({ ...params });
                        this.#message = stream.finalMessage();
                        // Make sure that this promise doesn't throw before we get the option to do something about it.
                        // Error will be caught when we call await this.#message ultimately
                        this.#message.catch(() => { });
                        yield stream;
                    }
                    else {
                        this.#message = this.client.beta.messages.create({ ...params, stream: false });
                        yield this.#message;
                    }
                    if (!this.#mutated) {
                        const { role, content } = await this.#message;
                        this.#state.params.messages.push({ role, content });
                    }
                    const toolMessage = await this.#generateToolResponse(this.#state.params.messages.at(-1));
                    if (toolMessage) {
                        this.#state.params.messages.push(toolMessage);
                    }
                    if (!toolMessage && !this.#mutated) {
                        break;
                    }
                }
                finally {
                    if (stream) {
                        stream.abort();
                    }
                }
            }
            if (!this.#message) {
                throw new AllternitError('ToolRunner concluded without a message from the server');
            }
            this.#completion.resolve(await this.#message);
        }
        catch (error) {
            this.#consumed = false;
            // Silence unhandled promise errors
            this.#completion.promise.catch(() => { });
            this.#completion.reject(error);
            this.#completion = promiseWithResolvers();
            throw error;
        }
    }
    setMessagesParams(paramsOrMutator) {
        if (typeof paramsOrMutator === 'function') {
            this.#state.params = paramsOrMutator(this.#state.params);
        }
        else {
            this.#state.params = paramsOrMutator;
        }
        this.#mutated = true;
        // Invalidate cached tool response since parameters changed
        this.#toolResponse = undefined;
    }
    /**
     * Get the tool response for the last message from the assistant.
     * Avoids redundant tool executions by caching results.
     *
     * @returns A promise that resolves to a BetaMessageParam containing tool results, or null if no tools need to be executed
     *
     * @example
     * const toolResponse = await runner.generateToolResponse();
     * if (toolResponse) {
     *   console.log('Tool results:', toolResponse.content);
     * }
     */
    async generateToolResponse() {
        const message = (await this.#message) ?? this.params.messages.at(-1);
        if (!message) {
            return null;
        }
        return this.#generateToolResponse(message);
    }
    async #generateToolResponse(lastMessage) {
        if (this.#toolResponse !== undefined) {
            return this.#toolResponse;
        }
        this.#toolResponse = generateToolResponse(this.#state.params, lastMessage);
        return this.#toolResponse;
    }
    /**
     * Wait for the async iterator to complete. This works even if the async iterator hasn't yet started, and
     * will wait for an instance to start and go to completion.
     *
     * @returns A promise that resolves to the final BetaMessage when the iterator completes
     *
     * @example
     * // Start consuming the iterator
     * for await (const message of runner) {
     *   console.log('Message:', message.content);
     * }
     *
     * // Meanwhile, wait for completion from another part of the code
     * const finalMessage = await runner.done();
     * console.log('Final response:', finalMessage.content);
     */
    done() {
        return this.#completion.promise;
    }
    /**
     * Returns a promise indicating that the stream is done. Unlike .done(), this will eagerly read the stream:
     * * If the iterator has not been consumed, consume the entire iterator and return the final message from the
     * assistant.
     * * If the iterator has been consumed, waits for it to complete and returns the final message.
     *
     * @returns A promise that resolves to the final BetaMessage from the conversation
     * @throws {AllternitError} If no messages were processed during the conversation
     *
     * @example
     * const finalMessage = await runner.runUntilDone();
     * console.log('Final response:', finalMessage.content);
     */
    async runUntilDone() {
        // If not yet consumed, start consuming and wait for completion
        if (!this.#consumed) {
            for await (const _ of this) {
                // Iterator naturally populates this.#message
            }
        }
        // If consumed but not completed, wait for completion
        return this.done();
    }
    /**
     * Get the current parameters being used by the ToolRunner.
     *
     * @returns A readonly view of the current ToolRunnerParams
     *
     * @example
     * const currentParams = runner.params;
     * console.log('Current model:', currentParams.model);
     * console.log('Message count:', currentParams.messages.length);
     */
    get params() {
        return this.#state.params;
    }
    /**
     * Add one or more messages to the conversation history.
     *
     * @param messages - One or more BetaMessageParam objects to add to the conversation
     *
     * @example
     * runner.pushMessages(
     *   { role: 'user', content: 'Also, what about the weather in NYC?' }
     * );
     *
     * @example
     * // Adding multiple messages
     * runner.pushMessages(
     *   { role: 'user', content: 'What about NYC?' },
     *   { role: 'user', content: 'And Boston?' }
     * );
     */
    pushMessages(...messages) {
        this.setMessagesParams((params) => ({
            ...params,
            messages: [...params.messages, ...messages],
        }));
    }
    /**
     * Makes the ToolRunner directly awaitable, equivalent to calling .runUntilDone()
     * This allows using `await runner` instead of `await runner.runUntilDone()`
     */
    then(onfulfilled, onrejected) {
        return this.runUntilDone().then(onfulfilled, onrejected);
    }
}
async function generateToolResponse(params, lastMessage = params.messages.at(-1)) {
    // Only process if the last message is from the assistant and has tool use blocks
    if (!lastMessage ||
        lastMessage.role !== 'assistant' ||
        !lastMessage.content ||
        typeof lastMessage.content === 'string') {
        return null;
    }
    const toolUseBlocks = lastMessage.content.filter((content) => content.type === 'tool_use');
    if (toolUseBlocks.length === 0) {
        return null;
    }
    const toolResults = await Promise.all(toolUseBlocks.map(async (toolUse) => {
        const tool = params.tools.find((t) => ('name' in t ? t.name : t.mcp_server_name) === toolUse.name);
        if (!tool || !('run' in tool)) {
            return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Error: Tool '${toolUse.name}' not found`,
                is_error: true,
            };
        }
        try {
            let input = toolUse.input;
            if ('parse' in tool && tool.parse) {
                input = tool.parse(input);
            }
            const result = await tool.run(input);
            return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result,
            };
        }
        catch (error) {
            return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: error instanceof ToolError ?
                    error.content
                    : `Error: ${error instanceof Error ? error.message : String(error)}`,
                is_error: true,
            };
        }
    }));
    return {
        role: 'user',
        content: toolResults,
    };
}
//# sourceMappingURL=ToolRunner.js.map