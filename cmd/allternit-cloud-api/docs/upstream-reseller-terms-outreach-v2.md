# Upstream Reseller / OEM Terms Outreach Kit

**Status:** For future use when Allternit begins selling bundled model credits. **Not required while subscriptions remain UI-only BETA.**

**Purpose:** Obtain written confirmation that Allternit can resell bundled inference credits under its own billing, using models from each upstream supplier.

**Important:** This kit contains draft outreach materials. A human authorized to bind Allternit LLC must review, customize, and send each message. Do not send these drafts unreviewed.

---

## Current BETA model: disclosure-only

During BETA, Allternit Cloud does **not** sell bundled model credits. Model access is provided on an operator-paid or bring-your-own-key basis, or the subscription picker remains UI-only. A platform disclosure identifying upstream providers is sufficient for this phase.

See `model-provider-disclosures.md` for the BETA disclosure language.

## When this kit becomes required

This outreach kit must be executed **before** any of the following go live:

- Subscription tiers that bundle "monthly credits for Allternit Cloud, local + cloud models, and built-in tool use" where model credits are real and paid for by customers.
- Marking the Subscribe button or plan picker as live (non-BETA).
- Charging customers a single price that includes inference output from third-party providers.

Disclosure alone does **not** grant the right to resell another company's API output under your own billing.

---

## What we need in writing

For every supplier whose models will be included in paid Allternit subscription tiers, we need explicit written confirmation of **at least** these points:

1. **Resale right.** Can Allternit charge end customers a single price that includes the supplier's inference output?
2. **Billing relationship.** Does Allternit hold a master account and resell, or must end customers have a direct relationship with the supplier?
3. **Price floors / revenue share.** Are there minimum prices, platform fees, or revenue-share requirements?
4. **White-label / abstraction.** Can Allternit expose models behind Allternit aliases (e.g. `llama-3.1-8b`) without displaying the supplier's brand?
5. **Usage minimums and commitments.** Are there monthly/annual minimums, prepayment, or reserved-capacity requirements?
6. **Compliance and data handling.** Where is data processed? Can we offer zero-retention or region-specific options to customers?
7. **Termination / change-of-terms notice.** How much notice does the supplier give before price or terms changes?
8. **Liability and indemnification.** Who is liable for model output, outages, or upstream price changes passed to Allternit customers?

---

## Supplier contact list

