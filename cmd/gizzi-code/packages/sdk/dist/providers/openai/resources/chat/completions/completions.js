// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../../core/resource';
import * as MessagesAPI from './messages';
import { Messages } from './messages';
import { CursorPage } from '../../../core/pagination';
import { path } from '../../../internal/utils/path';
import { ChatCompletionRunner } from '../../../lib/ChatCompletionRunner';
import { ChatCompletionStreamingRunner } from '../../../lib/ChatCompletionStreamingRunner';
import { ChatCompletionStream } from '../../../lib/ChatCompletionStream';
import { parseChatCompletion, validateInputTools } from '../../../lib/parser';
/**
 * Given a list of messages comprising a conversation, the model will return a response.
 */
export class Completions extends APIResource {
    messages = new MessagesAPI.Messages(this._client);
    create(body, options) {
        return this._client.post('/chat/completions', { body, ...options, stream: body.stream ?? false });
    }
    /**
     * Get a stored chat completion. Only Chat Completions that have been created with
     * the `store` parameter set to `true` will be returned.
     *
     * @example
     * ```ts
     * const chatCompletion =
     *   await client.chat.completions.retrieve('completion_id');
     * ```
     */
    retrieve(completionID, options) {
        return this._client.get(path `/chat/completions/${completionID}`, options);
    }
    /**
     * Modify a stored chat completion. Only Chat Completions that have been created
     * with the `store` parameter set to `true` can be modified. Currently, the only
     * supported modification is to update the `metadata` field.
     *
     * @example
     * ```ts
     * const chatCompletion = await client.chat.completions.update(
     *   'completion_id',
     *   { metadata: { foo: 'string' } },
     * );
     * ```
     */
    update(completionID, body, options) {
        return this._client.post(path `/chat/completions/${completionID}`, { body, ...options });
    }
    /**
     * List stored Chat Completions. Only Chat Completions that have been stored with
     * the `store` parameter set to `true` will be returned.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const chatCompletion of client.chat.completions.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/chat/completions', (CursorPage), { query, ...options });
    }
    /**
     * Delete a stored chat completion. Only Chat Completions that have been created
     * with the `store` parameter set to `true` can be deleted.
     *
     * @example
     * ```ts
     * const chatCompletionDeleted =
     *   await client.chat.completions.delete('completion_id');
     * ```
     */
    delete(completionID, options) {
        return this._client.delete(path `/chat/completions/${completionID}`, options);
    }
    parse(body, options) {
        validateInputTools(body.tools);
        return this._client.chat.completions
            .create(body, {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'chat.completions.parse',
            },
        })
            ._thenUnwrap((completion) => parseChatCompletion(completion, body));
    }
    runTools(body, options) {
        if (body.stream) {
            return ChatCompletionStreamingRunner.runTools(this._client, body, options);
        }
        return ChatCompletionRunner.runTools(this._client, body, options);
    }
    /**
     * Creates a chat completion stream
     */
    stream(body, options) {
        return ChatCompletionStream.createChatCompletion(this._client, body, options);
    }
}
export { ChatCompletionStreamingRunner } from '../../../lib/ChatCompletionStreamingRunner';
export { ParsingToolFunction, } from '../../../lib/RunnableFunction';
export { ChatCompletionStream } from '../../../lib/ChatCompletionStream';
export { ChatCompletionRunner } from '../../../lib/ChatCompletionRunner';
Completions.Messages = Messages;
//# sourceMappingURL=completions.js.map