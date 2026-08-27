# Sign in with an API key

`gizzi-code` supports two ways to authenticate with the Allternit platform and model providers:

- **Sign in with OAuth** through the Allternit web account flow
- **Sign in with an API key** for provider-direct, usage-based access

The same `gizzi` binary powers the web surface, desktop surface, and iOS agent bridge. This page focuses on API key authentication in `gizzi-code`.

Your authentication method determines which admin controls, billing rules, and data-handling policies apply:

- When you sign in with OAuth, usage follows your Allternit workspace permissions, role-based access control (RBAC), and organization retention settings.
- With an API key, usage follows the provider's own billing and data policies, and you are responsible for key rotation and access controls.

## Sign in with an API key

Get an API key from your provider dashboard (for example, Anthropic, OpenAI, or an OpenAI-compatible endpoint), then add it to `gizzi-code`.

### Interactive login

Run `gizzi auth login --api-key` without a value to enter the key safely at the prompt:

```bash
gizzi auth login --api-key --provider anthropic --profile work
```

### Non-interactive login

Pipe the key from an environment variable or secret manager:

```bash
printenv ANTHROPIC_API_KEY | gizzi auth login --api-key --provider anthropic --profile work
```

### Specify a custom endpoint

For OpenAI-compatible providers or local inference, include a `base_url`:

```bash
printenv LOCAL_API_KEY | gizzi auth login --api-key \
  --provider openai-compatible \
  --base-url http://localhost:11434/v1 \
  --profile local
```

### What happens on success

`gizzi` stores the profile under `~/.config/gizzi-code/config.toml` according to `auth.credential_store`:

```toml
[auth]
active_profile = "work"
credential_store = "auto"

[auth.profiles.work]
provider = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"
```

The first profile created becomes the active profile automatically. Subsequent profiles can be activated with `gizzi auth profile set-active`.

## API key storage

Control where secrets are persisted with `auth.credential_store`:

| Store     | Behavior                                                                 |
| --------- | ------------------------------------------------------------------------ |
| `file`    | Secrets are written inline in `config.toml` under the auth profile.      |
| `keyring` | Secrets are delegated to the OS keyring via a pluggable backend.         |
| `auto`    | Prefer keyring; fall back to `file` if no keyring backend is available.  |

```toml
[auth]
credential_store = "keyring"
```

When `file` is used, `config.toml` is created with `0o600` permissions. Treat it like a password file: do not commit it, paste it into tickets, or share it in chat.

## Switch between OAuth and API key authentication

`gizzi-code` lets you maintain multiple authentication profiles and switch between them.

### List profiles

```bash
gizzi auth profile list
```

Typical output:

```
  work    api-key      anthropic
* oauth   oauth        allternit
  local   api-key      openai-compatible
```

The `*` marks the active profile.

### Switch profiles

```bash
# Use an API key profile
gizzi auth profile set-active work

# Use an OAuth profile
gizzi auth profile set-active oauth
```

### Add an OAuth profile

If you initially signed in with an API key and later want to add OAuth, run:

```bash
gizzi auth login --profile oauth
```

This opens a browser window for the Allternit OAuth flow. When the flow completes, the OAuth profile is stored and can be activated like any other profile.

### Remove a profile

```bash
gizzi auth profile remove work
```

If the removed profile was active, `gizzi` falls back to the next available profile or reports `Not authenticated`.

## Check authentication or sign out

Check the current state:

```bash
gizzi auth status
```

Output is one of:

- `Authenticated via OAuth token`
- `Authenticated via API key: <profile>`
- `Not authenticated`

Sign out and clear cached credentials:

```bash
gizzi auth logout
```

## Use API key authentication for automation

API key authentication is the recommended default for programmatic `gizzi-code` workflows, such as CI/CD jobs or unattended scripts.

Use `gizzi exec` for headless execution:

```bash
echo "Summarize the latest commits" | gizzi exec
```

Do not expose `gizzi` execution in untrusted or public environments. Store API keys in environment variables or a secret manager, and reference them with `api_key_env` in the profile rather than inlining them in `config.toml` whenever possible.

## Login caching

When you sign in to `gizzi-code` using OAuth or an API key, your login details are cached and reused. Cached credentials are stored locally in `~/.config/gizzi-code/config.toml` or in your OS-specific credential store, depending on `auth.credential_store`.

For OAuth sessions, `gizzi` refreshes tokens automatically before they expire, so active sessions usually continue without requiring another browser login.

## Enforce an authentication method

In managed environments, admins may restrict how users are allowed to authenticate:

```toml
# Only allow OAuth login or only allow API key login.
forced_login_method = "oauth" # or "api_key"

# When using OAuth login, restrict users to a specific workspace.
forced_workspace_id = "00000000-0000-0000-0000-000000000000"
```

If the active credentials do not match the configured restrictions, `gizzi` logs the user out and exits.

These settings are commonly applied through managed configuration rather than per-user setup.

## Login on headless devices

If the browser-based OAuth flow does not work in your environment (for example, a remote server or a container), use an API key profile instead:

```bash
printenv ANTHROPIC_API_KEY | gizzi auth login --api-key --provider anthropic --profile headless
```

For trusted private runners, you can also copy an existing `config.toml` or auth cache from a machine where login succeeded. Treat the copied file like a password: it contains credentials. Do not commit it or share it in chat.

Copy to a remote machine over SSH:

```bash
ssh user@remote 'mkdir -p ~/.config/gizzi-code'
scp ~/.config/gizzi-code/config.toml user@remote:~/.config/gizzi-code/config.toml
```

Or use a one-liner that avoids `scp`:

```bash
ssh user@remote 'mkdir -p ~/.config/gizzi-code && cat > ~/.config/gizzi-code/config.toml' < ~/.config/gizzi-code/config.toml
```

## Custom CA bundles

If your network uses a corporate TLS proxy or private root CA, set `GIZZI_CA_CERTIFICATE` to a PEM bundle before logging in:

```bash
export GIZZI_CA_CERTIFICATE=/path/to/corporate-root-ca.pem
gizzi auth login
```

When `GIZZI_CA_CERTIFICATE` is unset, `gizzi` falls back to `SSL_CERT_FILE`. The same custom CA settings apply to login, normal HTTPS requests, and secure WebSocket connections.

## See also

- [`gizzi/index.md`](../gizzi/index.md) — overview of the `gizzi-code` CLI
- [`gizzi/configuration.md`](../gizzi/configuration.md) — full `config.toml` reference
