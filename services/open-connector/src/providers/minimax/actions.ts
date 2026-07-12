import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "minimax";

export type MinimaxActionName = "list_models" | "retrieve_model" | "create_response" | "estimate_input_tokens";

const trimmedNonEmptyString = (description: string) => s.string({ description, minLength: 1, pattern: "\\S" });

const optionalTrimmedString = (description: string) => s.string(description);

const modelIdInputSchema = s.object("Input parameters for retrieving a MiniMax model.", {
  modelId: trimmedNonEmptyString("MiniMax model identifier to retrieve."),
});

const modelSchema = s.looseRequiredObject(
  "OpenAI-compatible MiniMax model object.",
  {
    id: s.string("MiniMax model identifier."),
    object: s.string("Object type returned by MiniMax, usually model."),
    created: s.integer("Unix timestamp when MiniMax created the model."),
    owned_by: s.string("Organization that owns the model."),
  },
  { optional: ["object", "created", "owned_by"] },
);

const responseInputMessageSchema = s.object(
  "MiniMax Responses API message input item with text content.",
  {
    type: s.literal("message", { description: "Message item type. Omit it or set it to message." }),
    role: s.stringEnum("Message role.", ["user", "assistant", "system", "developer", "tool"]),
    content: trimmedNonEmptyString("Text content for the message."),
  },
  { optional: ["type"] },
);

const responseFunctionCallInputSchema = s.object("MiniMax Responses API function call input item.", {
  type: s.literal("function_call", { description: "Function call item type." }),
  call_id: trimmedNonEmptyString("Tool call identifier."),
  name: trimmedNonEmptyString("Function name."),
  arguments: trimmedNonEmptyString("Function arguments encoded as a JSON string."),
});

const responseFunctionCallOutputInputSchema = s.object("MiniMax Responses API function call output input item.", {
  type: s.literal("function_call_output", { description: "Function call output item type." }),
  call_id: trimmedNonEmptyString("Tool call identifier."),
  output: trimmedNonEmptyString("Tool output text."),
});

const responseReasoningSummarySchema = s.object("MiniMax reasoning summary text item.", {
  type: s.literal("summary_text", { description: "Reasoning summary item type." }),
  text: trimmedNonEmptyString("Reasoning summary text."),
});

const responseReasoningInputSchema = s.object("MiniMax Responses API reasoning input item.", {
  type: s.literal("reasoning", { description: "Reasoning input item type." }),
  summary: s.array("Reasoning summary items to include in conversation history.", responseReasoningSummarySchema, {
    minItems: 1,
  }),
});

const responseInputSchema = s.anyOf("MiniMax Responses API text or conversation input.", [
  trimmedNonEmptyString("Simple text input for MiniMax."),
  s.array(
    "Conversation history items to send to MiniMax.",
    s.anyOf("Supported MiniMax Responses API conversation item.", [
      responseInputMessageSchema,
      responseFunctionCallInputSchema,
      responseFunctionCallOutputInputSchema,
      responseReasoningInputSchema,
    ]),
    { minItems: 1 },
  ),
]);

const responseReasoningSchema = s.object(
  "MiniMax reasoning control. MiniMax-M3 defaults to none when omitted.",
  {
    effort: s.stringEnum("Reasoning effort value.", ["minimal", "low", "medium", "high", "none"]),
  },
  { optional: ["effort"] },
);

const responseTextSchema = s.object(
  "MiniMax output text format control.",
  {
    format: s.object(
      "MiniMax response text format.",
      {
        type: s.literal("text", { description: "Plain text output format." }),
      },
      { optional: ["type"] },
    ),
  },
  { optional: ["format"] },
);

const responseToolSchema = s.object(
  "MiniMax Responses API function tool definition.",
  {
    type: s.literal("function", { description: "Tool type. MiniMax currently supports function tools." }),
    name: trimmedNonEmptyString("Function tool name."),
    description: optionalTrimmedString("Human-readable function tool description."),
    parameters: s.unknownObject("JSON Schema parameters for the function tool."),
  },
  { optional: ["description", "parameters"] },
);

