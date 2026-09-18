# Computer Use VM Ownership Matrix

| Concern | Authority | Notes |
|---|---|---|
| Logical environment ID, owner, state, TTL, quota | Canonical `EnvironmentAuthority` | Durable SQLite record; no backend side effects hidden in registry operations. |
| Exclusive agent/human control | Canonical environment leases | One active lease per environment. |
| Image digest, provenance, scan gate | Canonical image registry | Backend cannot provision an unclean registered image. |
| macOS/Linux VM process lifecycle | Existing Allternit Apple-VF/Firecracker sandbox factory | Reused through `AllternitSandboxBackend`; process fallback disabled for canonical VM requests. |
| Linux container, Lume, QEMU/Hyper-V, Android | Optional Cua Sandbox backend | Advertised per installed OS/isolation runtime cell; telemetry off and cloud disabled. |
| Firecracker command transport | Unavailable until guest agent is proven | Canonical execution fails instead of running commands on the host. |
| Legacy TS VM sessions/Cowork driver | Migration-only | Must bind to canonical IDs or retire; cannot become a second authority. |
| Snapshots/clones | Canonical lineage plus backend reference | Clone remains requested until backend restore succeeds. |

This resolves routing ownership without deleting legacy implementations before
their callers have migrated. A backend owns only instances it explicitly starts;
discovery does not take ownership of unrelated VMs or browsers.
