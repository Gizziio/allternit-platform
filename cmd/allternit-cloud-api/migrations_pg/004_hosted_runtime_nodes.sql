-- 004_hosted_runtime_nodes.sql
--
-- Multi-node workload scheduling: docker hosts that hosted runtime
-- containers can be placed on, and the node assignment per instance.
--
-- docker_host is 'local' for the control-plane daemon or a docker CLI -H
-- target (e.g. ssh://root@allternit-standby). Instances with node_id NULL
-- predate placement and count against the node whose docker_host is 'local'.

CREATE TABLE public.hosted_runtime_nodes (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    docker_host text NOT NULL,
    tailnet_ip text,
    total_memory_mb bigint NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.hosted_runtime_nodes OWNER TO postgres;

ALTER TABLE public.hosted_runtime_instances
    ADD COLUMN node_id text REFERENCES public.hosted_runtime_nodes(id);

-- The standby node is 'draining' on purpose: it is the HA reserve and is
-- only flipped to 'active' manually during failover.
INSERT INTO public.hosted_runtime_nodes (id, name, docker_host, tailnet_ip, total_memory_mb, status) VALUES
    ('node-mail', 'mail (control plane)', 'local', '100.108.37.126', 17408, 'active'),
    ('node-standby', 'allternit-standby (HA reserve)', 'ssh://root@allternit-standby', '100.83.199.24', 17408, 'draining')
ON CONFLICT (id) DO NOTHING;
