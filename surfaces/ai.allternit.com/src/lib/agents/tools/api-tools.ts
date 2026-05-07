/**
 * API Tools
 * 
 * Native agent tools for making HTTP requests:
 * - http_request: Make GET/POST/PUT/DELETE/PATCH requests
 * - fetch_json: Fetch and parse JSON data
 */

import type { ToolDefinition, ToolExecutionHandler } from "./index";

// ============================================================================
// HTTP Request Tool
// ============================================================================

export const HTTP_REQUEST_DEFINITION: ToolDefinition = {
  name: "http_request",
  description: `Make an HTTP request to an external API or service.

Use this tool to:
- Fetch data from REST APIs
- Send data to webhooks
- Interact with third-party services
- Test API endpoints

Examples:
- GET request: method="GET", url="https://api.example.com/users"
- POST with JSON: method="POST", url="...", headers={"Content-Type":"application/json"}, body={"key":"value"}
- With auth: headers={"Authorization":"Bearer token"}

Security note: Be careful with sensitive data in URLs or headers.`,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to make the request to",
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
        description: "HTTP method",
        default: "GET",
      },
      headers: {
        type: "object",
        description: "Request headers as key-value pairs",
        default: {},
      },
      body: {
        type: ["string", "object"],
        description: "Request body (for POST/PUT/PATCH). Can be a JSON object or string.",
      },
      timeout: {
        type: "number",
        description: "Request timeout in milliseconds",
        default: 30000,
      },
    },
    required: ["url"],
  },
};

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType?: string;
}

export const executeHttpRequest: ToolExecutionHandler = async (context, parameters) => {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    timeout = 30000,
  } = parameters;

  try {
    const urlString = String(url);
    
    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(urlString);
    } catch {
      return { result: null, error: `Invalid URL: ${urlString}` };
    }

    // Only allow http/https protocols
    if (!["http:", "https:"].includes(validatedUrl.protocol)) {
      return { result: null, error: `Unsupported protocol: ${validatedUrl.protocol}` };
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method: String(method).toUpperCase(),
      headers: headers as Record<string, string>,
    };

    // Add body if present
    if (body !== undefined) {
      if (typeof body === "object") {
        requestOptions.body = JSON.stringify(body);
        // Set Content-Type if not already set
        const headersObj = requestOptions.headers as Record<string, string>;
        if (!headersObj["Content-Type"] && !headersObj["content-type"]) {
          headersObj["Content-Type"] = "application/json";
        }
      } else {
        requestOptions.body = String(body);
      }
    }

    // Make the request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout as number);

    const response = await fetch(urlString, {
      ...requestOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Read response body
    const responseBody = await response.text();

    // Try to parse JSON if content-type indicates JSON
    let parsedBody: unknown = responseBody;
    const contentType = responseHeaders["content-type"] || "";
    if (contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(responseBody);
      } catch {
        // Keep as string if parsing fails
      }
    }

    const result: HttpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      contentType,
    };

    // Return error for non-2xx status codes
    if (!response.ok) {
      return {
        result,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { result: { ...result, body: parsedBody } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { result: null, error: `Request timeout after ${timeout}ms` };
      }
      return { result: null, error: error.message };
    }
    return { result: null, error: "Unknown request error" };
  }
};

// ============================================================================
// Fetch JSON Tool
// ============================================================================

export const FETCH_JSON_DEFINITION: ToolDefinition = {
  name: "fetch_json",
  description: `Fetch JSON data from a URL with simplified interface.

Use this tool when you need to quickly fetch and parse JSON data from an API.
This is a convenience wrapper around http_request for JSON APIs.

Examples:
- Fetch user data: url="https://api.github.com/users/octocat"
- Fetch with query params: url="https://api.example.com/search?q=term"
- With auth: url="...", headers={"Authorization":"token"}`,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch JSON from",
      },
      headers: {
        type: "object",
        description: "Request headers",
        default: {},
      },
      timeout: {
        type: "number",
        description: "Request timeout in milliseconds",
        default: 30000,
      },
    },
    required: ["url"],
  },
};

export const executeFetchJson: ToolExecutionHandler = async (context, parameters) => {
  const { url, headers = {}, timeout = 30000 } = parameters;

  const result = await executeHttpRequest(context, {
    url,
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(headers as Record<string, string>),
    },
    timeout,
  });

  // If successful, ensure body is parsed JSON
  if (!result.error && result.result) {
    const response = result.result as HttpResponse;
    try {
      const parsed = typeof response.body === "string" 
        ? JSON.parse(response.body)
        : response.body;
      return {
        result: {
          status: response.status,
          data: parsed,
          headers: response.headers,
        },
      };
    } catch {
      return {
        result: null,
        error: "Response is not valid JSON",
      };
    }
  }

  return result;
};

// ============================================================================
// Webhook Tool
// ============================================================================

export const WEBHOOK_DEFINITION: ToolDefinition = {
  name: "send_webhook",
  description: `Send data to a webhook URL.

Use this tool to:
- Trigger CI/CD pipelines
- Send notifications to Slack/Discord
- Integrate with Zapier/Make
- Send data to external automation tools

Examples:
- Slack notification: url="https://hooks.slack.com/...", payload={"text":"Build complete"}
- Generic webhook: url="...", payload={"event":"user.signup","data":{...}}`,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The webhook URL",
      },
      payload: {
        type: "object",
        description: "The data to send",
      },
      headers: {
        type: "object",
        description: "Additional headers",
        default: {},
      },
    },
    required: ["url", "payload"],
  },
};

export const executeSendWebhook: ToolExecutionHandler = async (context, parameters) => {
  const { url, payload, headers = {} } = parameters;

  return executeHttpRequest(context, {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    },
    body: payload,
    timeout: 15000, // Shorter timeout for webhooks
  });
};
