-- Provider routing policies (Hermes-style provider_routing, Allternit Brain
-- Products/ProviderRouting.md). One row per tenant: the JSON `policy` column
-- holds sort/only/ignore/order/require_parameters/data_collection plus a
-- `models` map of per-model overrides. tenant_id NULL = platform-global
-- default, matching llm_routing_policies (V26) scoping semantics.

CREATE TABLE IF NOT EXISTS llm_provider_routing_policies (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT UNIQUE,
    policy     TEXT NOT NULL, -- JSON: ProviderRoutingPolicy
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
