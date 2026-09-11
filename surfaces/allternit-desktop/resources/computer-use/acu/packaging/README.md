# allternit-computer service packaging

These templates supervise the packaged `allternit-computer serve` command. The
desktop installer must substitute an absolute executable path, create the state
directory with user-only permissions, preserve `ACU_API_KEY` in the platform
credential store when non-loopback access is explicitly enabled, and validate
`allternit-computer status` before replacing the previous version.

Updates must be staged, signature-verified, health-checked, and rolled back to
the previous signed artifact if health does not become ready. The daemon never
downloads Cua Driver, Cua Sandbox, browser, VM, or scanner dependencies itself.
