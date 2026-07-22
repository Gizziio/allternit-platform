export type TelemetryPrimitive = string | number | boolean | null | undefined

export interface RuntimeTelemetryEvents {
  context_projection_repaired: {
    reordered: number; synthesized: number; dropped: number; merged: number
  }
  goal_status_changed: {
    status: "active" | "paused" | "blocked" | "complete"; turns_used: number; tokens_used: number
  }
  background_task_completed: {
    kind: "agent" | "process" | "question"; status: string; duration_ms: number | null
  }
  mcp_tool_collision: { count: number; servers: number }
  provider_request_failed: { provider: string; retryable: boolean; status_code?: number; error_code: string }
  acp_config_changed: { config_id: "model" | "thinking" | "mode" }
  compaction_recovery: { retry_count: number; history_count: number; recovered: boolean }
  skill_growth_transition: { from: string; to: string; approved: boolean }
  native_asset_fallback: { package: string; platform: string }
  tool_call_duplicate: { kind: "same_step" | "cross_step" }
}

export const RuntimeTelemetryRegistry: {
  [K in keyof RuntimeTelemetryEvents]: {
    owner: string
    purpose: string
    properties: { [P in keyof RuntimeTelemetryEvents[K]]: string }
  }
} = {
  context_projection_repaired: {
    owner: "runtime", purpose: "Measure provider-context repair quality.",
    properties: { reordered: "Results moved after calls.", synthesized: "Missing results synthesized.", dropped: "Invalid entries removed.", merged: "Assistant entries merged." },
  },
  goal_status_changed: {
    owner: "autonomy", purpose: "Measure durable goal outcomes and budgets.",
    properties: { status: "Resulting goal state.", turns_used: "Turns consumed.", tokens_used: "Tokens consumed." },
  },
  background_task_completed: {
    owner: "runtime", purpose: "Measure durable background execution reliability.",
    properties: { kind: "Task class.", status: "Terminal status.", duration_ms: "Elapsed milliseconds." },
  },
  mcp_tool_collision: {
    owner: "integrations", purpose: "Detect ambiguous MCP catalogs without collecting names.",
    properties: { count: "Colliding tools.", servers: "Number of configured servers." },
  },
  provider_request_failed: {
    owner: "providers", purpose: "Measure structured provider failures.",
    properties: { provider: "Stable provider identifier.", retryable: "Whether retry is safe.", status_code: "HTTP status when present.", error_code: "Normalized error code." },
  },
  acp_config_changed: {
    owner: "integrations", purpose: "Measure IDE configuration controls.",
    properties: { config_id: "Configuration axis, never its selected value." },
  },
  compaction_recovery: {
    owner: "runtime", purpose: "Measure compaction overflow recovery.",
    properties: { retry_count: "Attempts used.", history_count: "Projected message count.", recovered: "Whether recovery succeeded." },
  },
  skill_growth_transition: {
    owner: "skills", purpose: "Measure governed skill lifecycle transitions without skill content or names.",
    properties: { from: "Prior lifecycle state.", to: "Next lifecycle state.", approved: "Whether a human approval existed." },
  },
  native_asset_fallback: {
    owner: "packaging", purpose: "Detect missing compiled native sidecars.",
    properties: { package: "Published package identifier.", platform: "OS and architecture." },
  },
  tool_call_duplicate: {
    owner: "runtime", purpose: "Measure duplicate tool suppression and repeat guidance without collecting tool names or arguments.",
    properties: { kind: "Whether the duplicate occurred in one model step or across consecutive steps." },
  },
}
