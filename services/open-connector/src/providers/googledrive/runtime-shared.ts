import type { ProviderFetch } from "../provider-runtime.ts";

import {
  compactObject,
  optionalBoolean,
  optionalIntegerLike,
  optionalRecord,
  optionalString,
  pickOptionalBoolean,
  pickOptionalInteger,
  pickOptionalString,
  requiredRecord,
  stringArray,
} from "../../core/cast.ts";
import { providerUserAgent, ProviderRequestError } from "../provider-runtime.ts";

export {
  compactObject,
  optionalBoolean,
  optionalIntegerLike as asOptionalInteger,
  optionalRecord as asOptionalObject,
  optionalString,
  pickOptionalBoolean,
  pickOptionalInteger,
  pickOptionalString,
  requiredRecord,
  stringArray,
};

export type GoogleQueryValue = string | readonly string[] | undefined;

const service = "googledrive";
const googleDefaultRequestTimeoutMs = 30_000;

export async function googleJsonRequest<T>(
  url: string,
  input: {
    accessToken: string;
    fetcher: ProviderFetch;
    signal?: AbortSignal;
    method?: string;
    query?: Record<string, GoogleQueryValue>;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    timeoutMs?: number;
  },
): Promise<T> {
  const response = await googleRequest(url, input);
  return (await response.json()) as T;
}

export async function googleRequest(
  url: string,
  input: {
    accessToken: string;
    fetcher: ProviderFetch;
    signal?: AbortSignal;
    method?: string;
    query?: Record<string, GoogleQueryValue>;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    timeoutMs?: number;
  },
): Promise<Response> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        target.searchParams.append(key, item);
      }
      continue;
    }
    if (typeof value === "string") {
      target.searchParams.set(key, value);
    }
  }

  const headers = {
    authorization: `Bearer ${input.accessToken}`,
    "user-agent": providerUserAgent,
    ...(input.headers ?? {}),
  };
  const hasJsonBody = input.rawBody == null && input.body !== undefined;
  const hasRequestBody = input.rawBody != null || hasJsonBody;
  const method = (input.method ?? (hasRequestBody ? "POST" : "GET")).toUpperCase();
  if ((method === "GET" || method === "HEAD") && hasRequestBody) {
    throw new ProviderRequestError(400, `${service} ${method} request must not include a body`);
  }

  const requestInit: RequestInit = {
    method,
    headers:
      hasJsonBody && !hasContentTypeHeader(headers)
        ? {
            ...headers,
            "content-type": "application/json",
          }
        : headers,
    signal: input.signal,
    ...(input.rawBody != null ? { body: input.rawBody } : hasJsonBody ? { body: JSON.stringify(input.body) } : {}),
  };
  const response = await googleFetchWithTimeout(target.toString(), {
    fetcher: input.fetcher,
    timeoutMs: input.timeoutMs ?? googleDefaultRequestTimeoutMs,
    init: requestInit,
  });

  await assertGoogleResponse(response);
  return response;
}

export function resolveFileId(input: Record<string, unknown>): string {
  const value = optionalString(input.fileId);
  if (!value) {
    throw new ProviderRequestError(400, "fileId is required");
  }
  return extractFileId(value);
}

export function resolveSupportsAllDrives(input: Record<string, unknown>): boolean {
  return optionalBoolean(input.includeSharedDrives) ?? optionalBoolean(input.supportsAllDrives) ?? true;
}

export function resolveRequiredString(input: Record<string, unknown>, keys: string[], message: string): string {
  const value = pickOptionalString(input, ...keys);
  if (!value) {
    throw new ProviderRequestError(400, message);
  }
  return value;
}

export function asStringRecord(value: unknown): Record<string, string> {
  const record = requiredRecord(value, "string map input", (message) => new ProviderRequestError(400, message));
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, String(child)]));
}

export function asStringRecordOrUndefined(value: unknown): Record<string, string> | undefined {
  if (value == null) {
    return undefined;
  }
  return asStringRecord(value);
}

export function optionalNestedString(value: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return optionalString(current);
}

export function parseSizeBytes(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function compactUnknownObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return compactObject(value);
}

export function asObject(value: unknown): Record<string, unknown> {
  return requiredRecord(value, "object input", (message) => new ProviderRequestError(400, message));
}

export function asStringArray(value: unknown): string[] {
  return stringArray(value, "string array", (message) => new ProviderRequestError(400, message));
}

async function googleFetchWithTimeout(
  url: string | URL,
  input: {
    fetcher: ProviderFetch;
    timeoutMs?: number;
    init?: RequestInit;
  },
): Promise<Response> {
  const timeoutMs = input.timeoutMs ?? googleDefaultRequestTimeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return input.fetcher(url, input.init);
  }

  const controller = new AbortController();
  const parentSignal = input.init?.signal;
  let didTimeout = false;
  const timeoutHandle = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  const abortFromParent = (): void => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) {
      abortFromParent();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  try {
    return await input.fetcher(url, {
      ...(input.init ?? {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout && isAbortLikeError(error)) {
      throw new ProviderRequestError(
        502,
        `${service} request timed out after ${Math.max(1, Math.ceil(timeoutMs / 1000))} seconds`,
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutHandle);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  }
}

function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
}

async function assertGoogleResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const { message, details } = await extractGoogleError(response);
  throw new ProviderRequestError(response.status, message, details);
}

async function extractGoogleError(response: Response): Promise<{ message: string; details: unknown }> {
  const rawText = await response.text().catch(() => "");
  if (!rawText) {
    return {
      message: `${service} request failed with ${response.status}`,
      details: { status: response.status },
    };
  }

  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const error = optionalRecord(parsed.error);
    const message = optionalString(error?.message) ?? optionalString(parsed.error_description) ?? rawText;
    return {
      message,
      details: parsed,
    };
  } catch {
    return {
      message: rawText,
      details: rawText,
    };
  }
}

function extractFileId(value: string): string {
  const normalizedValue = value.trim();
  const maybeId = extractIdFromGoogleUrl(normalizedValue);
  return maybeId ?? normalizedValue;
}

function extractIdFromGoogleUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return idFromQuery;
    }
    const match = url
      .toString()
      .match(
        /\/(?:document|spreadsheets|presentation)(?:\/u\/\d+)?\/d\/([^/?#]+)|\/file(?:\/u\/\d+)?\/d\/([^/?#]+)|\/folders\/([^/?#]+)/,
      );
    return match?.[1] ?? match?.[2] ?? match?.[3];
  } catch {
    return undefined;
  }
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
