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
import { formatNewContent, validateChatHistory, isValidResponse, } from "../content-helpers";
import { formatBlockErrorMessage } from "../response-helpers";
import { generateContent, generateContentStream } from "./generate-content";
const SILENT_ERROR = "SILENT_ERROR";
/**
 * ChatSession class that enables sending chat messages and stores
 * history of sent and received messages so far.
 * @public
 */
export class ChatSession {
    model;
    params;
    _requestOptions;
    _history = [];
    _sendPromise = Promise.resolve();
    _apiKey;
    constructor(apiKey, model, params, _requestOptions = {}) {
        this.model = model;
        this.params = params;
        this._requestOptions = _requestOptions;
        this._apiKey = apiKey;
        if (params?.history) {
            validateChatHistory(params.history);
            this._history = params.history;
        }
    }
    /**
     * Gets the chat history so far. Blocked prompts are not added to history.
     * Blocked candidates are not added to history, nor are the prompts that
     * generated them.
     */
    async getHistory() {
        await this._sendPromise;
        return this._history;
    }
    /**
     * Sends a chat message and receives a non-streaming GenerateContentResult.
     */
    async sendMessage(request, requestOptions = {}) {
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: this.params?.safetySettings,
            generationConfig: this.params?.generationConfig,
            tools: this.params?.tools,
            toolConfig: this.params?.toolConfig,
            systemInstruction: this.params?.systemInstruction,
            cachedContent: this.params?.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        let finalResult;
        this._sendPromise = this._sendPromise
            .then(() => generateContent(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions))
            .then((result) => {
            if (isValidResponse(result.response)) {
                this._history.push(newContent);
                const responseContent = {
                    parts: [],
                    role: "model",
                    ...result.response.candidates?.[0].content,
                };
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(result.response);
                if (blockErrorMessage) {
                    console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
            finalResult = result;
        })
            .catch((e) => {
            this._sendPromise = Promise.resolve();
            throw e;
        });
        await this._sendPromise;
        return finalResult;
    }
    /**
     * Sends a chat message and receives the response as a
     * GenerateContentStreamResult containing an iterable stream
     * and a response promise.
     */
    async sendMessageStream(request, requestOptions = {}) {
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: this.params?.safetySettings,
            generationConfig: this.params?.generationConfig,
            tools: this.params?.tools,
            toolConfig: this.params?.toolConfig,
            systemInstruction: this.params?.systemInstruction,
            cachedContent: this.params?.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions);
        this._sendPromise = this._sendPromise
            .then(() => streamPromise)
            .catch(() => {
            throw new Error(SILENT_ERROR);
        })
            .then((streamResult) => streamResult.response)
            .then((response) => {
            if (isValidResponse(response)) {
                this._history.push(newContent);
                const responseContent = {
                    ...response.candidates[0].content,
                };
                if (!responseContent.role) {
                    responseContent.role = "model";
                }
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(response);
                if (blockErrorMessage) {
                    console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
        })
            .catch((e) => {
            if (e.message !== SILENT_ERROR) {
                console.error(e);
            }
        });
        return streamPromise;
    }
}
//# sourceMappingURL=chat-session.js.map