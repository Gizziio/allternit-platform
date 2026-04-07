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
import type { Content, StartChatParams, GenerateContentResult, GenerateContentStreamResult, SingleRequestOptions } from "../types";
/**
 * ChatSession class that enables sending chat messages and stores
 * history of sent and received messages so far.
 * @public
 */
export declare class ChatSession {
    model: string;
    params?: StartChatParams;
    private _requestOptions;
    private _history;
    private _sendPromise;
    private _apiKey;
    constructor(apiKey: string, model: string, params?: StartChatParams, _requestOptions?: SingleRequestOptions);
    /**
     * Gets the chat history so far. Blocked prompts are not added to history.
     * Blocked candidates are not added to history, nor are the prompts that
     * generated them.
     */
    getHistory(): Promise<Content[]>;
    /**
     * Sends a chat message and receives a non-streaming GenerateContentResult.
     */
    sendMessage(request: string | Array<string | Part>, requestOptions?: SingleRequestOptions): Promise<GenerateContentResult>;
    /**
     * Sends a chat message and receives the response as a
     * GenerateContentStreamResult containing an iterable stream
     * and a response promise.
     */
    sendMessageStream(request: string | Array<string | Part>, requestOptions?: SingleRequestOptions): Promise<GenerateContentStreamResult>;
}
import type { Part } from "../types";
//# sourceMappingURL=chat-session.d.ts.map