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
import { type Content, type Part, type GenerateContentRequest, type _GenerateContentRequestInternal, type CountTokensRequest, type EmbedContentRequest, type ModelParams } from "./types";
export declare function formatSystemInstruction(input: string | Part | Content | null | undefined): Content | undefined;
export declare function formatNewContent(request: string | Array<string | Part>): Content;
export declare function formatCountTokensInput(params: CountTokensRequest | string | Array<string | Part>, modelParams?: ModelParams): {
    generateContentRequest: _GenerateContentRequestInternal;
};
export declare function formatGenerateContentInput(params: GenerateContentRequest | string | Array<string | Part>): GenerateContentRequest;
export declare function formatEmbedContentInput(params: EmbedContentRequest | string | Array<string | Part>): EmbedContentRequest;
export declare function validateChatHistory(history: Content[]): void;
/**
 * Returns true if the response is valid (could be appended to the history).
 */
export declare function isValidResponse(response: {
    candidates?: {
        content?: {
            parts?: unknown[];
        };
    }[];
}): boolean;
//# sourceMappingURL=content-helpers.d.ts.map