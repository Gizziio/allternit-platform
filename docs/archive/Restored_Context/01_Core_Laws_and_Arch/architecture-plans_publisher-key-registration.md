# Publisher Key Registration and Identity Continuity

This system ties every skill and agent template to a registered publisher key. The key
becomes the root of accountability for any agent or subagent that invokes tools and skills.
Signatures ensure that the payload used in production can always be traced back to a
verified publisher identity.

Why this matters
- Identity continuity: a publisher key anchors the lifecycle of an agent/subagent across
  versions, deployments, and environments.
- Culpability: signatures prove who authored an agent template or skill bundle.
- Rotation + revocation: keys can be revoked or replaced without rewriting history.

What is signed
- Skills: the canonical skill payload (manifest, workflow, tools, human_routing) with
  `manifest.signature` fields blanked.
- Agents: the canonical agent payload with `signature` fields blanked.
- The bundle hash is `sha256:<hex>` of the canonical payload.
- The signature is Ed25519 over the raw SHA-256 digest.

## CLI helper workflow

1) Generate an Ed25519 keypair

```bash
a2 skills keys generate your.publisher key1 --output publisher_key.json
```

This outputs:
- `public_key` (base64) → register with the kernel
- `private_key` (base64 PKCS8) → keep secure; used for signing

2) Register the public key

```bash
a2 skills keys register your.publisher key1 <public_key_base64>
```

3) Sign a skill JSON file

```bash
a2 skills sign skill --input skill.json --private-key <private_key_base64> --output skill.signed.json
```

4) Sign an agent template JSON file

```bash
a2 skills sign agent --input agent.json --private-key <private_key_base64> --output agent.signed.json
```

5) Register the signed payloads

Skills:

```bash
curl -X POST http://localhost:3004/v1/skills \
  -H "Content-Type: application/json" \
  -d @skill.signed.json
```

Agents:

```bash
curl -X POST http://localhost:3004/v1/agents/templates \
  -H "Content-Type: application/json" \
  -d @agent.signed.json
```

## Shell UI (non-technical flow)

1) Open Studio -> Skill Builder -> Local Identity Vault.
2) Enter a passphrase and click "Generate Key". This creates a local Ed25519 keypair and attempts to register the public key.
3) Choose "Use for Signing" to make it the active identity.
4) When you save a Skill or Agent, the UI auto-registers the key if needed and auto-signs the payload.

Notes
- Private keys never leave the device. The kernel only stores public keys.
- The vault must be unlocked before signing. Lock it when you are done.
- The vault uses WebCrypto Ed25519; if your browser blocks it, use the CLI workflow above.

## Operational guidance

- Use a stable `publisher_id` for an organization or product line.
- Rotate keys by issuing a new `public_key_id` and revoking the old one.
- Agents/subagents should always be signed before promotion to production.
- If a key is revoked, the registry will reject any new payloads signed with it.
