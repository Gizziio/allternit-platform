# Cloud environments

`gizzi-code` can run inside containers and cloud development environments. The sandbox and approval system adapts to container boundaries, so you can use stricter presets in shared or ephemeral environments.

## Automatic setup

When `gizzi-code` detects it is running inside a container (for example, via `/.dockerenv` or `container` cgroup), it:

- Uses the container filesystem as the workspace root.
- Disables OS-level sandbox features that are not available inside the container.
- Respects the same config files and environment variables as a local install.

## Manual setup

To install `gizzi-code` in a cloud environment or container image:

```dockerfile
FROM oven/bun:1
RUN bun install -g @allternit/gizzi-code
ENV PATH="/root/.bun/bin:${PATH}"
WORKDIR /workspace
CMD ["gizzi", "serve"]
```

Or install locally per project:

```bash
bun add -d @allternit/gizzi-code
```

## Default universal image

There is no single official Allternit container image yet. Use a base image that includes your project's toolchain (Node, Python, Rust, etc.) and install `gizzi-code` on top.

## Container caching

To speed up repeated container starts:

- Mount `~/.config/gizzi-code/` and `~/.cache/gizzi/` as volumes.
- Pre-install commonly used provider SDKs and model caches in the image.
- Pin plugin and skill versions in project config.

## Environment variables and secrets

In cloud environments, inject secrets through the orchestrator rather than writing them to image layers:

```bash
docker run -e ANTHROPIC_API_KEY -e DISABLE_TELEMETRY=1 -it my-gizzi-image
```

For Allternit platform credentials, use `api_key_env` in auth profiles so the key is read from the environment at runtime.

## Related pages

- [Codex Remote](./codex-remote.md)
- [OSS mode and local providers](./oss-mode.md)
- [Config and state locations](./config-locations.md)
