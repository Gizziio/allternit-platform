# External Keys (BYO KMS)

Register and validate cloud-provider key material for bring-your-own-key (BYOK) and customer-managed encryption key (CMEK) scenarios. The current phase is a scaffold: it stores key references, validates AWS KMS ARN formatting locally, and provides mock encrypt/decrypt for `aws_kms` keys. Real provider calls (`DescribeKey`, `GetKey`, `GetCryptoKey`) are follow-on work.

## Supported providers

| Provider | `provider` value | Key reference | Validation |
|----------|------------------|---------------|------------|
| AWS KMS | `aws_kms` | KMS key ARN | ARN format checked locally |
| AWS (generic) | `aws` | Arbitrary reference | Stored as-is |
| Azure | `azure` | Azure Key Vault reference | Placeholder |
| GCP | `gcp` | Cloud KMS resource ID | Placeholder |

## Authentication

Organization owner or admin only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/external-keys` | Register an external key |
| `GET` | `/api/v1/admin/external-keys` | List keys |
| `GET` | `/api/v1/admin/external-keys/:id` | Get a key |
| `PUT` | `/api/v1/admin/external-keys/:id` | Update name/key_ref |
| `DELETE` | `/api/v1/admin/external-keys/:id` | Delete a key |
| `POST` | `/api/v1/admin/external-keys/:id/validate` | Mark the key as validated |
| `POST` | `/api/v1/admin/external-keys/:id/encrypt` | Mock encrypt (aws_kms only) |
| `POST` | `/api/v1/admin/external-keys/:id/decrypt` | Mock decrypt (aws_kms only) |

## Key fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `provider` | string | `aws`, `azure`, `gcp`, `aws_kms` |
| `key_ref` | string | ARN, resource ID, or other reference |
| `name` | string | 1–128 characters |
| `validation_status` | string | `pending` or `valid` |
| `last_validated_at` | string \| null | ISO 8601 timestamp |
| `created_by` | string | User ID |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

## AWS KMS ARN validation

For `provider: "aws_kms"`, `key_ref` must match:

```
arn:aws:kms:<region>:<account>:key/<id-or-alias>
```

Examples:

```bash
# Valid
arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789abc

# Invalid
arn:aws:kms:us-east-1:123456789
arn:aws:kms:us-east-1:123456789:key/
```

## Register an AWS KMS key

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/external-keys" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "aws_kms",
    "key_ref": "arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789abc",
    "name": "Production CMEK"
  }'
```

```json
{
  "id": "ek_01J8Z...",
  "provider": "aws_kms",
  "key_ref": "arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789abc",
  "name": "Production CMEK",
  "validation_status": "pending",
  "last_validated_at": null,
  "created_by": "user_123",
  "created_at": "2026-08-09T09:00:00Z",
  "updated_at": "2026-08-09T09:00:00Z"
}
```

## Validate a key

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/external-keys/ek_01J8Z.../validate" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

The current implementation flips `validation_status` to `valid` without calling the cloud provider. In production this will be replaced with provider-side verification.

## Mock encrypt/decrypt

`aws_kms` keys support a local mock encrypt that wraps plaintext in a base64 blob prefixed with the key ID. It is intended for integration testing only.

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/external-keys/ek_01J8Z.../encrypt" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"plaintext": "hello world"}'
```

```json
{
  "ciphertext": "kms:ek_01J8Z...:aGVsbG8gd29ybGQ=",
  "key_id": "ek_01J8Z..."
}
```

Decrypt the same blob:

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/external-keys/ek_01J8Z.../decrypt" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"ciphertext": "kms:ek_01J8Z...:aGVsbG8gd29ybGQ="}'
```

```json
{
  "plaintext": "hello world",
  "key_id": "ek_01J8Z..."
}
```

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `invalid_provider` | 400 | Provider not in `aws`, `azure`, `gcp`, `aws_kms` |
| `invalid_key_ref` | 400 | Empty reference or invalid AWS KMS ARN |
| `invalid_name` | 400 | Name empty or longer than 128 characters |
| `unsupported_provider` | 400 | Encrypt/decrypt called on a non-aws_kms key |
| `external_key_not_found` | 404 | Key does not exist in this organization |
