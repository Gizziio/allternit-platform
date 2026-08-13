-- Kimi parity R6: workspace-scoped IP allowlisting for admin workspaces.
ALTER TABLE admin_workspaces ADD COLUMN allowed_ips TEXT;
