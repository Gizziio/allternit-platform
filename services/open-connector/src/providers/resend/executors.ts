import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";
import type { ResendActionName } from "./actions.ts";

import { optionalString, requiredString } from "../../core/cast.ts";
import { defineApiKeyProviderExecutors, ProviderRequestError, providerUserAgent } from "../provider-runtime.ts";

const service = "resend";
const resendApiBaseUrl = "https://api.resend.com";
const resendCredentialValidationErrors = new Set(["validation_error", "missing_required_field"]);

type ResendActionHandler = (input: Record<string, unknown>, context: ApiKeyProviderContext) => Promise<unknown>;

export const resendActionHandlers: Record<ResendActionName, ResendActionHandler> = {
  send_email(input, context) {
    return sendEmail(input, context);
  },
};

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, resendActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateResendCredential(input.apiKey, fetcher, signal);
  },
};

async function validateResendCredential(
  apiKey: string,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<CredentialValidationResult> {
  const validationResponse = await fetcher(`${resendApiBaseUrl}/emails`, {
    method: "POST",
    headers: resendHeaders(apiKey),
    body: JSON.stringify({}),
    signal,
  });
  const validationError = await readResendError(validationResponse);

  if (
    !validationResponse.ok &&
    (validationError.name === "invalid_api_key" || validationError.name === "missing_api_key")
  ) {
    throw new ProviderRequestError(401, validationError.message, validationError);
  }
  if (!validationResponse.ok && !resendCredentialValidationErrors.has(validationError.name)) {
    throw new ProviderRequestError(502, validationError.message, validationError);
  }

  const metadata: Record<string, unknown> = {
    validationEndpoint: "/emails",
  };
  const scopesResponse = await fetcher(`${resendApiBaseUrl}/api-keys?limit=1`, {
    headers: resendHeaders(apiKey),
    signal,
  });
  if (scopesResponse.ok) {
    metadata.accessLevel = "full_access";
    return {
      profile: {
        accountId: "resend-api-key",
        displayName: "Resend API Key",
        grantedScopes: ["full_access"],
      },
      grantedScopes: ["full_access"],
      metadata,
    };
  }

  const scopesError = await readResendError(scopesResponse);
  if (scopesError.name === "restricted_api_key") {
    metadata.accessLevel = "sending_access";
    return {
      profile: {
        accountId: "resend-api-key",
        displayName: "Resend API Key",
        grantedScopes: ["sending_access"],
      },
      grantedScopes: ["sending_access"],
      metadata,
    };
  }

  return {
    profile: {
      accountId: "resend-api-key",
      displayName: "Resend API Key",
      grantedScopes: [],
    },
    grantedScopes: [],
    metadata,
  };
}

async function sendEmail(input: Record<string, unknown>, context: ApiKeyProviderContext): Promise<unknown> {
  if (optionalString(input.html) === undefined && optionalString(input.text) === undefined) {
    throw new ProviderRequestError(400, "at least one email body field is required");
  }

  let response: Response;
  try {
    response = await context.fetcher(`${resendApiBaseUrl}/emails`, {
      method: "POST",
      headers: resendHeaders(context.apiKey),
      body: JSON.stringify(buildSendEmailBody(input)),
      signal: context.signal,
    });
  } catch (error) {
    throw new ProviderRequestError(
      502,
      error instanceof Error ? `Resend request failed: ${error.message}` : "Resend request failed",
    );
  }

  const payload = await readResendPayload(response);
  if (response.ok) {
    const emailId = optionalString(payload.id);
    if (!emailId) {
      throw new ProviderRequestError(502, "Resend send email response did not include id", payload);
    }
    return { emailId };
  }

  const error = parseResendError(response.status, payload);
  if (response.status === 429) {
    throw new ProviderRequestError(429, error.message, error);
  }
  if (error.name === "invalid_api_key" || error.name === "missing_api_key") {
    throw new ProviderRequestError(401, error.message, error);
  }
  throw new ProviderRequestError(response.status >= 500 ? 502 : 400, error.message, error);
}

function resendHeaders(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "user-agent": providerUserAgent,
  };
}

function buildSendEmailBody(input: Record<string, unknown>): Record<string, string> {
  return {
    from: requiredString(input.from, "from", inputError),
    to: requiredString(input.to, "to", inputError),
    subject: requiredString(input.subject, "subject", inputError),
    ...(typeof input.html === "string" ? { html: input.html } : {}),
    ...(typeof input.text === "string" ? { text: input.text } : {}),
  };
}

async function readResendPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { message: text };
  }
}

async function readResendError(response: Response): Promise<{ name: string; message: string }> {
  return parseResendError(response.status, await readResendPayload(response));
}

function parseResendError(status: number, payload: Record<string, unknown>): { name: string; message: string } {
  return {
    name: optionalString(payload.name) ?? optionalString(payload.error) ?? "provider_error",
    message:
      optionalString(payload.message) ??
      optionalString(payload.error_description) ??
      `Resend request failed with ${status}`,
  };
}

function inputError(message: string): ProviderRequestError {
  return new ProviderRequestError(400, message);
}
