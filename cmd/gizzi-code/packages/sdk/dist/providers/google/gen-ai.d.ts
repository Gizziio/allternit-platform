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
import type { CachedContent, ModelParams, RequestOptions } from "./types";
export { ChatSession } from "./methods/chat-session";
export { AllternitGenerativeModel };
/**
 * Top-level class for the Allternit Google AI SDK
 * @public
 */
export declare class AllternitGoogleAI {
    apiKey: string;
    constructor(apiKey: string);
    /**
     * Gets an AllternitGenerativeModel instance for the provided model name.
     */
    getGenerativeModel(modelParams: ModelParams, requestOptions?: RequestOptions): AllternitGenerativeModel;
    /**
     * Creates an AllternitGenerativeModel instance from provided content cache.
     */
    getGenerativeModelFromCachedContent(cachedContent: CachedContent, modelParams?: Partial<ModelParams>, requestOptions?: RequestOptions): AllternitGenerativeModel;
}
//# sourceMappingURL=gen-ai.d.ts.map