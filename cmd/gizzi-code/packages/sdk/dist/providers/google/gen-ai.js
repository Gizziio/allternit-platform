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
import { AllternitGenerativeModel } from "./models/generative-model";
import { AllternitGoogleAIError, AllternitGoogleAIRequestInputError } from "./errors";
export { ChatSession } from "./methods/chat-session";
export { AllternitGenerativeModel };
/**
 * Top-level class for the Allternit Google AI SDK
 * @public
 */
export class AllternitGoogleAI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Gets an AllternitGenerativeModel instance for the provided model name.
     */
    getGenerativeModel(modelParams, requestOptions) {
        if (!modelParams.model) {
            throw new AllternitGoogleAIError(`Must provide a model name. ` +
                `Example: genai.getGenerativeModel({ model: 'gemini-1.5-flash' })`);
        }
        return new AllternitGenerativeModel(this.apiKey, modelParams, requestOptions);
    }
    /**
     * Creates an AllternitGenerativeModel instance from provided content cache.
     */
    getGenerativeModelFromCachedContent(cachedContent, modelParams, requestOptions) {
        if (!cachedContent.name) {
            throw new AllternitGoogleAIRequestInputError("Cached content must contain a `name` field.");
        }
        if (!cachedContent.model) {
            throw new AllternitGoogleAIRequestInputError("Cached content must contain a `model` field.");
        }
        const disallowedDuplicates = ["model", "systemInstruction"];
        for (const key of disallowedDuplicates) {
            if (modelParams?.[key] &&
                cachedContent[key] &&
                modelParams[key] !==
                    cachedContent[key]) {
                if (key === "model") {
                    const modelParamsComp = modelParams.model.startsWith("models/")
                        ? modelParams.model.replace("models/", "")
                        : modelParams.model;
                    const cachedContentComp = cachedContent.model.startsWith("models/")
                        ? cachedContent.model.replace("models/", "")
                        : cachedContent.model;
                    if (modelParamsComp === cachedContentComp) {
                        continue;
                    }
                }
                throw new AllternitGoogleAIRequestInputError(`Different value for "${key}" specified in modelParams` +
                    ` (${modelParams[key]}) and cachedContent (${cachedContent[key]})`);
            }
        }
        const modelParamsFromCache = {
            ...modelParams,
            model: cachedContent.model,
            tools: cachedContent.tools,
            toolConfig: cachedContent.toolConfig,
            systemInstruction: cachedContent.systemInstruction,
            cachedContent,
        };
        return new AllternitGenerativeModel(this.apiKey, modelParamsFromCache, requestOptions);
    }
}
//# sourceMappingURL=gen-ai.js.map