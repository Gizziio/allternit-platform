# Agent internet access

By default, `gizzi-code` restricts network access during agent execution. You can enable and scope internet access through sandbox and approval policy settings.

## Risks of agent internet access

Enabling network access increases security risk:

- Prompt injection from untrusted web content
- Exfiltration of code or secrets
- Downloading malware or vulnerable dependencies
- Pulling in content with license restrictions

Keep network access as limited as possible. Prefer domain allowlists over unrestricted access.

## Configuring agent internet access

Network access is controlled by the `sandbox` config:

```toml
[sandbox]
enabled = true
allow_network = true
allowed_domains = ["api.github.com", "pypi.org", "registry.npmjs.org"]
```

- `allow_network = false` — completely blocks outbound network requests.
- `allow_network = true` — allows requests to domains in `allowed_domains`.
- If `allowed_domains` is empty or unset and `allow_network = true`, the effective policy depends on the sandbox mode and tool implementation.

## Allowed HTTP methods

`gizzi-code` does not currently restrict HTTP methods independently of the sandbox. Tools that perform network requests generally use `GET` for fetching and `POST` only when explicitly required by a tool call. Use granular approval rules to require approval for network-related tools such as `web_fetch` or `bash` when network access is enabled.

## Preset domain lists

There is no built-in preset domain list yet. Start with an empty allowlist and add domains as needed:

```toml
[sandbox]
allow_network = true
allowed_domains = []
```

A reasonable starter set for dependency-heavy projects:

```toml
[sandbox]
allowed_domains = [
  "github.com",
  "api.github.com",
  "pypi.org",
  "files.pythonhosted.org",
  "registry.npmjs.org",
  "npmjs.org",
  "crates.io",
  "index.crates.io",
]
```

## Common dependencies

Agents often need to reach package registries and source-control hosts. The exact domains depend on your project's language and build system. Monitor sandbox denials during a session to discover additional domains to allow.

## Related pages

- [Agent approvals and security](./agent-approvals-security.md)
- [Advanced configuration](./advanced-configuration.md)
