-- 006_hosted_retail_rates.sql
--
-- Retail metered rates for hosted containers by size (provider 'contabo',
-- region 'hosted') — PG mirror of migrations/027_hosted_retail_rates.sql.
--
-- The pre-027 default rates were Fly's retail prices and the provision path
-- never set cost_rate_* on hosted_runtime_instances, so containers metered at
-- $0.00/hr. Our infra is Contabo; these are OUR retail rates by container size.
--
-- Rationale: a Contabo VPS 8 costs ~$15/mo = $0.0208/hr for the whole node;
-- a 1GB/1vCPU container is ~1/8 of that node = $0.0026/hr raw cost. $0.015/hr
-- for the 1GB tier is ~5.8x raw cost — healthy margin while staying
-- competitive with Fly retail ($0.0079/GB-hr) and Railway (~$0.028/GB-hr).
--
-- Idempotent: cost_rates has PRIMARY KEY (provider, region, instance_type)
-- (migrations_pg/001, constraint idx_21556_sqlite_autoindex_cost_rates_1).

INSERT INTO public.cost_rates (provider, region, instance_type, cost_per_hour, storage_cost_per_gb_month, transfer_cost_per_gb, currency, effective_from) VALUES
    ('contabo', 'hosted', 'hosted-512mb',  0.0075, 0.0, 0.0, 'USD', CURRENT_TIMESTAMP),
    ('contabo', 'hosted', 'hosted-1024mb', 0.0150, 0.0, 0.0, 'USD', CURRENT_TIMESTAMP),
    ('contabo', 'hosted', 'hosted-2048mb', 0.0290, 0.0, 0.0, 'USD', CURRENT_TIMESTAMP)
ON CONFLICT (provider, region, instance_type) DO NOTHING;
