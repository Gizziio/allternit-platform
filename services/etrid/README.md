# Etrid — Allternit Native Agent Wallet

Etrid is the Allternit-native wallet for autonomous agents and bots. It gives every bot a scoped cryptographic identity and payment capability without forcing users to bring their own wallet.

## Responsibility

- Generate and store agent wallet keys (vault-sealed).
- Sign messages and transactions on behalf of an agent.
- Create payment invoices and payment URIs.
- Expose an HTTP API for the Allternit platform to provision wallets during bot creation.

## Architecture

```text
services/etrid
├── src/lib.rs      # Wallet types, WalletStore, signing, invoices
├── src/vault.rs    # KeyVault trait + in-memory dev vault
└── src/main.rs     # Axum HTTP service
```

### Wallet kinds

- `identity` — Ed25519 key used for agent identity and ACP signatures.
- `evm` — secp256k1 key for EVM on-chain operations (phase 2).

### Security

Phase 1 stores raw private keys in an in-memory map. Production must plug in the Allternit vault (`allternit_vault.rs`) or an external KMS via the `KeyVault` trait so keys are sealed at rest and unsealed only at signing time.

## HTTP API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/wallets` | Create a wallet |
| GET | `/wallets/:agent_id` | List agent wallets |
| POST | `/wallets/:id/sign` | Sign a message |
| POST | `/invoices` | Create a payment invoice |

## Run locally

```bash
cargo run -p allternit-etrid
```

The service binds to `0.0.0.0:8723`.

## Integration with bots

Bots declare an Etrid wallet in `AgentIdentityChannels.wallet.provider = 'etrid'`. During bot creation the platform calls `POST /wallets` and writes the returned `key_vault_ref` and `address` back into the agent record.
