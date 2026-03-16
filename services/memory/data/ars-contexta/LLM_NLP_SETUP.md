# LLM and NLP Setup Guide

## GAP-78: LLM Integration

### Overview
The LLM module provides a unified interface for multiple LLM providers:
- **OpenAI** (`gpt-4o`, `gpt-4o-mini`, etc.)
- **Anthropic** (`claude-3-haiku`, `claude-3-sonnet`, etc.)
- **Local/Ollama** (self-hosted models like `llama3.1`)
- **Stub** (always available for testing)

### Status: STUBBED

All providers except `stub` are currently stubbed and require explicit enabling.

### Enabling Providers

Set environment variables:

```bash
# OpenAI
export ENABLE_OPENAI=true
export OPENAI_API_KEY=sk-...

# Anthropic
export ENABLE_ANTHROPIC=true
export ANTHROPIC_API_KEY=sk-ant-...

# Local/Ollama
export ENABLE_LOCAL_LLM=true
export LLM_BASE_URL=http://localhost:11434
```

### Usage

```typescript
import { createLlmClient, generateInsightPrompt } from '@a2r/ars-contexta';

// Create client
const client = createLlmClient({
  provider: 'stub', // or 'openai', 'anthropic', 'local' when enabled
  model: 'gpt-4o-mini',
});

// Generate insights
const prompt = generateInsightPrompt({
  content: 'Your content here...',
  maxInsights: 5,
});

const response = await client.complete({
  messages: [
    { role: 'system', content: 'You are a knowledge analyst...' },
    { role: 'user', content: prompt },
  ],
});

// Streaming
for await (const chunk of client.stream(request)) {
  process.stdout.write(chunk.delta);
}
```

### Secrets Management

All API keys use the `PLACEHOLDER_APPROVED` pattern:
- Keys are never hardcoded
- Loaded from environment variables
- Not committed to version control

## GAP-79: NLP Entity Extraction

### Overview
The NLP module provides entity extraction capabilities:
- **People** (`person`)
- **Organizations** (`organization`)
- **Locations** (`location`)
- **Concepts** (`concept`)
- **Technologies** (`technology`)
- **Products**, **Events**, **Dates**

### Backends

| Backend | Status | Description |
|---------|--------|-------------|
| `rust-bert` | Stubbed | Ready-to-use transformer models |
| `candle` | Stubbed | Lightweight ML framework |
| `remote` | Stubbed | Hugging Face API or custom endpoint |
| `stub` | Active | Pattern-based extraction for testing |

### Building Native Modules

To enable `rust-bert` or `candle`:

```bash
# Install dependencies
cd native/rust-bert
npm run build

# Or for candle
cd native/candle
npm run build
```

### Usage

```typescript
import { createEntityExtractor } from '@a2r/ars-contexta';

// Create extractor
const extractor = createEntityExtractor('stub'); // or 'rust-bert', 'candle'

// Extract entities
const result = await extractor.extract(
  "Apple Inc. was founded by Steve Jobs in Cupertino.",
  {
    extractRelations: true,
    extractSentiment: true,
  }
);

console.log(result.entities);
// [
//   { text: "Apple Inc.", type: "organization", ... },
//   { text: "Steve Jobs", type: "person", ... },
//   { text: "Cupertino", type: "location", ... }
// ]
```

## Integration with 6Rs Pipeline

The LLM and NLP modules integrate with the 6Rs processing pipeline:

```
Content Ingestion → NLP Entity Extraction → LLM Insight Generation → 6Rs Pipeline
                          ↓                           ↓
                    (Entity[])              (Insight[])
                          ↓                           ↓
                    Claims Graph (T3-A3)    Knowledge Graph (T3-A2)
```

### Shared Types

Located in `types.ts`:
- `Insight` - Used by both LLM and 6Rs pipeline
- `Entity` - Used by NLP and Claims Graph
- `ExtractionResult` - Standard NLP output format

## Configuration Reference

### Environment Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `ENABLE_OPENAI` | OpenAI | Enable OpenAI provider |
| `OPENAI_API_KEY` | OpenAI | OpenAI API key |
| `ENABLE_ANTHROPIC` | Anthropic | Enable Anthropic provider |
| `ANTHROPIC_API_KEY` | Anthropic | Anthropic API key |
| `ENABLE_LOCAL_LLM` | Local | Enable Ollama/local provider |
| `LLM_BASE_URL` | Local | Ollama endpoint (default: http://localhost:11434) |
| `LLM_MODEL` | All | Default model to use |
| `RUST_BERT_LIB` | rust-bert | Path to native module |
| `CANDLE_LIB` | candle | Path to native module |
| `NLP_MODEL_CACHE` | NLP | Model cache directory |

## Coordination

- **T3-A1** (this implementation): LLM integration, NLP entity extraction
- **T3-A2**: 6Rs pipeline - uses `Insight` type from `types.ts`
- **T3-A3**: Claims graph - uses `Entity` type from `types.ts`

All shared types are in `src/types.ts` to avoid conflicts.

## WIH (Work In Head)

- **GAP-78**: Owner T3-A1
- **GAP-79**: Owner T3-A1