| Priority | Supplier | Role in Allternit | Best contact path | Notes |
|----------|----------|-------------------|-------------------|-------|
| 1 | **OpenRouter** | Long-tail coverage + fallback | Use [openrouter.ai](https://openrouter.ai) support / Discord; look for "Enterprise" or "Contact" in dashboard | Routing layer; their ToS at [legal.crusoe.ai/open-router](https://legal.crusoe.ai/open-router) governs. Need explicit resale terms. |
| 2 | **Together AI** | Primary open-model supplier | [together.ai/contact-sales](https://www.together.ai/contact-sales) | Strong fit for open-weight lane. |
| 3 | **Fireworks AI** | Performance / agent workloads | [fireworks.ai/contact-agentic](https://fireworks.ai/contact-agentic) or "Contact Sales" | Focus on agent/coding/long-context use cases. |
| 4 | **DeepInfra** | Cost arbitrage | [deepinfra.com/contact-sales](https://deepinfra.com/contact-sales) | Position as price-competitive lane. |
| 5 | **Groq** | Ultra-fast inference | [groq.com/contact](https://groq.com/contact) | Services agreement at [console.groq.com/docs/legal/services-agreement](https://console.groq.com/docs/legal/services-agreement). |
| 6 | **Replicate** | Image/video/audio models | Start with [replicate.com/contact](https://replicate.com/contact) or `support@replicate.com` | Media lane, separate from LLMs. |
| 7 | **OpenAI** | Flagship proprietary models | `sales@openai.com` or [openai.com/enterprise](https://openai.com/enterprise) | Direct flagship access. |
| 8 | **Anthropic** | Claude models | [Anthropic Claude Partner Network](https://www.anthropic.com/partners) or `partners@anthropic.com` | Many resellers go through [AWS Bedrock authorized reseller program](https://aws.amazon.com/bedrock/); ask about both direct and Bedrock routes. |
| 9 | **Google** | Gemini / Vertex models | [Google Cloud Partner Advantage](https://cloud.google.com/partners) or Google Cloud sales | Direct or via Vertex AI / Google Cloud Marketplace. |
| 10 | **AWS** | Enterprise / Bedrock lane | [AWS Partner Network](https://aws.amazon.com/partners/) or AWS account manager | Bedrock reseller program is the likely path for Claude and many models. |

---

## Standard outreach email template

**Subject:** Allternit Cloud — OEM / embedded-service terms for model resale

```
Hi [Supplier] Partnership / Sales team,

I'm [Name], [Title] at Allternit LLC. We are building Allternit Cloud, a
model-brokering platform that exposes a single OpenAI-compatible API and routes
end-user inference requests to the optimal upstream provider based on cost,
latency, capacity, and compliance requirements.

We would like to include [Supplier] models in our catalog and sell them as part
of Allternit subscription tiers that bundle compute, model credits, and hosted
tools. Before we do so, we need written confirmation of the commercial terms
that govern this arrangement.

Specifically, we need clarity on:

1. Resale right: Can Allternit charge end customers a single price that
   includes inference output from [Supplier] models?
2. Billing relationship: Will Allternit hold the upstream account and resell,
   or must each end customer contract directly with [Supplier]?
3. Price floors / revenue share: Are there minimum prices, platform fees, or
   revenue-share requirements?
4. White-label exposure: Can we expose [Supplier] models behind Allternit
   aliases (e.g. "llama-3.1-8b") without displaying [Supplier] branding to the
   end user?
5. Usage commitments: Are there monthly/annual minimums, prepayments, or
   reserved-capacity requirements?
6. Data handling: Where is inference data processed? Can we offer
   zero-retention or region-specific options?
7. Terms changes: How much notice do you provide before price or terms changes?
8. Liability: How is liability allocated for model output, outages, or
   upstream price changes passed to our customers?

We are happy to sign an NDA and discuss expected volumes, target launch date,
and any co-marketing opportunities.

Best regards,
[Name]
[Title], Allternit LLC
[Email]
[Phone]
```

---

## Supplier-specific customization notes

### OpenRouter
- Position: long-tail coverage and emergency fallback, **not** primary supplier.
- Ask specifically whether their standard Terms of Service permits reselling tokens bundled into another product.
- Request a partner / enterprise addendum if the standard ToS does not cover resale.

### Together AI
- Position: primary open-model supplier; broad model catalog + dedicated capacity + batch inference.
- Ask about serverless vs. dedicated inference, batch pricing, and fine-tuning partner terms.
- Mention possible migration from serverless to reserved capacity as Allternit volume grows.

### Fireworks AI
- Position: agent/coding/long-context workloads; high-performance MoE and caching.
- Ask about custom model hosting, fine-tunes, and caching-heavy use cases.
- Reference their AWS GenAI Competency / SCA if relevant.

### DeepInfra
- Position: low-cost commodity inference; price arbitrage lane.
- Ask about volume discounts and whether their low list prices are compatible with resale margin.

### Groq
- Position: ultra-low-latency "Turbo" lane for agent tasks.
- Ask about committed inference capacity and enterprise terms.
- Review their Services Agreement first and ask for an embedded-service addendum.

### Replicate
- Position: image/video/audio/media models, separate from LLM lanes.
- Ask about media-model resale, per-prediction pricing, and community model usage rights.

### OpenAI
- Position: flagship proprietary models.
- Ask about volume pricing, reserved capacity, and OEM/embedded use.
- Note: OpenAI is increasingly services-oriented; clarify whether Allternit can be a pure API reseller.

### Anthropic
- Position: Claude models.
- Ask about direct reseller terms and the AWS Bedrock authorized reseller program.
- Many existing Anthropic resellers are Bedrock-based; decide whether Allternit wants direct or Bedrock route.

### Google
- Position: Gemini / Vertex models.
- Ask about Google Cloud Marketplace resale and Vertex AI partner terms.

### AWS
- Position: enterprise / compliance / Bedrock lane.
- Ask about AWS Partner Network path and Bedrock reseller / marketplace listing.

---

## Internal tracking checklist

- [ ] OpenRouter — email/form sent on [date]
- [ ] Together AI — [together.ai/contact-sales](https://www.together.ai/contact-sales) submitted on [date]
- [ ] Fireworks AI — contact sales submitted on [date]
- [ ] DeepInfra — [deepinfra.com/contact-sales](https://deepinfra.com/contact-sales) submitted on [date]
- [ ] Groq — [groq.com/contact](https://groq.com/contact) submitted on [date]
- [ ] Replicate — email/form sent on [date]
- [ ] OpenAI — `sales@openai.com` sent on [date]
- [ ] Anthropic — partners email/form sent on [date]
- [ ] Google Cloud — partner contact submitted on [date]
- [ ] AWS — partner contact submitted on [date]

---

## Recommended sequencing (when the time comes)

1. **Send Tier 1:** OpenRouter, Together AI, Fireworks, DeepInfra, Groq. These are technical partners in the current Phase A/B architecture.
2. **Send Tier 2 in parallel:** OpenAI, Anthropic, Google, AWS. These are strategic flagship/enterprise providers and may take longer.
3. **Do not publicly sell bundled cloud-model credits until at least Tier 1 agreements are in writing.**
4. **Legal review:** Have Allternit's counsel review each agreement before signing.

---

## Related documents

- `cmd/allternit-cloud-api/docs/model-router.md` — architecture and sourcing stack
- `cmd/allternit-cloud-api/docs/model-provider-disclosures.md` — BETA disclosure language
- `CLERK_SESSION_STATUS.md` — status and deployment notes
