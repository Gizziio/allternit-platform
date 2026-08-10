# Check authentication and sign out

`gizzi auth` manages how the CLI authenticates with model providers and the Allternit platform. This page covers checking your current authentication state and running `gizzi-code` on headless machines.

## Check authentication

Run `gizzi auth status` to see the active authentication method and profile:

```bash
gizzi auth status
```

Possible outputs:

- `Authenticated via OAuth token` — signed in through the Allternit web account flow.
- `Authenticated via API key: <profile>` — signed in with an API-key auth profile.
- `Not authenticated` — no valid credentials are stored.

To list all configured profiles, run:

```bash
gizzi auth profile list
```

## Sign out

`gizzi-code` does not yet ship a dedicated `auth logout` command. To remove credentials, delete the active auth profile:

```bash
gizzi auth profile remove default
```

Or delete the credentials file directly. The default location is `~/.config/gizzi-code/config.toml` on macOS and Linux, and `%APPDATA%\gizzi\config.toml` on Windows. Removing the `[auth.profiles]` and `[auth]` sections signs the CLI out.

## Headless and CI authentication

On servers, containers, or CI runners without a browser, use API-key authentication instead of OAuth.

### Non-interactive login

Pipe the key from an environment variable or secret manager:

```bash
printenv ANTHROPIC_API_KEY | gizzi auth login --api-key --provider anthropic --profile ci
```

### Pre-seed a profile in a config file

For reproducible environments, write the profile directly to the config file:

```toml
[auth]
active_profile = "ci"

[auth.profiles.ci]
provider = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"
```

Then run any `gizzi` command without interacting with a login flow:

```bash
gizzi exec --no-interactive "run the tests"
```

### Forward the OAuth callback over SSH

If you must use OAuth on a headless host, you can complete the browser flow on your local machine and copy the resulting credentials to the remote host. The exact steps depend on your provider and SSO setup; in general:

1. Start the OAuth flow on the remote host with `gizzi auth login`.
2. Forward the localhost callback port to your local machine with SSH:
   ```bash
   ssh -L 8080:localhost:8080 remote-host
   ```
3. Complete the browser flow locally.
4. Copy the resulting credential cache or config file back to the remote host.

For most automation, API-key authentication is simpler and more robust.

## Related pages

- [Sign in with an API key](./auth-api-key.md)
- [Credential storage](./credential-store.md)
- [Config and state locations](./config-locations.md)