const createResponseInputSchema = s.object(
  "Request body for creating a non-streaming MiniMax response.",
  {
    model: trimmedNonEmptyString("MiniMax model name to invoke, for example MiniMax-M3."),
    input: responseInputSchema,
    instructions: optionalTrimmedString("System instructions for the response."),
    max_output_tokens: s.integer("Maximum output token count.", { minimum: 1 }),
    temperature: s.number("Sampling temperature in the official range [0, 1].", {
      minimum: 0,
      maximum: 1,
    }),
    top_p: s.number("Nucleus sampling value in the official range [0, 1].", {
      minimum: 0,
      maximum: 1,
    }),
    service_tier: s.stringEnum("MiniMax service tier for request admission.", ["standard", "priority"]),
    tools: s.array("Function tools available to MiniMax.", responseToolSchema, { minItems: 1 }),
    tool_choice: s.stringEnum("Tool selection strategy.", ["none", "auto"]),
    metadata: s.record("String metadata to attach to the MiniMax request.", s.string("Metadata value.")),
    prompt_cache_key: optionalTrimmedString("Prompt cache routing identifier."),
    stream: s.literal(false, { description: "Set to false for the non-streaming connector action." }),
    text: responseTextSchema,
    reasoning: responseReasoningSchema,
  },
  {
    optional: [
      "instructions",
      "max_output_tokens",
      "temperature",
      "top_p",
      "service_tier",
      "tools",
      "tool_choice",
      "metadata",
      "prompt_cache_key",
      "stream",
      "text",
      "reasoning",
    ],
  },
);

const estimateInputTokensInputSchema = s.object(
  "Request body for estimating MiniMax response input tokens.",
  {
    model: trimmedNonEmptyString("MiniMax model name to estimate against, for example MiniMax-M3."),
    input: responseInputSchema,
    instructions: optionalTrimmedString("System instructions included in the estimate."),
    tools: s.array("Function tools included in the estimate.", responseToolSchema, { minItems: 1 }),
    tool_choice: s.stringEnum("Tool selection strategy.", ["none", "auto"]),
    text: responseTextSchema,
    reasoning: responseReasoningSchema,
  },
  { optional: ["instructions", "tools", "tool_choice", "text", "reasoning"] },
);

const usageSchema = s.unknownObject("MiniMax usage object with token counts and details.");

const minimaxErrorSchema = s.looseRequiredObject(
  "MiniMax response error object.",
  {
    code: s.string("MiniMax error code."),
    message: s.string("Human-readable MiniMax error message."),
  },
  { optional: ["code", "message"] },
);

const incompleteDetailsSchema = s.looseRequiredObject(
  "MiniMax incomplete response details.",
  {
    reason: s.string("Reason MiniMax marked the response incomplete."),
  },
  { optional: ["reason"] },
);

const outputItemSchema = s.unknownObject("MiniMax Responses API output item.");

const createResponseOutputSchema = s.looseRequiredObject(
  "MiniMax response object.",
  {
    id: s.string("MiniMax response identifier."),
    object: s.string("Object type returned by MiniMax, usually response."),
    created_at: s.integer("Response creation time as Unix seconds."),
    model: s.string("MiniMax model that processed the request."),
    status: s.stringEnum("MiniMax response status.", ["completed", "incomplete", "failed"]),
    output: s.array("MiniMax response output items.", outputItemSchema),
    output_text: s.nullableString("Concatenated response text returned by MiniMax."),
    usage: usageSchema,
    error: s.nullable(minimaxErrorSchema),
    incomplete_details: s.nullable(incompleteDetailsSchema),
    parallel_tool_calls: s.boolean("Whether MiniMax can run tool calls in parallel."),
    store: s.boolean("Whether MiniMax stored the response."),
    truncation: s.string("MiniMax truncation mode used for the response."),
  },
  {
    optional: ["output_text", "usage", "error", "incomplete_details", "parallel_tool_calls", "store", "truncation"],
  },
);

export const minimaxActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "list_models",
    description: "List OpenAI-compatible MiniMax models available to the API key.",
    inputSchema: s.object("No input is required to list MiniMax models.", {}),
    outputSchema: s.looseRequiredObject("MiniMax model list response.", {
      object: s.string("Object type returned by MiniMax, usually list."),
      data: s.array("MiniMax models returned by the API.", modelSchema),
    }),
  }),
  defineProviderAction(service, {
    name: "retrieve_model",
    description: "Retrieve OpenAI-compatible metadata for one MiniMax model.",
    inputSchema: modelIdInputSchema,
    outputSchema: modelSchema,
  }),
  defineProviderAction(service, {
    name: "create_response",
    description: "Create a non-streaming MiniMax response using the OpenAI Responses API shape.",
    inputSchema: createResponseInputSchema,
    outputSchema: createResponseOutputSchema,
  }),
  defineProviderAction(service, {
    name: "estimate_input_tokens",
    description: "Estimate MiniMax response input tokens without invoking the model.",
    inputSchema: estimateInputTokensInputSchema,
    outputSchema: s.looseRequiredObject("MiniMax input token estimate response.", {
      object: s.string("Object type returned by MiniMax, usually response.input_tokens."),
      input_tokens: s.integer("Estimated input token count."),
    }),
  }),
];
