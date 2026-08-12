# Strict Tool Use

Strict mode forces every tool argument to match its declared JSON Schema exactly. When strict mode is enabled, the schema is **closed** (`additionalProperties: false`) recursively, and the SDK validates each call before execution. Providers that support grammar-constrained generation can also use the closed schema to guarantee syntactically valid tool calls.

## Enabling strict mode

Register a tool with `strict: true`:

```typescript
import { ToolRegistry } from '@allternit/sdk/ai-runtime/tools';

const registry = new ToolRegistry();
registry.registerTool(
  {
    name: 'lookup',
    description: 'Lookup a record by ID',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        nested: {
          type: 'object',
          properties: {
            flag: { type: 'boolean' }
          }
        }
      },
      required: ['id']
    }
  },
  { namespace: 'crm', strict: true }
);
```

The registered tool name becomes `crm.lookup`, and every nested object in `input_schema` will have `additionalProperties: false`.

## How the schema is closed

`toStrictJsonSchema()` walks the schema and sets `additionalProperties: false` on every object node, including `items` of array schemas. Given this input schema:

```json
{
  "type": "object",
  "properties": {
    "city": { "type": "string" },
    "units": { "type": "string", "enum": ["metric", "imperial"] },
    "options": {
      "type": "object",
      "properties": {
        "includeForecast": { "type": "boolean" }
      }
    }
  },
  "required": ["city"]
}
```

`toStrictJsonSchema` returns a closed version where both the top-level object and the nested `options` object have `additionalProperties: false`:

```typescript
import { toStrictJsonSchema } from '@allternit/sdk/ai-runtime/tools/schema';

const strict = toStrictJsonSchema({
  type: 'object',
  properties: {
    nested: {
      type: 'object',
      properties: {}
    }
  }
});

console.log(strict.properties.options.additionalProperties); // => false
```

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "city": { "type": "string" },
    "units": { "type": "string", "enum": ["metric", "imperial"] },
    "options": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "includeForecast": { "type": "boolean" }
      }
    }
  },
  "required": ["city"]
}
```

## Runtime validation

`ToolRegistry.validateInput()` runs a small, dependency-free validator against the tool's schema:

```typescript
const ok = registry.validateInput('crm.lookup', { id: '1' });
console.log(ok.valid); // => true

const bad = registry.validateInput('crm.lookup', { id: '1', extra: true });
console.log(bad.errors); // => ["$.extra is not allowed"]
```

Validation checks:

- Required properties are present.
- Types match, including `integer` and `number` distinctions.
- `enum` values are exact matches.
- Arrays validate each item against `items`.
- `additionalProperties: false` rejects unknown keys.

## Grammar-constrained inputs

A closed schema is a precondition for provider-side grammar constraints such as JSON-mode output or constrained decoding. When a model is asked to call a strict tool, the set of legal keys and value types is bounded, so the provider can:

1. Generate a constrained grammar from the schema.
2. Decode tokens only from that grammar.
3. Parse the result directly as JSON without ad-hoc cleanup.

The SDK itself does not implement grammar decoding; it produces the strict schema that a grammar-aware provider consumes. Register tools with `strict: true` and use `getActiveToolSchemas()` to inject the closed schemas into the provider request.

```typescript
const schemas = registry.getActiveTools().map(t => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema,
  strict: true
}));
```

## Strict mode in the native belt

`NativeToolBelt` registers every native tool with `strict: true`, including `web_search`, `web_fetch`, `str_replace_editor`, `bash`, `code_execution`, and `memory`. MCP-attached tools are also strict by default. Custom tools opt in per-registration.
