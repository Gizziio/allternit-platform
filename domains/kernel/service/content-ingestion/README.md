# Content Ingestion Kernel

Agent-native content pipeline: **HTML → Markdown → Structured Context**

## Overview

The Content Ingestion Kernel provides a complete pipeline for fetching, cleaning, structuring, and storing web content for agent consumption. It transforms raw HTML into semantically structured living files with extracted entities, ready for vector storage and knowledge graph indexing.

## Features

- **HTML Fetching** (GAP-31): Robust HTTP fetching with retries, timeout handling, redirect following, and proper headers
- **Content Cleaning** (GAP-32): HTML sanitization using `sanitize-html` + conversion to Markdown via `node-html-markdown`
- **Semantic Structuring** (GAP-33): NLP-powered entity extraction using `compromise` for NER (people, organizations, locations, dates, topics, concepts)
- **Living File Writing** (GAP-34): Versioned filesystem storage with atomic writes and change tracking
- **Vector DB Integration** (GAP-35): Pluggable interface for Pinecone, Weaviate, Qdrant with knowledge graph preparation

## Installation

```bash
cd 1-kernel/execution/content-ingestion
npm install
```

## Dependencies Added

| Package | Purpose |
|---------|---------|
| `compromise` | NLP library for Named Entity Recognition |
| `sanitize-html` | HTML sanitization - removes scripts, styles, unsafe tags |
| `node-html-markdown` | Convert cleaned HTML to Markdown |
| `@types/node` | TypeScript types for Node.js APIs |
| `@types/sanitize-html` | TypeScript types for sanitize-html |

## Usage

### Basic Ingestion

```typescript
import { ContentIngestionKernel } from '@allternit/content-ingestion';

const kernel = new ContentIngestionKernel({
  outputDir: './living',
});

const { content, livingFile } = await kernel.ingest('https://example.com/article');

console.log('Title:', content.title);
console.log('Entities:', content.sections.flatMap(s => s.entities));
console.log('Stored at:', livingFile.markdownPath);
```

### With Custom Fetch Options

```typescript
const kernel = new ContentIngestionKernel();

const result = await kernel.ingest('https://example.com/article', {
  fetchOptions: {
    timeout: 60000,       // 60 second timeout
    retries: 5,           // 5 retry attempts
    retryDelay: 2000,     // 2 second delay between retries
    userAgent: 'CustomBot/1.0',
    followRedirects: true,
    maxRedirects: 10,
  },
});
```

### Batch Ingestion

```typescript
const results = await kernel.ingestBatch([
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article3',
]);

for (const { url, result, error } of results) {
  if (error) {
    console.error(`Failed: ${url} - ${error}`);
  } else {
    console.log(`Success: ${url} - ${result?.content.title}`);
  }
}
```

### With Vector DB Integration

```typescript
const kernel = new ContentIngestionKernel({
  outputDir: './living',
  enableVectorDB: true,
  vectorDBConfig: {
    provider: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    indexName: 'content-embeddings',
    namespace: 'web-content',
  },
});

await kernel.connectVectorDB();
const result = await kernel.ingest('https://example.com/article');
// Automatically prepares knowledge graph nodes and embedding entries
```

## Pipeline Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  HTMLFetcher    │───▶│ ContentCleaner  │───▶│SemanticStructurer│
│                 │    │                 │    │                 │
│ • Retries       │    │ • sanitize-html │    │ • compromise    │
│ • Timeouts      │    │ • Remove boiler │    │   NER           │
│ • Redirects     │    │ • HTML→Markdown │    │ • Entity ext.   │
│ • Error handling│    │                 │    │ • Key points    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ VectorDBAdapter │◀───│LivingFileWriter │◀───│ IngestedContent │
│  (Optional)     │    │                 │    │                 │
│                 │    │ • Versioned FS  │    │ • Sections      │
│ • Pinecone      │    │ • Atomic writes │    │ • Entities      │
│ • Weaviate      │    │ • Diff tracking │    │ • Metadata      │
│ • Qdrant        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Entity Types Extracted

The NLP engine extracts the following entity types:

| Type | Description | Example |
|------|-------------|---------|
| `person` | People names | "Elon Musk", "Ada Lovelace" |
| `organization` | Companies, institutions | "OpenAI", "MIT" |
| `location` | Places, geography | "San Francisco", "Europe" |
| `date` | Temporal expressions | "January 2024", "last week" |
| `topic` | Frequently mentioned nouns | "machine learning", "API" |
| `concept` | Adjective-noun combinations | "artificial intelligence" |

## File Structure Output

```
living/
└── web/
    └── example.com/
        ├── a1b2c3d4e5f6.md      # Current markdown
        ├── a1b2c3d4e5f6.json    # Structured JSON
        └── .versions/
            └── a1b2c3d4e5f6/
                ├── 2024-01-15T10-30-00-000Z.md
                └── 2024-01-16T14-20-00-000Z.md
```

## Error Handling

The kernel provides specific error types:

```typescript
try {
  await kernel.ingest('https://example.com/not-found');
} catch (error) {
  if (error instanceof FetchError) {
    console.log(`HTTP ${error.statusCode}: ${error.message}`);
  }
}
```

### Retry Behavior

- **4xx errors** (client errors): Not retried (404, 403, etc.)
- **5xx errors** (server errors): Retried with exponential backoff
- **Network errors**: Retried with exponential backoff
- **Timeout errors**: Retried with exponential backoff

## API Reference

### Classes

- `HTMLFetcher` - Fetch HTML with error handling and retries
- `MarkdownNegotiator` - Try to fetch markdown directly
- `ContentCleaner` - Sanitize HTML and convert to Markdown
- `SemanticStructurer` - Extract structure and entities using NLP
- `LivingFileWriter` - Versioned filesystem storage
- `VectorDBAdapter` - Vector database integration interface
- `ContentIngestionKernel` - Main orchestrator class

### Interfaces

- `IngestedContent` - Structured content output
- `ContentSection` - Individual content sections
- `Entity` - Extracted entities with confidence scores
- `LivingFile` - File storage metadata
- `FetchOptions` - HTTP fetch configuration
- `VectorDBConfig` - Vector database connection config
- `KnowledgeGraphNode` - Knowledge graph node structure

## License

MIT
