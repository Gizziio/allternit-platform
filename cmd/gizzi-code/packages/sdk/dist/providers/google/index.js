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
/**
 * Allternit Google AI Provider
 *
 * A rebranded fork of the Google GenAI SDK (@google/generative-ai)
 * for use within the Allternit platform.
 *
 * @packageDocumentation
 */
// Export all types
export * from "./types";
// Export error classes (rebranded)
export { AllternitGoogleAIError, AllternitGoogleAIResponseError, AllternitGoogleAIFetchError, AllternitGoogleAIRequestInputError, AllternitGoogleAIAbortError, } from "./errors";
// Export main classes (rebranded)
export { AllternitGoogleAI, AllternitGenerativeModel, ChatSession } from "./gen-ai";
// ============================================================================
// Gemini Model Names (kept as-is for compatibility)
// ============================================================================
/**
 * Gemini 1.5 Flash - Fast and efficient multimodal model
 * @public
 */
export const GEMINI_1_5_FLASH = "gemini-1.5-flash";
/**
 * Gemini 1.5 Flash Latest - Latest version of Flash
 * @public
 */
export const GEMINI_1_5_FLASH_LATEST = "gemini-1.5-flash-latest";
/**
 * Gemini 1.5 Pro - Most capable multimodal model
 * @public
 */
export const GEMINI_1_5_PRO = "gemini-1.5-pro";
/**
 * Gemini 1.5 Pro Latest - Latest version of Pro
 * @public
 */
export const GEMINI_1_5_PRO_LATEST = "gemini-1.5-pro-latest";
/**
 * Gemini 1.0 Pro - Original Pro model
 * @public
 */
export const GEMINI_1_0_PRO = "gemini-1.0-pro";
/**
 * Gemini 1.0 Pro Latest - Latest version of 1.0 Pro
 * @public
 */
export const GEMINI_1_0_PRO_LATEST = "gemini-1.0-pro-latest";
/**
 * Gemini 1.0 Pro Vision - Vision-capable model
 * @public
 */
export const GEMINI_1_0_PRO_VISION = "gemini-1.0-pro-vision";
/**
 * Gemini 1.0 Pro Vision Latest - Latest version of Pro Vision
 * @public
 */
export const GEMINI_1_0_PRO_VISION_LATEST = "gemini-1.0-pro-vision-latest";
/**
 * Text Embedding 004 - Latest text embedding model
 * @public
 */
export const TEXT_EMBEDDING_004 = "text-embedding-004";
/**
 * Embedding 001 - Original embedding model
 * @public
 */
export const EMBEDDING_001 = "embedding-001";
/**
 * AQA (Attributed Question Answering) model
 * @public
 */
export const AQA_MODEL = "aqa";
// ============================================================================
// Version
// ============================================================================
/**
 * SDK Version
 * @public
 */
export const VERSION = "0.1.0";
/**
 * Provider name
 * @public
 */
export const PROVIDER_NAME = "allternit-google-ai";
//# sourceMappingURL=index.js.map