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
import { ChatSession } from "../methods/chat-session";
import { generateContent, generateContentStream } from "../methods/generate-content";
import { countTokens } from "../methods/count-tokens";
import { embedContent, batchEmbedContents } from "../methods/embed-content";
import { formatSystemInstruction, formatGenerateContentInput } from "../content-helpers";
/**
 * Class for generative model APIs.
 * @public
 */
export class AllternitGenerativeModel {
    apiKey;
    _requestOptions;
    model;
    generationConfig;
    safetySettings;
    tools;
    toolConfig;
    systemInstruction;
    cachedContent;
    constructor(apiKey, modelParams, _requestOptions = {}) {
        this.apiKey = apiKey;
        this._requestOptions = _requestOptions;
        if (modelParams.model.includes("/")) {
            // Models may be named "models/model-name" or "tunedModels/model-name"
            this.model = modelParams.model;
        }
        else {
            // If path is not included, assume it's a non-tuned model.
            this.model = `models/${modelParams.model}`;
        }
        this.generationConfig = modelParams.generationConfig || {};
        this.safetySettings = modelParams.safetySettings || [];
        this.tools = modelParams.tools;
        this.toolConfig = modelParams.toolConfig;
        this.systemInstruction = formatSystemInstruction(modelParams.systemInstruction);
        this.cachedContent = modelParams.cachedContent;
    }
    /**
     * Makes a single non-streaming call to the model
     * and returns an object containing a single GenerateContentResponse.
     */
    async generateContent(request, requestOptions = {}) {
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        return generateContent(this.apiKey, this.model, {
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent?.name,
            ...formattedParams,
        }, generativeModelRequestOptions);
    }
    /**
     * Makes a single streaming call to the model and returns an object
     * containing an iterable stream that iterates over all chunks in the
     * streaming response as well as a promise that returns the final
     * aggregated response.
     */
    async generateContentStream(request, requestOptions = {}) {
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        return generateContentStream(this.apiKey, this.model, {
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent?.name,
            ...formattedParams,
        }, generativeModelRequestOptions);
    }
    /**
     * Gets a new ChatSession instance which can be used for
     * multi-turn chats.
     */
    startChat(startChatParams) {
        return new ChatSession(this.apiKey, this.model, {
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent?.name,
            ...startChatParams,
        }, this._requestOptions);
    }
    /**
     * Counts the tokens in the provided request.
     */
    async countTokens(request, requestOptions = {}) {
        const formattedParams = typeof request === "object" && "contents" in request
            ? request
            : { contents: [] };
        const generativeModelRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        const modelParams = {
            model: this.model,
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent,
        };
        return countTokens(this.apiKey, this.model, typeof request === "string" || Array.isArray(request)
            ? { contents: [] }
            : request, generativeModelRequestOptions, modelParams);
    }
    /**
     * Embeds the provided content.
     */
    async embedContent(request, requestOptions = {}) {
        const formattedParams = typeof request === "string" || Array.isArray(request)
            ? { content: { role: "user", parts: [] } }
            : request;
        const generativeModelRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        return embedContent(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
    }
    /**
     * Embeds an array of EmbedContentRequests.
     */
    async batchEmbedContents(batchEmbedContentRequest, requestOptions = {}) {
        const generativeModelRequestOptions = {
            ...this._requestOptions,
            ...requestOptions,
        };
        return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest, generativeModelRequestOptions);
    }
}
//# sourceMappingURL=generative-model.js.map