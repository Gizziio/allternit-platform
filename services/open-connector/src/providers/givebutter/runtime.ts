import type { CredentialValidationResult } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";
import type { GivebutterActionName } from "./actions.ts";

import { optionalInteger, optionalRecord, optionalString } from "../../core/cast.ts";
import { providerUserAgent, ProviderRequestError } from "../provider-runtime.ts";

export const givebutterApiBaseUrl = "https://api.givebutter.com/v1";
const givebutterValidationPath = "/campaigns";

type GivebutterPhase = "validate" | "execute";
type GivebutterQueryValue = string | number | boolean | undefined;
type GivebutterActionHandler = (input: Record<string, unknown>, context: ApiKeyProviderContext) => Promise<unknown>;

const listResources = {
  list_campaigns: { path: "/campaigns", outputKey: "campaigns" },
  list_contacts: { path: "/contacts", outputKey: "contacts" },
  list_transactions: { path: "/transactions", outputKey: "transactions" },
  list_funds: { path: "/funds", outputKey: "funds" },
  list_recurring_plans: { path: "/plans", outputKey: "recurringPlans" },
  list_chapters: { path: "/chapters", outputKey: "chapters" },
} satisfies Partial<Record<GivebutterActionName, { path: string; outputKey: string }>>;

const getResources = {
  get_campaign: { path: "/campaigns", inputKey: "campaignId", outputKey: "campaign" },
  get_contact: { path: "/contacts", inputKey: "contactId", outputKey: "contact" },
  get_transaction: { path: "/transactions", inputKey: "transactionId", outputKey: "transaction" },
  get_fund: { path: "/funds", inputKey: "fundId", outputKey: "fund" },
  get_recurring_plan: { path: "/plans", inputKey: "recurringPlanId", outputKey: "recurringPlan" },
  get_chapter: { path: "/chapters", inputKey: "chapterId", outputKey: "chapter" },
} satisfies Partial<Record<GivebutterActionName, { path: string; inputKey: string; outputKey: string }>>;

export const givebutterActionHandlers = Object.fromEntries([
  ...Object.entries(listResources).map(([name, config]) => [
    name,
    (input: Record<string, unknown>, context: ApiKeyProviderContext) => listGivebutterResource(input, context, config),
  ]),
  ...Object.entries(getResources).map(([name, config]) => [
    name,
    (input: Record<string, unknown>, context: ApiKeyProviderContext) => getGivebutterResource(input, context, config),
  ]),
]) as Record<GivebutterActionName, GivebutterActionHandler>;

export async function validateGivebutterCredential(
  input: { apiKey: string },
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<CredentialValidationResult> {
  await requestGivebutterJson(
    {
      path: givebutterValidationPath,
      query: { per_page: 1 },
    },
    input.apiKey,
    fetcher,
    "validate",
    signal,
  );

  return {
    profile: {
      accountId: "givebutter",
      displayName: "Givebutter API Key",
    },
    grantedScopes: [],
    metadata: {
      apiBaseUrl: givebutterApiBaseUrl,
      validationEndpoint: givebutterValidationPath,
    },
  };
}

async function listGivebutterResource(
  input: Record<string, unknown>,
  context: ApiKeyProviderContext,
  config: { path: string; outputKey: string },
): Promise<unknown> {
  const payload = await requestGivebutterJson(
    {
      path: config.path,
      query: buildListQuery(input),
    },
    context.apiKey,
    context.fetcher,
    "execute",
    context.signal,
  );

  const data = Array.isArray(payload.data) ? payload.data : [];
  return {
    [config.outputKey]: data,
    links: optionalRecord(payload.links) ?? {},
    meta: optionalRecord(payload.meta) ?? {},
    raw: payload,
  };
}

async function getGivebutterResource(
  input: Record<string, unknown>,
  context: ApiKeyProviderContext,
  config: { path: string; inputKey: string; outputKey: string },
): Promise<unknown> {
  const id = readRequiredResourceId(input[config.inputKey], config.inputKey);
  const payload = await requestGivebutterJson(
    {
      path: `${config.path}/${encodeURIComponent(id)}`,
    },
    context.apiKey,
    context.fetcher,
    "execute",
    context.signal,
  );

  return {
    [config.outputKey]: optionalRecord(payload.data) ?? payload,
    raw: payload,
  };
}

async function requestGivebutterJson(
  input: {
    path: string;
    query?: Record<string, GivebutterQueryValue>;
  },
  apiKey: string,
  fetcher: typeof fetch,
  phase: GivebutterPhase,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetcher(buildGivebutterUrl(input), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey.trim()}`,
        "user-agent": providerUserAgent,
      },
      signal,
    });
  } catch (error) {
    throw new ProviderRequestError(
      502,
      error instanceof Error ? `Givebutter request failed: ${error.message}` : "Givebutter request failed",
      error,
    );
  }

  const payload = await readGivebutterPayload(response);
  if (!response.ok) {
    throw createGivebutterError(response.status, payload, phase);
  }

  const record = optionalRecord(payload);
  if (!record) {
    throw new ProviderRequestError(502, "Givebutter response was not a JSON object");
  }

  return record;
}

function buildGivebutterUrl(input: { path: string; query?: Record<string, GivebutterQueryValue> }): URL {
  const url = new URL(`${givebutterApiBaseUrl}${input.path}`);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function buildListQuery(input: Record<string, unknown>): Record<string, GivebutterQueryValue> {
  const query: Record<string, GivebutterQueryValue> = {};
  const extraQuery = optionalRecord(input.query);
  for (const [key, value] of Object.entries(extraQuery ?? {})) {
    if (key === "page" || key === "per_page") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      query[key] = value;
    }
  }

  const page = optionalInteger(input.page);
  const perPage = optionalInteger(input.perPage);
  if (page !== undefined) {
    query.page = page;
  }
  if (perPage !== undefined) {
    query.per_page = perPage;
  }

  return query;
}

async function readGivebutterPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderRequestError(502, "Givebutter response was not valid JSON");
  }
}

function createGivebutterError(status: number, payload: unknown, phase: GivebutterPhase): ProviderRequestError {
  const message = readGivebutterMessage(payload) ?? `Givebutter request failed with ${status}`;

  if (status === 429) {
    return new ProviderRequestError(429, message, payload);
  }
  if (phase === "validate" && status >= 400 && status < 500) {
    return new ProviderRequestError(400, message, payload);
  }
  if (phase === "execute" && (status === 401 || status === 403)) {
    return new ProviderRequestError(status, message, payload);
  }
  if (phase === "execute" && status >= 400 && status < 500) {
    return new ProviderRequestError(400, message, payload);
  }

  return new ProviderRequestError(status || 502, message, payload);
}

function readGivebutterMessage(payload: unknown): string | undefined {
  const record = optionalRecord(payload);
  if (!record) {
    return undefined;
  }

  return optionalString(record.message) ?? optionalString(record.error) ?? optionalString(record.detail);
}

function readRequiredResourceId(value: unknown, fieldName: string): string {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  const text = optionalString(value);
  if (!text) {
    throw new ProviderRequestError(400, `${fieldName} is required`);
  }
  return text;
}
