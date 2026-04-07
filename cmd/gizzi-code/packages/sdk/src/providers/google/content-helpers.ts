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

import { AllternitGoogleAIError, AllternitGoogleAIRequestInputError } from "./errors";
import {
  POSSIBLE_ROLES,
  type Content,
  type Part,
  type GenerateContentRequest,
  type _GenerateContentRequestInternal,
  type CountTokensRequest,
  type EmbedContentRequest,
  type ModelParams,
} from "./types";

export function formatSystemInstruction(
  input: string | Part | Content | null | undefined
): Content | undefined {
  if (input == null) {
    return undefined;
  } else if (typeof input === "string") {
    return { role: "system", parts: [{ text: input }] };
  } else if ((input as Part).text) {
    return { role: "system", parts: [input as Part] };
  } else if ((input as Content).parts) {
    if (!(input as Content).role) {
      return { role: "system", parts: (input as Content).parts };
    } else {
      return input as Content;
    }
  }
  return undefined;
}

export function formatNewContent(
  request: string | Array<string | Part>
): Content {
  const newParts: Part[] = [];
  if (typeof request === "string") {
    newParts.push({ text: request });
  } else {
    for (const partOrString of request) {
      if (typeof partOrString === "string") {
        newParts.push({ text: partOrString });
      } else {
        newParts.push(partOrString);
      }
    }
  }
  return assignRoleToPartsAndValidateSendMessageRequest(newParts);
}

/**
 * When multiple Part types are passed in a single Part array, we may need to assign
 * different roles to each part.
 */
function assignRoleToPartsAndValidateSendMessageRequest(parts: Part[]): Content {
  const userContent: Content = { role: "user", parts: [] };
  const functionContent: Content = { role: "function", parts: [] };
  let hasUserContent = false;
  let hasFunctionContent = false;

  for (const part of parts) {
    if ("functionResponse" in part) {
      functionContent.parts.push(part);
      hasFunctionContent = true;
    } else {
      userContent.parts.push(part);
      hasUserContent = true;
    }
  }

  if (hasUserContent && hasFunctionContent) {
    throw new AllternitGoogleAIError(
      "Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message."
    );
  }
  if (!hasUserContent && !hasFunctionContent) {
    throw new AllternitGoogleAIError("No content is provided for sending chat message.");
  }

  return hasUserContent ? userContent : functionContent;
}

export function formatCountTokensInput(
  params: CountTokensRequest | string | Array<string | Part>,
  modelParams?: ModelParams
): { generateContentRequest: _GenerateContentRequestInternal } {
  let formattedGenerateContentRequest: _GenerateContentRequestInternal = {
    model: modelParams?.model,
    generationConfig: modelParams?.generationConfig,
    safetySettings: modelParams?.safetySettings,
    tools: modelParams?.tools,
    toolConfig: modelParams?.toolConfig,
    systemInstruction: modelParams?.systemInstruction,
    cachedContent: modelParams?.cachedContent?.name,
    contents: [],
  };

  const containsGenerateContentRequest =
    typeof params === "object" && "generateContentRequest" in params && params.generateContentRequest != null;

  if (typeof params === "object" && "contents" in params && params.contents) {
    if (containsGenerateContentRequest) {
      throw new AllternitGoogleAIRequestInputError(
        "CountTokensRequest must have one of contents or generateContentRequest, not both."
      );
    }
    formattedGenerateContentRequest.contents = params.contents;
  } else if (containsGenerateContentRequest) {
    formattedGenerateContentRequest = {
      ...formattedGenerateContentRequest,
      ...params.generateContentRequest,
    };
  } else {
    // Array or string
    const content = formatNewContent(params as string | Array<string | Part>);
    formattedGenerateContentRequest.contents = [content];
  }

  return { generateContentRequest: formattedGenerateContentRequest };
}

export function formatGenerateContentInput(
  params: GenerateContentRequest | string | Array<string | Part>
): GenerateContentRequest {
  let formattedRequest: GenerateContentRequest;
  if (typeof params === "object" && "contents" in params && params.contents) {
    formattedRequest = params;
  } else {
    // Array or string
    const content = formatNewContent(params as string | Array<string | Part>);
    formattedRequest = { contents: [content] };
  }

  // Handle systemInstruction if present
  if (typeof params === "object" && "systemInstruction" in params && params.systemInstruction) {
    formattedRequest.systemInstruction = formatSystemInstruction(
      params.systemInstruction
    );
  }

  return formattedRequest;
}

export function formatEmbedContentInput(
  params: EmbedContentRequest | string | Array<string | Part>
): EmbedContentRequest {
  if (typeof params === "string" || Array.isArray(params)) {
    const content = formatNewContent(params);
    return { content };
  }
  return params;
}

// https://ai.google.dev/api/rest/v1beta/Content#part
const VALID_PART_FIELDS = [
  "text",
  "inlineData",
  "functionCall",
  "functionResponse",
  "executableCode",
  "codeExecutionResult",
];

const VALID_PARTS_PER_ROLE: Record<string, string[]> = {
  user: ["text", "inlineData"],
  function: ["functionResponse"],
  model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
  system: ["text"],
};

export function validateChatHistory(history: Content[]): void {
  let prevContent = false;
  for (const currContent of history) {
    const { role, parts } = currContent;

    if (!prevContent && role !== "user") {
      throw new AllternitGoogleAIError(
        `First content should be with role 'user', got ${role}`
      );
    }

    if (!POSSIBLE_ROLES.includes(role as any)) {
      throw new AllternitGoogleAIError(
        `Each item should include role field. Got ${role} but valid roles are: ${JSON.stringify(
          POSSIBLE_ROLES
        )}`
      );
    }

    if (!Array.isArray(parts)) {
      throw new AllternitGoogleAIError(
        "Content should have 'parts' property with an array of Parts"
      );
    }

    if (parts.length === 0) {
      throw new AllternitGoogleAIError("Each Content should have at least one part");
    }

    const countFields: Record<string, number> = {
      text: 0,
      inlineData: 0,
      functionCall: 0,
      functionResponse: 0,
      fileData: 0,
      executableCode: 0,
      codeExecutionResult: 0,
    };

    for (const part of parts) {
      for (const key of VALID_PART_FIELDS) {
        if (key in part) {
          countFields[key] += 1;
        }
      }
    }

    const validParts = VALID_PARTS_PER_ROLE[role];
    for (const key of VALID_PART_FIELDS) {
      if (!validParts.includes(key) && countFields[key] > 0) {
        throw new AllternitGoogleAIError(
          `Content with role '${role}' can't contain '${key}' part`
        );
      }
    }

    prevContent = true;
  }
}

/**
 * Returns true if the response is valid (could be appended to the history).
 */
export function isValidResponse(response: {
  candidates?: { content?: { parts?: unknown[] } }[];
}): boolean {
  if (response.candidates === undefined || response.candidates.length === 0) {
    return false;
  }

  const content = response.candidates[0]?.content;
  if (content === undefined) {
    return false;
  }

  if (content.parts === undefined || content.parts.length === 0) {
    return false;
  }

  for (const part of content.parts) {
    if (part === undefined || Object.keys(part).length === 0) {
      return false;
    }
    if ((part as any).text !== undefined && (part as any).text === "") {
      return false;
    }
  }

  return true;
}
