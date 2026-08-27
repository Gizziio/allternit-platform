# Credential storage

`gizzi-code` caches your Allternit credentials locally so you don't have to sign in every time you start a session. You can choose exactly how those credentials are stored.

## Storage modes

Use the `cli_auth_credentials_store` setting in your `gizzi` config file to control where credentials are kept:

```toml
# file | keyring | auto
cli_auth_credentials_store = "auto"
```

The supported modes are:

| Mode | Description |
|------|-------------|
| `file` | Store credentials in `auth.json` under `GIZZI_HOME` (defaults to `~/.gizzi`). |
| `keyring` | Store credentials in your operating system's native credential store. |
| `auto` | Use the OS credential store when available; fall back to `auth.json` otherwise. |

`auto` is the default. It lets `gizzi-code` pick the most secure option available on your machine without extra setup.

## File-based storage

When `cli_auth_credentials_store` is set to `file`, `gizzi-code` writes credentials to:

```
~/.gizzi/auth.json
```

On Windows, `~` resolves to your user profile directory, for example:

```
C:\Users\<you>\.gizzi\auth.json
```

File-based storage is useful in headless environments, containers, or CI/CD pipelines where no system keyring is available.

### Security considerations for file storage

Treat `~/.gizzi/auth.json` like a password. It contains access tokens that grant access to your Allternit workspace and resources.

- Do not commit it to version control.
- Do not paste it into tickets, chat messages, or logs.
- Do not copy it to untrusted or shared machines.
- Restrict file permissions when possible:

  ```shell
  chmod 600 ~/.gizzi/auth.json
  ```

## Keyring storage

When set to `keyring`, `gizzi-code` stores credentials in the OS-native credential store:

- **macOS**: Keychain Access
- **Windows**: Windows Credential Manager
- **Linux**: Secret Service API / `gnome-keyring` or `kwallet`

Keyring storage is recommended for everyday local development because credentials are encrypted by the operating system and unlocked only when you are signed in.

## How to select a storage mode

### Using the CLI

Run `gizzi config set` to change the active storage mode:

```shell
# Use the OS keyring
$ gizzi config set cli_auth_credentials_store keyring

# Use a local file
$ gizzi config set cli_auth_credentials_store file

# Let gizzi-code choose automatically
$ gizzi config set cli_auth_credentials_store auto
```

### Using the config file

Edit your `gizzi` configuration file directly. The location depends on your platform:

- macOS / Linux: `~/.config/gizzi/config.toml`
- Windows: `%APPDATA%\gizzi\config.toml`

Example:

```toml
[core]
cli_auth_credentials_store = "keyring"
```

For the complete `config.toml` schema, see the [gizzi configuration reference](../gizzi/configuration.md).

## How credentials are cached

When you run `gizzi auth login`, `gizzi-code` obtains an Allternit access token and stores it according to the active `cli_auth_credentials_store` mode.

- For browser-based sign-in, tokens are refreshed automatically in the background before they expire.
- For API key sign-in, the key is stored and reused for subsequent requests.

You can inspect the current authentication state at any time:

```shell
$ gizzi auth status
```

To clear cached credentials:

```shell
$ gizzi auth logout
```

## Recommendations by environment

| Environment | Recommended mode | Reason |
|-------------|------------------|--------|
| Local development | `keyring` or `auto` | Credentials are protected by the OS. |
| Headless server / container | `file` | No interactive keyring is available. |
| CI/CD pipeline | `file` with short-lived tokens | Easier to seed and rotate between jobs. |
| Shared workstation | `keyring` | Credentials are tied to your OS session, not the filesystem. |

## Managed environments

In managed Allternit workspaces, administrators may enforce storage or authentication restrictions via managed configuration. If the active credentials do not match the configured policy, `gizzi-code` signs the user out and exits.

For example, an admin may require keyring storage or restrict logins to a specific workspace. These settings are typically applied organization-wide rather than edited per-user.

See [Work admin FAQ](../admin/work-admin-faq.md) for details on workspace-level policy controls.
