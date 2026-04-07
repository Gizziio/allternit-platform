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
import type { ErrorDetails } from "./types";
/**
 * Basic error type for this SDK.
 * @public
 */
export declare class AllternitGoogleAIError extends Error {
    constructor(message: string);
}
/**
 * Errors in the contents of a response from the model. This includes parsing
 * errors, or responses including a safety block reason.
 * @public
 */
export declare class AllternitGoogleAIResponseError<T> extends AllternitGoogleAIError {
    response?: T;
    constructor(message: string, response?: T);
}
/**
 * Error class covering HTTP errors when calling the server. Includes HTTP
 * status, statusText, and optional details, if provided in the server response.
 * @public
 */
export declare class AllternitGoogleAIFetchError extends AllternitGoogleAIError {
    status?: number;
    statusText?: string;
    errorDetails?: ErrorDetails[];
    constructor(message: string, status?: number, statusText?: string, errorDetails?: ErrorDetails[]);
}
/**
 * Errors in the contents of a request originating from user input.
 * @public
 */
export declare class AllternitGoogleAIRequestInputError extends AllternitGoogleAIError {
}
/**
 * Error thrown when a request is aborted, either due to a timeout or
 * intentional cancellation by the user.
 * @public
 */
export declare class AllternitGoogleAIAbortError extends AllternitGoogleAIError {
}
//# sourceMappingURL=errors.d.ts.map