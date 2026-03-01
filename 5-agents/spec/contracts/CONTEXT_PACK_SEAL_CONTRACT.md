# ContextPack Seal Contract & API Spec

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Implements SYSTEM_LAW.md LAW-AUT-002 (Deterministic Rehydration Rule)  
**Schema:** `/harness/schemas/context_pack.schema.json`

---

## 0. Purpose

Define the canonical ContextPack seal contract and API for deterministic WIH rehydration.

**Non-Negotiable:**
- Every WIH execution MUST begin from a sealed ContextPack (LAW-AUT-002)
- ContextPack MUST include LAW + SOT + Architecture + Contracts + WIH
- Seal MUST be deterministic (same inputs → same pack_id)
- Seal MUST be queryable by pack_id

---

## 1. ContextPack Structure

### 1.1 Required Inputs

```typescript
interface ContextPackInputs {
  // Tier-0 Constitutional Law
  tier0_law: string;        // Full text of SYSTEM_LAW.md
  
  // Source of Truth
  sot: string;              // Full text of SOT.md
  
  // Architecture
  architecture: string;     // Full text of ARCHITECTURE.md
  
  // Relevant Contracts (from /spec/Contracts/)
  contracts: ContractFile[];
  
  // Relevant Deltas (from /spec/Deltas/)
  deltas: DeltaFile[];
  
  // Work Item Header
  wih: WIH;
}
```

### 1.2 Contract File Structure

```typescript
interface ContractFile {
  path: string;             // e.g., "/spec/Contracts/agent_manifest.schema.json"
  content: string;          // Full file content
  hash: string;             // "sha256:<64_hex_chars>"
}
```

### 1.3 WIH Structure

```typescript
interface WIH {
  wih_id: string;
  role: "orchestrator" | "planner" | "builder" | "validator" | "reviewer" | "security";
  scope_paths: string[];    // Allowed file paths for writes
  allowed_tools: string[];  // Allowed tool names
  acceptance_refs: string[]; // References to acceptance tests
  execution_mode: "PLAN_ONLY" | "REQUIRE_APPROVAL" | "ACCEPT_EDITS" | "BYPASS_PERMISSIONS";
}
```

---

## 2. ContextPack Seal

### 2.1 Seal Structure

```typescript
interface ContextPackSeal {
  pack_id: string;          // "cp_<sha256_hash>" - deterministic from inputs
  wih_id: string;
  dag_id: string;
  node_id: string;
  inputs_manifest: InputManifestEntry[];
  method_version: string;   // Semver (e.g., "1.0.0")
  created_at: string;       // ISO-8601
  policy_bundle?: PolicyBundleRef;
}
```

### 2.2 Input Manifest Entry

```typescript
interface InputManifestEntry {
  path: string;             // File path
  hash: string;             // "sha256:<64_hex_chars>"
  size_bytes: number;       // File size in bytes
}
```

### 2.3 Policy Bundle Reference

```typescript
interface PolicyBundleRef {
  bundle_id: string;
  agents_md_hash: string;   // Hash of 5-agents/AGENTS.md
  role_envelope: string;    // Role-specific policy (e.g., "builder")
  pack_ids: string[];       // Prompt pack IDs included
}
```

---

## 3. pack_id Generation Algorithm

**Deterministic hash from inputs:**

```typescript
function generatePackId(inputs: ContextPackInputs): string {
  // 1. Collect all input hashes
  const hashes = [
    sha256(inputs.tier0_law),
    sha256(inputs.sot),
    sha256(inputs.architecture),
    ...inputs.contracts.map(c => c.hash.replace('sha256:', '')),
    ...inputs.deltas.map(d => d.hash.replace('sha256:', '')),
    sha256(JSON.stringify(inputs.wih))
  ];
  
  // 2. Sort hashes lexicographically (deterministic ordering)
  hashes.sort();
  
  // 3. Concatenate and hash
  const concatenated = hashes.join('|');
  const packHash = sha256(concatenated);
  
  // 4. Return formatted pack_id
  return `cp_${packHash}`;
}
```

**Invariant:** Same inputs → same pack_id (always)

---

## 4. API Endpoints

### 4.1 POST /context-pack/seal

**Purpose:** Seal a ContextPack and return pack_id

**Request:**
```json
{
  "wih_id": "wih_abc123",
  "dag_id": "dag_xyz789",
  "node_id": "node_001",
  "inputs": {
    "tier0_law": "...",
    "sot": "...",
    "architecture": "...",
    "contracts": [...],
    "deltas": [...],
    "wih": {...}
  },
  "policy_bundle": {
    "bundle_id": "pb_default",
    "agents_md_hash": "sha256:...",
    "role_envelope": "builder",
    "pack_ids": ["pack_001"]
  }
}
```

**Response (200 OK):**
```json
{
  "pack_id": "cp_a1b2c3d4e5f6...",
  "wih_id": "wih_abc123",
  "dag_id": "dag_xyz789",
  "node_id": "node_001",
  "inputs_manifest": [
    {"path": "/SYSTEM_LAW.md", "hash": "sha256:...", "size_bytes": 12345},
    ...
  ],
  "method_version": "1.0.0",
  "created_at": "2026-02-20T12:00:00Z",
  "policy_bundle": {...}
}
```

