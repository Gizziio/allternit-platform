# Allternit Model Router

Allternit Cloud is a **model broker**, not a thin wrapper around a single upstream provider. The router owns the decision of where every request runs and abstracts that decision behind one OpenAI-compatible API for users.

## Principle

- Allternit exposes `/v1/chat/completions`, `/v1/models`, and related endpoints.
- Users send one bearer token and draw from one credit balance.
- Internally, the `ModelRouter` dispatches each request to the optimal upstream based on cost, latency, capacity, geography, cache affinity, and compliance constraints.
- OpenRouter is the **long-tail coverage and emergency-fallback layer**, not the primary supplier.

## Sourcing stack

| Priority | Source | Role in Allternit |
| --- | --- | --- |
| 1 | **Direct OpenAI / Anthropic / Google** | Flagship proprietary models. |
| 2 | **Together AI** | Open models, dedicated capacity, batch inference, fine-tuning. |
| 3 | **Fireworks AI** | Agents, coding, long-context, caching-heavy workloads, fine-tunes. |
| 4 | **DeepInfra** | Low-cost commodity inference and price arbitrage. |
| 5 | **Groq** | Latency-sensitive agent tasks. |
| 6 | **Cerebras** | Ultra-fast inference on supported models. |
| 7 | **AWS Bedrock** | Enterprise customers, regional/compliance workloads. |
| 8 | **Replicate** | Image, video, audio, and specialized models. |
| 9 | **OpenRouter** | Long-tail models, new-model discovery, failover. |
| 10 | **User BYOK + Allternit local compute** | Enterprise control and zero-reseller-cost workloads. |

## Routing topology

```text
                         ┌── ALLTERNIT LOCAL
                         │
                         ├── ALLTERNIT CLOUD GPUs
                         │
                         ├── OpenAI Direct
                         │
                         ├── Anthropic Direct
                         │
User → Allternit API  ───┼── Google Direct
                         │
    Allternit Router     ├── Together
                         │
                         ├── Fireworks
                         │
                         ├── DeepInfra
                         │
                         ├── Groq
                         │
                         ├── Cerebras
                         │
                         ├── AWS Bedrock
                         │
                         ├── Replicate
                         │
                         ├── OpenRouter
                         │
                         └── User BYOK
```

## Routing policy dimensions

The router scores candidates across:

- **Cost** — per-token or per-second upstream price.
- **Latency** — time-to-first-token and throughput requirements.
- **Reliability / capacity** — provider saturation, error rates, provisioned throughput.
- **Geography** — data residency and regional deployment.
- **Cache affinity** — reuse KV cache for long conversations when possible.
- **Compliance / contract** — AWS-only, zero-retention, direct-provider, or local-only constraints.

A simplified scoring function:

```text
effective_score =
  quality_weight
  + latency_weight
  + reliability_weight
  + cache_affinity_weight
  + compliance_weight
  - cost_weight
```

## Request and response shape

Allternit exposes an OpenAI-compatible surface:

```http
POST /v1/chat/completions
Authorization: Bearer <allternit-org-token>
Content-Type: application/json

{
  "model": "llama-3.1-8b",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

Internal adapters translate this to each upstream's native request format and translate responses back. Models are referenced by Allternit aliases (e.g. `llama-3.1-8b`, `claude-sonnet-4`, `gpt-4o`) that map to one or more upstream variants.

## Commercial guardrail

Before Allternit sells bundled model credits to customers, obtain explicit **OEM / reseller / embedded-service terms** from important upstream suppliers. Ordinary developer API terms are usually not sufficient for token-resale businesses. The routing architecture can be built before all commercial agreements are signed, but exposing a route under Allternit billing requires the right contract.

## Implementation phases

### Phase A — Coverage and local compute
- OpenRouter adapter for long-tail cloud models.
- Local runtime adapter for open-weights on user hardware.
- Static `/v1/models` list.

### Phase B — Open-model economics
- Together AI adapter.
- Fireworks AI adapter.
- DeepInfra adapter.
- Router chooses among them for open-weight requests.

### Phase C — Proprietary flagship models
- Direct OpenAI adapter.
- Direct Anthropic adapter.
- Direct Google adapter.

### Phase D — Specialized and enterprise lanes
- Groq and Cerebras adapters for speed.
- AWS Bedrock adapter for enterprise.
- Replicate adapter for media models.
- BYOK adapter for user-provided keys.

### Phase E — Allternit Fabric
- Allternit-owned GPU capacity joins the same router as another upstream source.
- The product becomes: "Allternit sources intelligence from every compute market and routes each workload to the optimal place to execute it."

## Supplier start list

To make the catalog real quickly, start commercial and technical conversations with:

1. OpenRouter — instant breadth.
2. Together AI — main open-model supplier.
3. Fireworks AI — performance + agent workloads.
4. DeepInfra — cost arbitrage.
5. Groq — ultra-fast inference.
6. Replicate — media models.

Simultaneously begin direct provider negotiations with OpenAI, Anthropic, Google, and AWS for volume/enterprise terms.
