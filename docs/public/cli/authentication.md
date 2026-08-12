# Authentication

`gizzi-code` supports multiple ways to authenticate, so you can use the model provider and account that fit your workflow.

## Authentication methods

### API key

The simplest method for automation, CI, and headless machines. Store a provider API key in an auth profile:

```bash
gizzi auth login --api-key --provider anthropic --profile work
```

The key is stored according to the active credential store (`file`, `keyring`, or `auto`). See [Credential storage](./credential-store.md) for details.

### OAuth

For interactive use with an Allternit or provider OAuth flow, use the web sign-in option when available. OAuth tokens are stored in the runtime auth store (`~/.local/share/gizzi/auth.json` on Linux, `~/Library/Application Support/gizzi/auth.json` on macOS).

## Check and manage authentication

```bash
# Show the active authentication method
gizzi auth status

# Print diagnostic information
gizzi auth diagnose

# List profiles
gizzi auth profile list

# Add a profile
gizzi auth profile add local --provider openai-compatible --base-url http://localhost:11434/v1

# Switch active profile
gizzi auth profile set-active work

# Sign out
gizzi auth logout
```

`gizzi auth diagnose` prints the config path, active method, profile names, credential store, runtime auth keys, and relevant environment variables. Use it to debug connection or authentication issues.

## Login caching

`gizzi-code` caches authentication state between runs:

- API keys and profile metadata live in `~/.config/gizzi-code/config.toml`.
- OAuth tokens live in the runtime auth store.
- Credentials referenced by `api_key_env` are read from the environment on each run and are never persisted.

To force a fresh sign-in, run `gizzi auth logout` and then `gizzi auth login`.

## Per-project authentication

You can override the active profile for a single project by setting the `GIZZI_PERMISSION` environment variable or by using CLI flags:

```bash
gizzi --profile work "review this PR"
```

## Security notes

- Prefer `keyring` or `auto` credential stores over `file` for interactive machines.
- In CI or shared runners, use `api_key_env` so secrets are injected by the environment and not written to disk.
- Do not commit `config.toml` files that contain `api_key` values.

## Related pages

- [Sign in with an API key](./auth-api-key.md)
- [Credential storage](./credential-store.md)
- [Auth status and headless login](./auth-status-and-headless.md)