**Response (400 Bad Request):**
```json
{
  "error": "INVALID_CONTEXT_PACK",
  "details": "Missing required field: tier0_law",
  "validation_errors": [...]
}
```

---

### 4.2 GET /context-pack/:pack_id

**Purpose:** Retrieve a sealed ContextPack by pack_id

**Response (200 OK):**
```json
{
  "pack_id": "cp_a1b2c3d4e5f6...",
  "wih_id": "wih_abc123",
  "dag_id": "dag_xyz789",
  "node_id": "node_001",
  "inputs_manifest": [...],
  "method_version": "1.0.0",
  "created_at": "2026-02-20T12:00:00Z",
  "policy_bundle": {...},
  "inputs": {
    "tier0_law": "...",
    "sot": "...",
    ...
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "CONTEXT_PACK_NOT_FOUND",
  "details": "No ContextPack found with pack_id: cp_..."
}
```

---

### 4.3 GET /context-pack/:pack_id/verify

**Purpose:** Verify ContextPack integrity (hashes match content)

**Response (200 OK):**
```json
{
  "pack_id": "cp_a1b2c3d4e5f6...",
  "valid": true,
  "verified_at": "2026-02-20T12:05:00Z",
  "hash_matches": [
    {"path": "/SYSTEM_LAW.md", "expected": "sha256:...", "actual": "sha256:...", "match": true},
    ...
  ]
}
```

**Response (200 OK, invalid):**
```json
{
  "pack_id": "cp_a1b2c3d4e5f6...",
  "valid": false,
  "verified_at": "2026-02-20T12:05:00Z",
  "hash_matches": [
    {"path": "/SYSTEM_LAW.md", "expected": "sha256:...", "actual": "sha256:...", "match": false},
    ...
  ],
  "errors": ["Hash mismatch for /SYSTEM_LAW.md"]
}
```

---

## 5. Storage Contract

### 5.1 ContextPack Storage Location

```
.a2r/context-packs/<pack_id>/
├── seal.json           # ContextPackSeal
├── inputs/             # Input files (optional, may be references)
│   ├── SYSTEM_LAW.md
│   ├── SOT.md
│   ├── ARCHITECTURE.md
│   ├── contracts/
│   ├── deltas/
│   └── wih.json
└── inputs_manifest.json
```

### 5.2 Persistence Requirements

- ContextPack MUST be persisted before WIH execution begins
- ContextPack MUST be immutable after sealing (append-only storage)
- ContextPack MUST be queryable by pack_id, wih_id, dag_id

---

## 6. Determinism Guarantees

### 6.1 Input Ordering

All arrays MUST be sorted lexicographically before hashing:
- `contracts` sorted by `path`
- `deltas` sorted by `path`
- `inputs_manifest` sorted by `path`

### 6.2 Hash Canonicalization

- All hashes MUST be lowercase hex
- Hash format: `sha256:<64_hex_chars>`
- JSON MUST be canonicalized (keys sorted, no trailing whitespace)

### 6.3 Time Handling

- `created_at` is NOT included in pack_id calculation (allows re-sealing with same inputs)
- `created_at` MUST be ISO-8601 with timezone

---

## 7. Acceptance Tests

### 7.1 AT-CP-001: Deterministic pack_id

```typescript
// Same inputs MUST produce same pack_id
const pack1 = await sealContextPack(inputs);
const pack2 = await sealContextPack(inputs);
assert(pack1.pack_id === pack2.pack_id);
```

### 7.2 AT-CP-002: Schema Validation

```typescript
// ContextPack MUST validate against schema
const valid = validateAgainstSchema(pack, 'context_pack.schema.json');
assert(valid === true);
```

### 7.3 AT-CP-003: Inputs Manifest Completeness

```typescript
// inputs_manifest MUST include all inputs
const allPaths = collectAllInputPaths(inputs);
const manifestPaths = pack.inputs_manifest.map(e => e.path);
assert(allPaths.every(p => manifestPaths.includes(p)));
```

### 7.4 AT-CP-004: Hash Verification

```typescript
// All hashes MUST match actual content
const verified = await verifyContextPack(pack_id);
assert(verified.valid === true);
```

### 7.5 AT-CP-005: Query by WIH

```typescript
// ContextPack MUST be queryable by wih_id
const packs = await queryContextPacks({ wih_id: 'wih_abc123' });
assert(packs.length > 0);
assert(packs[0].wih_id === 'wih_abc123');
```

---

## 8. Integration Points

### 8.1 DAK Runner

- Calls `POST /context-pack/seal` before executing WIH
- Stores pack_id in receipt (`context_pack_seal`)
- Includes pack_id in all subsequent receipts

### 8.2 Rails

- Implements `/context-pack/seal` endpoint
- Stores ContextPack in `.a2r/context-packs/`
- Validates against schema before sealing

### 8.3 CI Gates

- Validates ContextPack schema in CI
- Fails build if pack_id is non-deterministic

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-20 | Initial lock |

---

**END OF CONTRACT**
