# Custom CA bundles

If your organization uses an internal certificate authority or TLS-inspecting proxy, `gizzi-code` can use a custom CA bundle for outbound HTTPS connections.

## Environment variables

`gizzi-code` is built on Bun/Node, so it respects the standard TLS environment variables:

| Variable | Effect |
|---|---|
| `NODE_EXTRA_CA_CERTS` | Path to a PEM-encoded CA bundle. Certificates in this file are added to the default trust store. |
| `SSL_CERT_FILE` | Path to a PEM-encoded CA bundle. Used by some underlying libraries and tools. |
| `SSL_CERT_DIR` | Directory containing hashed CA certificate files. |

### Example

```bash
export NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem
gizzi auth status
```

For a single command:

```bash
NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem gizzi exec "run tests"
```

## Persistent configuration

Add the environment variable to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or to a project-specific `.env` file if your tooling loads it before invoking `gizzi`.

```bash
# ~/.zshrc
export NODE_EXTRA_CA_CERTS="$HOME/.config/gizzi/company-ca.pem"
```

## Verification

Test that the bundle is being used:

```bash
NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem gizzi --version
```

If TLS errors persist, confirm the bundle is PEM-encoded and includes the full certificate chain.

## Scope

Custom CA bundles affect outbound HTTPS connections made by `gizzi-code` and the AI SDK. They do not affect:

- Sandboxed tool execution, which may need its own CA configuration.
- Provider-specific SDKs that read their own CA settings.
- Local development servers using self-signed certificates (those may require `NODE_TLS_REJECT_UNAUTHORIZED=0` in non-production environments).

## Related pages

- [Authentication](./authentication.md)
- [Config and state locations](./config-locations.md)
