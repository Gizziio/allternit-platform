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

import {
  AllternitGoogleAIError,
  AllternitGoogleAIAbortError,
  AllternitGoogleAIFetchError,
  AllternitGoogleAIRequestInputError,
} from "./errors";
import type { RequestOptions, SingleRequestOptions } from "./types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
const PACKAGE_VERSION = "0.24.1";
const PACKAGE_LOG_HEADER = "allternit-google-ai";

enum Task {
  GENERATE_CONTENT = "generateContent",
  STREAM_GENERATE_CONTENT = "streamGenerateContent",
  COUNT_TOKENS = "countTokens",
  EMBED_CONTENT = "embedContent",
  BATCH_EMBED_CONTENTS = "batchEmbedContents",
}

class RequestUrl {
  constructor(
    public model: string,
    public task: Task,
    public apiKey: string,
    public stream: boolean,
    public requestOptions?: RequestOptions
  ) {}

  toString(): string {
    const apiVersion = this.requestOptions?.apiVersion || DEFAULT_API_VERSION;
    const baseUrl = this.requestOptions?.baseUrl || DEFAULT_BASE_URL;
    let url = `${baseUrl}/${apiVersion}/${this.model}:${this.task}`;
    if (this.stream) {
      url += "?alt=sse";
    }
    return url;
  }
}

function getClientHeaders(requestOptions?: RequestOptions): string {
  const clientHeaders: string[] = [];
  if (requestOptions?.apiClient) {
    clientHeaders.push(requestOptions.apiClient);
  }
  clientHeaders.push(`${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`);
  return clientHeaders.join(" ");
}

async function getHeaders(url: RequestUrl): Promise<Headers> {
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("x-goog-api-client", getClientHeaders(url.requestOptions));
  headers.append("x-goog-api-key", url.apiKey);

  let customHeaders = url.requestOptions?.customHeaders;
  if (customHeaders) {
    if (!(customHeaders instanceof Headers)) {
      try {
        customHeaders = new Headers(customHeaders);
      } catch (e: any) {
        throw new AllternitGoogleAIRequestInputError(
          `unable to convert customHeaders value ${JSON.stringify(
            customHeaders
          )} to Headers: ${e.message}`
        );
      }
    }
    for (const [headerName, headerValue] of customHeaders.entries()) {
      if (headerName === "x-goog-api-key") {
        throw new AllternitGoogleAIRequestInputError(
          `Cannot set reserved header name ${headerName}`
        );
      } else if (headerName === "x-goog-api-client") {
        throw new AllternitGoogleAIRequestInputError(
          `Header name ${headerName} can only be set using the apiClient field`
        );
      }
      headers.append(headerName, headerValue);
    }
  }
  return headers;
}

function buildFetchOptions(requestOptions?: SingleRequestOptions): RequestInit {
  const fetchOptions: RequestInit = {};
  if (requestOptions?.signal !== undefined || (requestOptions?.timeout ?? -1) >= 0) {
    const controller = new AbortController();
    if ((requestOptions?.timeout ?? -1) >= 0) {
      setTimeout(() => controller.abort(), requestOptions!.timeout);
    }
    if (requestOptions?.signal) {
      requestOptions.signal.addEventListener("abort", () => {
        controller.abort();
      });
    }
    fetchOptions.signal = controller.signal;
  }
  return fetchOptions;
}

export async function constructModelRequest(
  model: string,
  task: Task,
  apiKey: string,
  stream: boolean,
  body: string,
  requestOptions?: SingleRequestOptions
): Promise<{ url: string; fetchOptions: RequestInit }> {
  const url = new RequestUrl(model, task, apiKey, stream, requestOptions);
  return {
    url: url.toString(),
    fetchOptions: {
      ...buildFetchOptions(requestOptions),
      method: "POST",
      headers: await getHeaders(url),
      body,
    },
  };
}

function handleResponseError(e: Error, url: string): never {
  let err: Error = e;
  if ((err as any).name === "AbortError") {
    err = new AllternitGoogleAIAbortError(
      `Request aborted when fetching ${url}: ${e.message}`
    );
    err.stack = e.stack;
  } else if (
    !(e instanceof AllternitGoogleAIFetchError) &&
    !(e instanceof AllternitGoogleAIRequestInputError)
  ) {
    err = new AllternitGoogleAIError(
      `Error fetching from ${url}: ${e.message}`
    );
    err.stack = e.stack;
  }
  throw err;
}

async function handleResponseNotOk(
  response: Response,
  url: string
): Promise<never> {
  let message = "";
  let errorDetails;
  try {
    const json = await response.json();
    message = json.error?.message || "";
    if (json.error?.details) {
      message += ` ${JSON.stringify(json.error.details)}`;
      errorDetails = json.error.details;
    }
  } catch (e) {
    // ignored
  }
  throw new AllternitGoogleAIFetchError(
    `Error fetching from ${url}: [${response.status} ${response.statusText}] ${message}`,
    response.status,
    response.statusText,
    errorDetails
  );
}

async function makeRequest(
  url: string,
  fetchOptions: RequestInit,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, fetchOptions);
  } catch (e: any) {
    handleResponseError(e, url);
  }
  if (!response.ok) {
    await handleResponseNotOk(response, url);
  }
  return response;
}

export async function makeModelRequest(
  model: string,
  task: Task,
  apiKey: string,
  stream: boolean,
  body: string,
  requestOptions: SingleRequestOptions = {},
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  const { url, fetchOptions } = await constructModelRequest(
    model,
    task,
    apiKey,
    stream,
    body,
    requestOptions
  );
  return makeRequest(url, fetchOptions, fetchFn);
}

export { Task };
