# Tambo Determinism System - Visual Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser/CLI)                                │
│                                                                             │
│   POST /v1/tambo/generate/reproducible                                      │
│   {                                                                         │
│     "spec": { ... },      ←── UI Specification (JSON)                       │
│     "ui_type": "react",   ←── Output format                                 │
│     "seed": 42            ←── Determinism key                               │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ HTTP/JSON
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TYPESCRIPT GATEWAY (Node.js)                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  tambo_engine.ts                                                    │  │
│   │                                                                     │  │
│   │  Input: UISpec (snake_case) ──► toNapiSpec() ──► NAPI format       │  │
│   │                                     │                               │  │
│   │                                     ▼                               │  │
│   │  Output: GeneratedUI ◄── fromNapiResult() ◄── NAPI result          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼ NAPI FFI Call                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RUST TAMBO ENGINE (Native)                             │
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│   │   Schema    │───→│  Component  │───→│   Layout    │───→│  Codegen  │ │
│   │  Validator  │    │  Registry   │    │   Engine    │    │           │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────┬─────┘ │
│        │                                                          │       │
│        │                    ┌─────────────┐                        │       │
│        └───────────────────→│    Hash     │←───────────────────────┘       │
│                             │  Computer   │                                 │
│                             │  (Seed +    │                                 │
│                             │   Content)  │                                 │
│                             └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT                                            │
│                                                                             │
│   {                                                                         │
│     "generation_id": "gen_000000000000002a_fcbb18ed...",  ←─ Deterministic │
│     "spec_id": "demo-card",                                                │
│     "ui_code": "import React...",        ←─ Generated React code           │
│     "ui_type": "React",                                                    │
│     "components_generated": 3,                                             │
│     "confidence": 0.9,                                                     │
│     "generation_hash": "a1b2c3d4e5f6..."   ←─ Verification hash            │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Gets Generated

### Example Input Spec
```json
{
  "spec_id": "user-profile-card",
  "title": "User Profile Card",
  "components": [
    {
      "component_id": "avatar",
      "component_type": "image",
      "properties": { "src": "{{user.avatar}}", "size": 64 }
    },
    {
      "component_id": "username",
      "component_type": "text",
      "properties": { "content": "{{user.name}}", "variant": "h2" }
    },
    {
      "component_id": "follow-btn",
      "component_type": "button",
      "properties": { "label": "Follow", "variant": "primary" }
    }
  ],
  "layout": { "layout_type": "flex", "constraints": {}, "regions": [] },
  "style": {
    "theme": "modern",
    "colors": { "primary": "#3b82f6", "background": "#ffffff" },
    "typography": { "font_family": "Inter", "font_sizes": {}, "line_heights": {} },
    "spacing": { "scale": [4, 8, 16, 32], "unit": "px" }
  },
  "interactions": [
    { "interaction_id": "follow", "trigger": "click", "action": "followUser", "target": "user" }
  ]
}
```

### Generated React Output
```tsx
// Generation ID: gen_000000000000002a_fcbb18ed5f576ab1
// Hash: a1b2c3d4e5f6789012345678abcdef01
// Deterministic: Same spec + seed = same output

import React from 'react';
import './styles.css';

export default function UserProfileCard({ user }) {
  return (
    <div className="layout_container card">
      {/* Avatar Component */}
      <img 
        id="avatar" 
        src={user.avatar} 
        width={64} 
        height={64}
        className="rounded-full"
        alt="User avatar"
      />
      
      {/* Username Component */}
      <h2 id="username" className="text-xl font-semibold">
        {user.name}
      </h2>
      
      {/* Follow Button */}
      <button 
        id="follow-btn" 
        className="btn btn-primary"
        onClick={() => followUser(user)}
      >
        Follow
      </button>
    </div>
  );
}

function followUser(user) {
  // Generated from interaction spec
  console.log('Following user:', user);
}
```

## Determinism Explained

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC GENERATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Input:                                                        │
│   ├── Spec: {title: "User Card", components: [...]}            │
│   ├── UI Type: "react"                                          │
│   └── Seed: 42  ←──────────────────────────────────────┐       │
│                                                        │       │
│   Process:                                             │       │
│   ├── Hash(spec) = fcbb18ed...                         │       │
│   ├── Generation ID = gen_{seed}_{hash}                │       │
│   │                 = gen_000000000000002a_fcbb18ed... │       │
│   └── Content Hash = hash(seed + spec + code)          │       │
│                    = a1b2c3d4...                       │       │
│                                                        │       │
│   Result:                                              │       │
│   └── ALWAYS same output when same inputs ─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Mode | Description |
|----------|------|-------------|
| `POST /v1/tambo/generate` | Standard | Generate UI from spec |
| `POST /v1/tambo/generate/validated` | Validated | Generate with schema validation |
| `POST /v1/tambo/generate/reproducible` | Deterministic | Generate with seed for reproducibility |
| `POST /v1/tambo/generate/stream` | Streaming | Generate with SSE streaming |
| `GET /v1/tambo/generations/:id/state` | Persistence | Load saved generation state |
| `POST /v1/tambo/generations/:id/state` | Persistence | Save generation state |

## How to Extend

### 1. Add New Component Types

Edit: `domains/kernel/infrastructure/tambo-integration/src/components.rs`

```rust
pub fn generate_component(
    &self,
    spec: &ComponentSpec,
    layout: &LayoutOutput,
    styles: &StyleOutput,
) -> Result<String, TamboError> {
    match spec.component_type.as_str() {
        "button" => self.generate_button(spec, styles),
        "input" => self.generate_input(spec, styles),
        "text" => self.generate_text(spec, styles),
        "image" => self.generate_image(spec, styles),
        "card" => self.generate_card(spec, layout, styles),
        // ADD NEW TYPES HERE:
        "chart" => self.generate_chart(spec, styles),
        "table" => self.generate_table(spec, styles),
        "modal" => self.generate_modal(spec, styles),
        _ => Err(TamboError::UnknownComponent(spec.component_type.clone())),
    }
}
```

### 2. Add New Output Formats

Edit: `domains/kernel/infrastructure/tambo-integration/src/lib.rs`

```rust
pub enum UIType {
    React,
    Vue,
    Svelte,
    PlainHtml,
    // ADD NEW FORMATS:
    Angular,
    Solid,
    WebComponents,
}
```

Then add assembly logic in `generator.rs`:

```rust
fn assemble(&self, components: &[String], layout: &LayoutOutput, styles: &StyleOutput, ui_type: UIType) -> Result<String, TamboError> {
    match ui_type {
        UIType::React => self.assemble_react(components, layout, styles),
        UIType::Vue => self.assemble_vue(components, layout, styles),
        // ADD NEW ASSEMBLY:
        UIType::Angular => self.assemble_angular(components, layout, styles),
        _ => Err(TamboError::AssemblyFailed("Unsupported UI type".to_string())),
    }
}
```

### 3. Add Custom Templates

```typescript
// In your client code
const engine = new TamboEngine();

// Register custom component template
await engine.registerComponentTemplate({
  template_id: "custom-chart-001",
  component_type: "chart",
  template_code: `
    <ChartComponent 
      data={{{data}}} 
      type="{{{chartType}}}"
      colors={{{colors}}}
    />
  `,
  properties: ["data", "chartType", "colors"],
  keywords: ["chart", "graph", "visualization"]
});
```

### 4. Add Validation Rules

Edit: `domains/kernel/infrastructure/tambo-integration/src/schema_validator.rs`

```rust
pub fn validate_spec(&self, spec: &UISpec) -> Result<(), ValidationError> {
    // Existing validation
    if spec.spec_id.is_empty() {
        return Err(ValidationError::new("spec_id is required"));
    }
    
    // ADD NEW VALIDATION RULES:
    if spec.components.len() > 100 {
        return Err(ValidationError::new("Too many components (max 100)"));
    }
    
    for component in &spec.components {
        self.validate_component(component)?;
    }
    
    Ok(())
}
```

## File Locations

| Component | Location |
|-----------|----------|
| Rust Engine | `domains/kernel/infrastructure/tambo-integration/src/` |
| NAPI Bindings | `domains/kernel/infrastructure/tambo-napi/src/lib.rs` |
| TypeScript Wrapper | `services/allternit-gateway/src/kernel/tambo_engine.ts` |
| HTTP Routes | `services/allternit-gateway/src/routes/tambo_routes.ts` |
| HTTP Transport | `services/allternit-gateway/transports/http_server/index.ts` |

## Testing

```bash
# Run E2E verification
cd services/allternit-gateway
npm run verify:tambo

# Test individual endpoints
curl -X POST http://127.0.0.1:3210/v1/tambo/generate \
  -H "Content-Type: application/json" \
  -d '{"spec": {...}, "ui_type": "react"}'
```
