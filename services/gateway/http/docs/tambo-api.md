# Tambo API Documentation

Complete API reference for the Tambo UI Generation System.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Types](#common-types)
- [Endpoints](#endpoints)
  - [UI Generation](#ui-generation)
  - [Hash Engine](#hash-engine)
  - [Spec Diff Engine](#spec-diff-engine)
  - [Accessibility (A11y) Engine](#accessibility-a11y-engine)
  - [State Management](#state-management)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

Tambo is a deterministic UI generation system that creates UI components from specifications. It supports multiple frameworks (React, Vue, Svelte, Angular, Web Components, Plain HTML) and provides advanced features like content hashing, spec diffing, and accessibility validation.

## Base URL

```
http://localhost:3210/v1/tambo
```

## Authentication

Currently, no authentication is required for local development.

## Common Types

### UISpec

The core specification for UI generation:

```typescript
interface UISpec {
  spec_id: string;           // Unique identifier
  title: string;             // Human-readable title
  description: string;       // Description
  components: ComponentSpec[]; // Component definitions
  layout: LayoutSpec;        // Layout configuration
  style: StyleSpec;          // Style/theming
  interactions: InteractionSpec[]; // Interaction handlers
  created_at: string;        // ISO 8601 timestamp
}
```

### ComponentSpec

```typescript
interface ComponentSpec {
  component_id: string;
  component_type: 'button' | 'input' | 'card' | 'container' | 'table' | 'modal' | 'tabs' | 'dropdown' | 'chart';
  properties: Record<string, unknown>;
  children: string[];
  bindings: DataBinding[];
}
```

### UIType

Supported UI frameworks:

- `react` - React JSX
- `vue` - Vue Single File Component
- `svelte` - Svelte Component
- `angular` - Angular Component
- `web_components` - Custom Web Component
- `plain_html` - Plain HTML/CSS

## Endpoints

### UI Generation

#### POST `/generate`

Generate UI from specification.

**Request Body:**

```json
{
  "spec": {
    "spec_id": "my-ui-001",
    "title": "My Application",
    "description": "A sample UI",
    "components": [
      {
        "component_id": "btn-submit",
        "component_type": "button",
        "properties": { "label": "Submit" },
        "children": [],
        "bindings": []
      }
    ],
    "layout": {
      "layout_type": "flex",
      "constraints": {},
      "regions": []
    },
    "style": {
      "theme": "default",
      "colors": {},
      "typography": {
        "font_family": "Arial",
        "font_sizes": {},
        "line_heights": {}
      },
      "spacing": {
        "scale": [4, 8, 16, 32],
        "unit": "px"
      }
    },
    "interactions": [],
    "created_at": "2024-01-01T00:00:00Z"
  },
  "ui_type": "react"
}
```

**Response:**

```json
{
  "generation_id": "gen_abc123",
  "spec_id": "my-ui-001",
  "ui_code": "import React from 'react';...",
  "ui_type": "React",
  "components_generated": 1,
  "confidence": 0.9,
  "generation_hash": "sha256:..."
}
```

#### POST `/generate/validated`

Generate UI with schema validation.

Same request/response as `/generate`, but returns 400 if spec is invalid.

#### POST `/generate/reproducible`

Generate UI with deterministic seed for reproducibility.

**Request Body:**

```json
{
  "spec": { /* UISpec */ },
  "ui_type": "react",
  "seed": 12345
}
```

**Response:** Same as `/generate` with `generation_hash`.

#### POST `/generate/stream`

Generate UI with streaming response (Server-Sent Events).

**Request Body:** Same as `/generate`

**Response:** SSE stream with chunks of generated code.

### Hash Engine

#### POST `/hash`

Hash arbitrary content for verification.

**Request Body:**

```json
{
  "content": "string to hash"
}
```

**Response:**

```json
{
  "hash": "a3f5c2..."
}
```

#### POST `/hash/verify`

Verify content against expected hash.

**Request Body:**

```json
{
  "content": "string to verify",
  "hash": "a3f5c2..."
}
```

**Response:**

```json
{
  "valid": true
}
```

### Spec Diff Engine

#### POST `/diff`

Compare two specifications and return differences.

**Request Body:**

```json
{
  "old_spec": { /* UISpec v1 */ },
  "new_spec": { /* UISpec v2 */ }
}
```

**Response:**

```json
{
  "has_changes": true,
  "component_changes": [
    {
      "change_type": "Modified",
      "component_id": "btn-1",
      "description": "Property 'label' changed"
    }
  ],
  "layout_changes": [],
  "style_changes": [],
  "breaking_changes": []
}
```

#### POST `/diff/breaking`

Check if diff contains breaking changes.

**Request Body:**

```json
{
  "diff": { /* SpecDiff from /diff */ }
}
```

**Response:**

```json
{
  "has_breaking_changes": false
}
```

#### POST `/diff/summary`

Generate human-readable summary of changes.

**Request Body:**

```json
{
  "diff": { /* SpecDiff */ }
}
```

**Response:**

```json
{
  "summary": "Changes: 1 components modified, 0 layout, 0 style, 0 breaking"
}
```

### Accessibility (A11y) Engine

#### POST `/a11y/validate`

Validate specification for accessibility compliance.

**Request Body:**

```json
{
  "spec": { /* UISpec */ }
}
```

**Response:**

```json
{
  "passed": true,
  "score": 0.95,
  "violations": [],
  "warnings": [
    {
      "rule": "contrast",
      "description": "Low contrast detected",
      "element": "button",
      "suggestion": "Increase contrast ratio to 4.5:1"
    }
  ]
}
```

#### POST `/a11y/validate-ui`

Validate generated UI code for accessibility.

**Request Body:**

```json
{
  "ui": {
    "generation_id": "gen_abc123",
    "spec_id": "my-ui-001",
    "ui_code": "<button>Click</button>",
    "ui_type": "plain_html",
    "components_generated": 1,
    "confidence": 0.9
  }
}
```

**Response:** Same as `/a11y/validate`.

#### POST `/a11y/report`

Generate markdown accessibility report.

**Request Body:**

```json
{
  "result": { /* A11yResult from validation */ }
}
```

**Response:**

```json
{
  "report": "# Accessibility Report\n\n**Score:** 95%\n..."
}
```

### State Management

#### GET `/generations/:id/state`

Load generation state.

**Response:**

```json
{
  "generation_id": "gen_abc123",
  "spec_id": "my-ui-001",
  "state": { /* arbitrary data */ },
  "version": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### POST `/generations/:id/state`

Save generation state.

**Request Body:**

```json
{
  "state": { /* arbitrary data */ }
}
```

**Response:**

```json
{
  "success": true
}
```

## Error Handling

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "additional": "context"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `HASH_ERROR` | Hash computation failed | 500 |
| `HASH_VERIFY_ERROR` | Hash verification failed | 500 |
| `DIFF_ERROR` | Spec diff failed | 500 |
| `A11Y_ERROR` | Accessibility check failed | 500 |
| `GENERATION_ERROR` | UI generation failed | 500 |

## Examples

### Example 1: Generate and Hash UI

```bash
# Generate UI
curl -X POST http://localhost:3210/v1/tambo/generate \
  -H "Content-Type: application/json" \
  -d '{
    "spec": {
      "spec_id": "example-001",
      "title": "Example UI",
      "description": "An example",
      "components": [{"component_id": "btn-1", "component_type": "button", "properties": {"label": "Click"}, "children": [], "bindings": []}],
      "layout": {"layout_type": "flex", "constraints": {}, "regions": []},
      "style": {"theme": "default", "colors": {}, "typography": {"font_family": "Arial", "font_sizes": {}, "line_heights": {}}, "spacing": {"scale": [4], "unit": "px"}},
      "interactions": [],
      "created_at": "2024-01-01T00:00:00Z"
    },
    "ui_type": "react"
  }'

# Hash the generated code
# (extract ui_code from previous response)
curl -X POST http://localhost:3210/v1/tambo/hash \
  -H "Content-Type: application/json" \
  -d '{"content": "<generated ui_code>"}'
```

### Example 2: Version Control with Diff

```bash
# Save v1 of spec
cat > spec-v1.json << 'EOF'
{
  "spec_id": "my-app",
  "title": "My App",
  "description": "Version 1",
  "components": [{"component_id": "btn-1", "component_type": "button", "properties": {"label": "Submit"}, "children": [], "bindings": []}],
  "layout": {"layout_type": "flex", "constraints": {}, "regions": []},
  "style": {"theme": "default", "colors": {}, "typography": {"font_family": "Arial", "font_sizes": {}, "line_heights": {}}, "spacing": {"scale": [4], "unit": "px"}},
  "interactions": [],
  "created_at": "2024-01-01T00:00:00Z"
}
EOF

# Save v2 of spec
cat > spec-v2.json << 'EOF'
{
  "spec_id": "my-app",
  "title": "My App",
  "description": "Version 2",
  "components": [{"component_id": "btn-1", "component_type": "button", "properties": {"label": "Save"}, "children": [], "bindings": []}],
  "layout": {"layout_type": "flex", "constraints": {}, "regions": []},
  "style": {"theme": "default", "colors": {}, "typography": {"font_family": "Arial", "font_sizes": {}, "line_heights": {}}, "spacing": {"scale": [4], "unit": "px"}},
  "interactions": [],
  "created_at": "2024-01-01T00:00:00Z"
}
EOF

# Compare specs
curl -X POST http://localhost:3210/v1/tambo/diff \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "old_spec": $(cat spec-v1.json),
  "new_spec": $(cat spec-v2.json)
}
EOF
```

### Example 3: Full Accessibility Audit

```bash
# Validate spec
curl -X POST http://localhost:3210/v1/tambo/a11y/validate \
  -H "Content-Type: application/json" \
  -d '{
    "spec": {
      "spec_id": "a11y-test",
      "title": "Accessibility Test",
      "description": "Testing accessibility",
      "components": [
        {"component_id": "btn-1", "component_type": "button", "properties": {"label": "Accessible Button"}, "children": [], "bindings": []},
        {"component_id": "input-1", "component_type": "input", "properties": {"placeholder": "Enter name"}, "children": [], "bindings": []}
      ],
      "layout": {"layout_type": "flex", "constraints": {}, "regions": []},
      "style": {"theme": "default", "colors": {}, "typography": {"font_family": "Arial", "font_sizes": {}, "line_heights": {}}, "spacing": {"scale": [4], "unit": "px"}},
      "interactions": [],
      "created_at": "2024-01-01T00:00:00Z"
    }
  }'

# Generate report (pass the result from above)
curl -X POST http://localhost:3210/v1/tambo/a11y/report \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "passed": true,
      "score": 0.95,
      "violations": [],
      "warnings": []
    }
  }'
```

### Example 4: Reproducible Generation

```bash
# Generate with seed
curl -X POST http://localhost:3210/v1/tambo/generate/reproducible \
  -H "Content-Type: application/json" \
  -d '{
    "spec": {
      "spec_id": "reproducible-test",
      "title": "Reproducible",
      "description": "Test",
      "components": [{"component_id": "btn-1", "component_type": "button", "properties": {"label": "Click"}, "children": [], "bindings": []}],
      "layout": {"layout_type": "flex", "constraints": {}, "regions": []},
      "style": {"theme": "default", "colors": {}, "typography": {"font_family": "Arial", "font_sizes": {}, "line_heights": {}}, "spacing": {"scale": [4], "unit": "px"}},
      "interactions": [],
      "created_at": "2024-01-01T00:00:00Z"
    },
    "ui_type": "react",
    "seed": 12345
  }'

# Same seed produces same hash
```

## Rate Limiting

No rate limiting is currently implemented for local development.

## Support

For issues and feature requests, please refer to the project repository.
