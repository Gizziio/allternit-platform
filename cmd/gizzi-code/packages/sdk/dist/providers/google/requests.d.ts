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
import type { SingleRequestOptions } from "./types";
declare enum Task {
    GENERATE_CONTENT = "generateContent",
    STREAM_GENERATE_CONTENT = "streamGenerateContent",
    COUNT_TOKENS = "countTokens",
    EMBED_CONTENT = "embedContent",
    BATCH_EMBED_CONTENTS = "batchEmbedContents"
}
export declare function constructModelRequest(model: string, task: Task, apiKey: string, stream: boolean, body: string, requestOptions?: SingleRequestOptions): Promise<{
    url: string;
    fetchOptions: RequestInit;
}>;
export declare function makeModelRequest(model: string, task: Task, apiKey: string, stream: boolean, body: string, requestOptions?: SingleRequestOptions, fetchFn?: typeof fetch): Promise<Response>;
export { Task };
//# sourceMappingURL=requests.d.ts.map