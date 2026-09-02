--
-- PostgreSQL database dump
--

\restrict BQ4USXIuAXydMh6B8Vbvw0Q40PaIz9ibZtTgYCTgWPaQYVEUbBZHx7DiU2S5AeF

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: approvalpriority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approvalpriority AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);


ALTER TYPE public.approvalpriority OWNER TO postgres;

--
-- Name: approvalstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approvalstatus AS ENUM (
    'pending',
    'approved',
    'denied',
    'timed_out',
    'cancelled'
);


ALTER TYPE public.approvalstatus OWNER TO postgres;

--
-- Name: assigneetype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.assigneetype AS ENUM (
    'human',
    'agent'
);


ALTER TYPE public.assigneetype OWNER TO postgres;

--
-- Name: clienttype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.clienttype AS ENUM (
    'terminal',
    'web',
    'desktop',
    'mobile',
    'api'
);


ALTER TYPE public.clienttype OWNER TO postgres;

--
-- Name: eventtype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.eventtype AS ENUM (
    'run_created',
    'run_started',
    'run_completed',
    'run_failed',
    'run_cancelled',
    'run_paused',
    'run_resumed',
    'step_started',
    'step_completed',
    'step_failed',
    'step_skipped',
    'stdout',
    'stderr',
    'output',
    'tool_call',
    'tool_result',
    'approval_needed',
    'approval_given',
    'approval_denied',
    'approval_timeout',
    'checkpoint_created',
    'checkpoint_restored',
    'job_queued',
    'job_started',
    'job_completed',
    'job_failed',
    'job_cancelled',
    'heartbeat',
    'warning',
    'error'
);


ALTER TYPE public.eventtype OWNER TO postgres;

--
-- Name: jobstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.jobstatus AS ENUM (
    'pending',
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'retrying'
);


ALTER TYPE public.jobstatus OWNER TO postgres;

--
-- Name: misfirepolicy; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.misfirepolicy AS ENUM (
    'ignore',
    'fire_once',
    'fire_all'
);


ALTER TYPE public.misfirepolicy OWNER TO postgres;

--
-- Name: runmode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.runmode AS ENUM (
    'local',
    'remote',
    'cloud'
);


ALTER TYPE public.runmode OWNER TO postgres;

--
-- Name: runstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.runstatus AS ENUM (
    'pending',
    'planning',
    'queued',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE public.runstatus OWNER TO postgres;

--
-- Name: taskqueuestatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.taskqueuestatus AS ENUM (
    'pending',
    'claimed',
    'running',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE public.taskqueuestatus OWNER TO postgres;

--
-- Name: taskrisk; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.taskrisk AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.taskrisk OWNER TO postgres;

--
-- Name: taskstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.taskstatus AS ENUM (
    'backlog',
    'todo',
    'in_progress',
    'in_review',
    'done'
);


ALTER TYPE public.taskstatus OWNER TO postgres;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userrole AS ENUM (
    'admin',
    'developer',
    'viewer',
    'service'
);


ALTER TYPE public.userrole OWNER TO postgres;

--
-- Name: userstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userstatus AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.userstatus OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sqlx_migrations (
    version bigint NOT NULL,
    description text,
    installed_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    success boolean,
    checksum bytea,
    execution_time bigint
);


ALTER TABLE public._sqlx_migrations OWNER TO postgres;

--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_tokens (
    id text NOT NULL,
    token_hash text,
    name text,
    user_id text,
    permissions text DEFAULT '["*"]'::text,
    scopes text DEFAULT '["*"]'::text,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp with time zone
);


ALTER TABLE public.api_tokens OWNER TO postgres;

--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_requests (
    id text NOT NULL,
    run_id text,
    step_cursor text,
    status public.approvalstatus DEFAULT 'pending'::public.approvalstatus,
    priority public.approvalpriority DEFAULT 'normal'::public.approvalpriority,
    title text,
    description text,
    action_type text,
    action_params json,
    reasoning text,
    requested_by text,
    responded_by text,
    response_message text,
    timeout_seconds bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responded_at timestamp with time zone
);


ALTER TABLE public.approval_requests OWNER TO postgres;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attachments (
    id text NOT NULL,
    run_id text,
    client_id text,
    client_type public.clienttype,
    user_id text,
    cursor_sequence bigint DEFAULT '0'::bigint,
    attached_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    detached_at timestamp with time zone
);


ALTER TABLE public.attachments OWNER TO postgres;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    action text,
    resource_type text,
    resource_id text,
    user_id text,
    user_email text,
    token_id text,
    ip_address text,
    user_agent text,
    request_path text,
    request_method text,
    status_code bigint,
    details text,
    success boolean DEFAULT true
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    action text,
    resource_type text,
    resource_id text,
    user_id text,
    details json,
    ip_address text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: billing_entitlement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.billing_entitlement_events (
    id text NOT NULL,
    user_id text,
    previous_plan_tier_id text,
    plan_tier_id text,
    source text DEFAULT 'billing'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.billing_entitlement_events OWNER TO postgres;

--
-- Name: byo_bootstrap_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.byo_bootstrap_tokens (
    id text NOT NULL,
    user_id text,
    instance_name text,
    token_hash text,
    expires_at timestamp with time zone,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.byo_bootstrap_tokens OWNER TO postgres;

--
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checkpoints (
    id text NOT NULL,
    run_id text,
    name text,
    description text,
    step_cursor text,
    workspace_state json,
    approval_state json,
    context json,
    resumable boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    restored_at timestamp with time zone
);


ALTER TABLE public.checkpoints OWNER TO postgres;

--
-- Name: cloud_instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cloud_instances (
    id text NOT NULL,
    server_id text,
    provider text,
    name text,
    region text,
    instance_type text,
    status text,
    public_ip text,
    private_ip text,
    ssh_key text,
    run_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cloud_instances OWNER TO postgres;

--
-- Name: cost_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cost_alerts (
    id text NOT NULL,
    user_id text,
    alert_type text,
    threshold_percent real,
    current_cost real,
    budget_amount real,
    message text,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cost_alerts OWNER TO postgres;

--
-- Name: cost_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cost_rates (
    provider text NOT NULL,
    region text NOT NULL,
    instance_type text NOT NULL,
    cost_per_hour real DEFAULT '0'::real,
    storage_cost_per_gb_month real DEFAULT '0'::real,
    transfer_cost_per_gb real DEFAULT '0'::real,
    currency text DEFAULT 'USD'::text,
    effective_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cost_rates OWNER TO postgres;

--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_transactions (
    id text NOT NULL,
    user_id text,
    amount_usd real,
    transaction_id text,
    source text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.credit_transactions OWNER TO postgres;

--
-- Name: deployments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deployments (
    id text NOT NULL,
    provider_id text,
    region_id text,
    instance_type_id text,
    storage_gb bigint,
    instance_name text,
    status text,
    progress bigint DEFAULT '0'::bigint,
    message text,
    error_message text,
    instance_id text,
    instance_ip text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone
);


ALTER TABLE public.deployments OWNER TO postgres;

--
-- Name: dispatch_handoff_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatch_handoff_tokens (
    token text NOT NULL,
    user_id text,
    runtime_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    claimed_at timestamp with time zone
);


ALTER TABLE public.dispatch_handoff_tokens OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id text NOT NULL,
    run_id text,
    sequence bigint,
    event_type public.eventtype,
    payload json,
    source_client_id text,
    source_client_type text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: gizzi_instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gizzi_instances (
    id text NOT NULL,
    user_id text,
    name text,
    url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.gizzi_instances OWNER TO postgres;

--
-- Name: hosted_runtime_instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosted_runtime_instances (
    id text NOT NULL,
    user_id text,
    organization_id text,
    runtime_device_id text,
    provider text DEFAULT 'fly'::text,
    billing_mode text DEFAULT 'allternit'::text,
    fly_app text,
    fly_machine_id text,
    fly_volume_id text,
    bootstrap_token_hash text,
    region text,
    cpu_kind text,
    cpus bigint,
    memory_mb bigint,
    status text DEFAULT 'creating'::text,
    started_at timestamp with time zone,
    stopped_at timestamp with time zone,
    destroyed_at timestamp with time zone,
    monthly_cost_cap real,
    cost_rate_provider text,
    cost_rate_region text,
    cost_rate_instance_type text,
    last_synced_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    name text DEFAULT 'Allternit Hosted'::text,
    idle_timeout_minutes bigint DEFAULT '15'::bigint,
    last_activity_at timestamp with time zone,
    active_since timestamp with time zone,
    stop_reason text
);


ALTER TABLE public.hosted_runtime_instances OWNER TO postgres;

--
-- Name: hosted_runtime_usage_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosted_runtime_usage_sessions (
    id text NOT NULL,
    hosted_instance_id text,
    user_id text,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp with time zone,
    duration_seconds bigint,
    cost_per_hour real DEFAULT '0'::real,
    estimated_cost_usd real,
    stop_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.hosted_runtime_usage_sessions OWNER TO postgres;

--
-- Name: instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instances (
    id text NOT NULL,
    name text,
    provider_id text,
    region_id text,
    instance_type_id text,
    public_ip text,
    private_ip text,
    status text,
    deployment_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen timestamp with time zone
);


ALTER TABLE public.instances OWNER TO postgres;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id text NOT NULL,
    run_id text,
    name text,
    description text,
    status public.jobstatus,
    priority bigint DEFAULT '0'::bigint,
    queue_position bigint,
    config json,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    exit_code bigint,
    result json,
    error_message text,
    retry_count bigint DEFAULT '0'::bigint,
    max_retries bigint DEFAULT '0'::bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- Name: mirror_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mirror_sessions (
    id text NOT NULL,
    run_id text,
    user_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text,
    client_count bigint DEFAULT '0'::bigint,
    last_activity_at timestamp with time zone,
    access_token text,
    pairing_code text
);


ALTER TABLE public.mirror_sessions OWNER TO postgres;

--
-- Name: plan_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_tiers (
    id text NOT NULL,
    display_name text,
    max_active_devices bigint DEFAULT '1'::bigint,
    max_pairings_per_day bigint DEFAULT '5'::bigint,
    max_relay_sockets bigint DEFAULT '5'::bigint,
    max_relay_mb_per_day bigint DEFAULT '100'::bigint,
    max_hosted_runtime_hours_monthly bigint DEFAULT '0'::bigint,
    can_create_hosted_runtime boolean DEFAULT false,
    hard_spend_cap_usd real,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    max_hosted_runtimes bigint DEFAULT '0'::bigint,
    max_hosted_runtime_memory_mb bigint DEFAULT '0'::bigint
);


ALTER TABLE public.plan_tiers OWNER TO postgres;

--
-- Name: provider_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_credentials (
    id text NOT NULL,
    provider_id text,
    credential_name text,
    encrypted_data bytea,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone
);


ALTER TABLE public.provider_credentials OWNER TO postgres;

--
-- Name: provider_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_tokens (
    user_id text NOT NULL,
    provider text NOT NULL,
    encrypted_token text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.provider_tokens OWNER TO postgres;

--
-- Name: region_capacity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region_capacity (
    region_id text NOT NULL,
    current_runs bigint DEFAULT '0'::bigint,
    queued_runs bigint DEFAULT '0'::bigint,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.region_capacity OWNER TO postgres;

--
-- Name: regions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.regions (
    id text NOT NULL,
    name text,
    provider text,
    endpoint text,
    capacity bigint DEFAULT '100'::bigint,
    active boolean DEFAULT true,
    cost_factor real DEFAULT '1'::real,
    location_lat real,
    location_lon real,
    metadata json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.regions OWNER TO postgres;

--
-- Name: run_costs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.run_costs (
    id text NOT NULL,
    run_id text,
    instance_cost real DEFAULT '0'::real,
    storage_cost real DEFAULT '0'::real,
    transfer_cost real DEFAULT '0'::real,
    total_cost real DEFAULT '0'::real,
    provider text,
    region text,
    instance_type text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_seconds bigint,
    storage_gb real DEFAULT '0'::real,
    transfer_gb real DEFAULT '0'::real,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.run_costs OWNER TO postgres;

--
-- Name: runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.runs (
    id text NOT NULL,
    name text,
    description text,
    mode public.runmode,
    status public.runstatus,
    step_cursor text,
    total_steps bigint,
    completed_steps bigint DEFAULT '0'::bigint,
    config json,
    owner_id text,
    tenant_id text,
    runtime_id text,
    runtime_type text,
    schedule_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    error_details json,
    region_id text
);


ALTER TABLE public.runs OWNER TO postgres;

--
-- Name: runtime_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.runtime_devices (
    id text NOT NULL,
    user_id text,
    organization_id text,
    name text,
    runtime_type text,
    hostname text,
    platform text,
    version text,
    capabilities text DEFAULT '[]'::text,
    public_key text,
    public_key_fingerprint text,
    credential_hash text,
    credential_expires_at timestamp with time zone,
    previous_credential_hash text,
    previous_credential_expires_at timestamp with time zone,
    status text DEFAULT 'offline'::text,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamp with time zone
);


ALTER TABLE public.runtime_devices OWNER TO postgres;

--
-- Name: runtime_pairings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.runtime_pairings (
    id text NOT NULL,
    device_code_hash text,
    user_code text,
    challenge text,
    public_key text,
    public_key_fingerprint text,
    name text,
    runtime_type text,
    hostname text,
    platform text,
    version text,
    capabilities text DEFAULT '[]'::text,
    status text DEFAULT 'pending'::text,
    user_id text,
    organization_id text,
    runtime_id text,
    hosted_instance_id text,
    byo_bootstrap_token_id text,
    expires_at timestamp with time zone,
    approved_at timestamp with time zone,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.runtime_pairings OWNER TO postgres;

--
-- Name: runtime_relay_sockets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.runtime_relay_sockets (
    id text NOT NULL,
    runtime_id text,
    socket_path text,
    opened_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp with time zone,
    egress_bytes bigint DEFAULT '0'::bigint,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.runtime_relay_sockets OWNER TO postgres;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedules (
    id text NOT NULL,
    name text,
    description text,
    cron_expr text,
    natural_lang text,
    timezone text DEFAULT 'UTC'::text,
    job_template json,
    enabled boolean DEFAULT true,
    misfire_policy public.misfirepolicy DEFAULT 'fire_once'::public.misfirepolicy,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_count bigint DEFAULT '0'::bigint,
    misfire_count bigint DEFAULT '0'::bigint,
    owner_id text,
    tenant_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    region_id text
);


ALTER TABLE public.schedules OWNER TO postgres;

--
-- Name: sqlite_stat1; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sqlite_stat1 (
    tbl text,
    idx text,
    stat text
);


ALTER TABLE public.sqlite_stat1 OWNER TO postgres;

--
-- Name: sqlite_stat4; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sqlite_stat4 (
    tbl text,
    idx text,
    neq text,
    nlt text,
    ndlt text,
    sample text
);


ALTER TABLE public.sqlite_stat4 OWNER TO postgres;

--
-- Name: task_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_assignments (
    id text NOT NULL,
    task_id text,
    assignee_type text,
    assignee_id text,
    assignee_name text,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_assignments OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id text NOT NULL,
    task_id text,
    author text,
    author_avatar text,
    body text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_events (
    id bigint NOT NULL,
    task_id text,
    event_type text,
    payload json,
    source_client text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_events OWNER TO postgres;

--
-- Name: task_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_queue (
    id text NOT NULL,
    task_id text,
    agent_id text,
    agent_role text,
    status public.taskqueuestatus DEFAULT 'pending'::public.taskqueuestatus,
    claimed_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    result json,
    error text,
    retry_count bigint DEFAULT '0'::bigint,
    max_retries bigint DEFAULT '3'::bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_queue OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    workspace_id text,
    tenant_id text,
    owner_id text,
    title text,
    description text,
    status public.taskstatus DEFAULT 'backlog'::public.taskstatus,
    priority bigint DEFAULT '50'::bigint,
    estimated_minutes bigint,
    deadline timestamp with time zone,
    assignee_type public.assigneetype,
    assignee_id text,
    assignee_name text,
    assignee_avatar text,
    dependencies json,
    optimize_rank bigint,
    risk public.taskrisk,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: trigger_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trigger_history (
    id text NOT NULL,
    schedule_id text,
    run_id text,
    triggered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    success boolean DEFAULT false,
    error_message text,
    metadata text
);


ALTER TABLE public.trigger_history OWNER TO postgres;

--
-- Name: user_cost_budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_cost_budgets (
    user_id text NOT NULL,
    monthly_budget real DEFAULT '0'::real,
    current_month_cost real DEFAULT '0'::real,
    alert_threshold real DEFAULT '80'::real,
    last_alert_at timestamp with time zone,
    alert_enabled boolean DEFAULT true,
    currency text DEFAULT 'USD'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_cost_budgets OWNER TO postgres;

--
-- Name: user_credits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_credits (
    user_id text NOT NULL,
    balance_usd real DEFAULT '0'::real,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_credits OWNER TO postgres;

--
-- Name: user_pairing_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_pairing_usage (
    id text NOT NULL,
    user_id text,
    usage_date date,
    pairings_created bigint DEFAULT '0'::bigint,
    pairings_approved bigint DEFAULT '0'::bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_pairing_usage OWNER TO postgres;

--
-- Name: user_relay_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_relay_usage (
    id text NOT NULL,
    user_id text,
    usage_date date,
    sockets_opened bigint DEFAULT '0'::bigint,
    peak_concurrent_sockets bigint DEFAULT '0'::bigint,
    egress_bytes bigint DEFAULT '0'::bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_relay_usage OWNER TO postgres;

--
-- Name: user_runtime_quotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_runtime_quotas (
    user_id text NOT NULL,
    plan_tier_id text,
    max_active_devices bigint,
    max_pairings_per_day bigint,
    max_relay_sockets bigint,
    max_relay_mb_per_day bigint,
    max_hosted_runtime_hours_monthly bigint,
    can_create_hosted_runtime boolean,
    hard_spend_cap_usd real,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    max_hosted_runtimes bigint DEFAULT '0'::bigint,
    max_hosted_runtime_memory_mb bigint DEFAULT '0'::bigint
);


ALTER TABLE public.user_runtime_quotas OWNER TO postgres;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id text NOT NULL,
    user_id text,
    session_token_hash text,
    ip_address text,
    user_agent text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_active_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text,
    name text,
    avatar_url text,
    role public.userrole DEFAULT 'viewer'::public.userrole,
    status public.userstatus DEFAULT 'active'::public.userstatus,
    tenant_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wizard_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wizard_sessions (
    deployment_id text NOT NULL,
    user_id text,
    state text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.wizard_sessions OWNER TO postgres;

--
-- Name: _sqlx_migrations idx_21404_sqlite_autoindex__sqlx_migrations_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT idx_21404_sqlite_autoindex__sqlx_migrations_1 PRIMARY KEY (version);


--
-- Name: deployments idx_21410_sqlite_autoindex_deployments_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT idx_21410_sqlite_autoindex_deployments_1 PRIMARY KEY (id);


--
-- Name: instances idx_21418_sqlite_autoindex_instances_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instances
    ADD CONSTRAINT idx_21418_sqlite_autoindex_instances_1 PRIMARY KEY (id);


--
-- Name: provider_credentials idx_21425_sqlite_autoindex_provider_credentials_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT idx_21425_sqlite_autoindex_provider_credentials_1 PRIMARY KEY (id);


--
-- Name: audit_logs idx_21431_sqlite_autoindex_audit_logs_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT idx_21431_sqlite_autoindex_audit_logs_1 PRIMARY KEY (id);


--
-- Name: runs idx_21437_sqlite_autoindex_runs_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT idx_21437_sqlite_autoindex_runs_1 PRIMARY KEY (id);


--
-- Name: jobs idx_21445_sqlite_autoindex_jobs_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT idx_21445_sqlite_autoindex_jobs_1 PRIMARY KEY (id);


--
-- Name: schedules idx_21455_sqlite_autoindex_schedules_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT idx_21455_sqlite_autoindex_schedules_1 PRIMARY KEY (id);


--
-- Name: events idx_21467_sqlite_autoindex_events_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT idx_21467_sqlite_autoindex_events_1 PRIMARY KEY (id);


--
-- Name: attachments idx_21473_sqlite_autoindex_attachments_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT idx_21473_sqlite_autoindex_attachments_1 PRIMARY KEY (id);


--
-- Name: checkpoints idx_21481_sqlite_autoindex_checkpoints_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT idx_21481_sqlite_autoindex_checkpoints_1 PRIMARY KEY (id);


--
-- Name: approval_requests idx_21488_sqlite_autoindex_approval_requests_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT idx_21488_sqlite_autoindex_approval_requests_1 PRIMARY KEY (id);


--
-- Name: users idx_21496_sqlite_autoindex_users_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT idx_21496_sqlite_autoindex_users_1 PRIMARY KEY (id);


--
-- Name: api_tokens idx_21505_sqlite_autoindex_api_tokens_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT idx_21505_sqlite_autoindex_api_tokens_1 PRIMARY KEY (id);


--
-- Name: user_sessions idx_21514_sqlite_autoindex_user_sessions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT idx_21514_sqlite_autoindex_user_sessions_1 PRIMARY KEY (id);


--
-- Name: audit_log idx_21521_sqlite_autoindex_audit_log_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT idx_21521_sqlite_autoindex_audit_log_1 PRIMARY KEY (id);


--
-- Name: regions idx_21538_sqlite_autoindex_regions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT idx_21538_sqlite_autoindex_regions_1 PRIMARY KEY (id);


--
-- Name: region_capacity idx_21548_sqlite_autoindex_region_capacity_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_capacity
    ADD CONSTRAINT idx_21548_sqlite_autoindex_region_capacity_1 PRIMARY KEY (region_id);


--
-- Name: cost_rates idx_21556_sqlite_autoindex_cost_rates_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_rates
    ADD CONSTRAINT idx_21556_sqlite_autoindex_cost_rates_1 PRIMARY KEY (provider, region, instance_type);


--
-- Name: run_costs idx_21568_sqlite_autoindex_run_costs_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.run_costs
    ADD CONSTRAINT idx_21568_sqlite_autoindex_run_costs_1 PRIMARY KEY (id);


--
-- Name: user_cost_budgets idx_21581_sqlite_autoindex_user_cost_budgets_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_cost_budgets
    ADD CONSTRAINT idx_21581_sqlite_autoindex_user_cost_budgets_1 PRIMARY KEY (user_id);


--
-- Name: cost_alerts idx_21593_sqlite_autoindex_cost_alerts_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_alerts
    ADD CONSTRAINT idx_21593_sqlite_autoindex_cost_alerts_1 PRIMARY KEY (id);


--
-- Name: tasks idx_21599_sqlite_autoindex_tasks_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT idx_21599_sqlite_autoindex_tasks_1 PRIMARY KEY (id);


--
-- Name: task_comments idx_21608_sqlite_autoindex_task_comments_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT idx_21608_sqlite_autoindex_task_comments_1 PRIMARY KEY (id);


--
-- Name: task_assignments idx_21614_sqlite_autoindex_task_assignments_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT idx_21614_sqlite_autoindex_task_assignments_1 PRIMARY KEY (id);


--
-- Name: task_queue idx_21620_sqlite_autoindex_task_queue_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT idx_21620_sqlite_autoindex_task_queue_1 PRIMARY KEY (id);


--
-- Name: task_events idx_21629_task_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_events
    ADD CONSTRAINT idx_21629_task_events_pkey PRIMARY KEY (id);


--
-- Name: mirror_sessions idx_21635_sqlite_autoindex_mirror_sessions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mirror_sessions
    ADD CONSTRAINT idx_21635_sqlite_autoindex_mirror_sessions_1 PRIMARY KEY (id);


--
-- Name: trigger_history idx_21643_sqlite_autoindex_trigger_history_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trigger_history
    ADD CONSTRAINT idx_21643_sqlite_autoindex_trigger_history_1 PRIMARY KEY (id);


--
-- Name: plan_tiers idx_21650_sqlite_autoindex_plan_tiers_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_tiers
    ADD CONSTRAINT idx_21650_sqlite_autoindex_plan_tiers_1 PRIMARY KEY (id);


--
-- Name: user_runtime_quotas idx_21665_sqlite_autoindex_user_runtime_quotas_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_runtime_quotas
    ADD CONSTRAINT idx_21665_sqlite_autoindex_user_runtime_quotas_1 PRIMARY KEY (user_id);


--
-- Name: user_pairing_usage idx_21674_sqlite_autoindex_user_pairing_usage_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_pairing_usage
    ADD CONSTRAINT idx_21674_sqlite_autoindex_user_pairing_usage_1 PRIMARY KEY (id);


--
-- Name: user_relay_usage idx_21683_sqlite_autoindex_user_relay_usage_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_relay_usage
    ADD CONSTRAINT idx_21683_sqlite_autoindex_user_relay_usage_1 PRIMARY KEY (id);


--
-- Name: runtime_relay_sockets idx_21693_sqlite_autoindex_runtime_relay_sockets_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_relay_sockets
    ADD CONSTRAINT idx_21693_sqlite_autoindex_runtime_relay_sockets_1 PRIMARY KEY (id);


--
-- Name: hosted_runtime_instances idx_21701_sqlite_autoindex_hosted_runtime_instances_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_instances
    ADD CONSTRAINT idx_21701_sqlite_autoindex_hosted_runtime_instances_1 PRIMARY KEY (id);


--
-- Name: hosted_runtime_usage_sessions idx_21713_sqlite_autoindex_hosted_runtime_usage_sessions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_usage_sessions
    ADD CONSTRAINT idx_21713_sqlite_autoindex_hosted_runtime_usage_sessions_1 PRIMARY KEY (id);


--
-- Name: billing_entitlement_events idx_21722_sqlite_autoindex_billing_entitlement_events_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_entitlement_events
    ADD CONSTRAINT idx_21722_sqlite_autoindex_billing_entitlement_events_1 PRIMARY KEY (id);


--
-- Name: dispatch_handoff_tokens idx_21729_sqlite_autoindex_dispatch_handoff_tokens_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_handoff_tokens
    ADD CONSTRAINT idx_21729_sqlite_autoindex_dispatch_handoff_tokens_1 PRIMARY KEY (token);


--
-- Name: gizzi_instances idx_21735_sqlite_autoindex_gizzi_instances_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gizzi_instances
    ADD CONSTRAINT idx_21735_sqlite_autoindex_gizzi_instances_1 PRIMARY KEY (id);


--
-- Name: wizard_sessions idx_21742_sqlite_autoindex_wizard_sessions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_sessions
    ADD CONSTRAINT idx_21742_sqlite_autoindex_wizard_sessions_1 PRIMARY KEY (deployment_id);


--
-- Name: provider_tokens idx_21749_sqlite_autoindex_provider_tokens_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_tokens
    ADD CONSTRAINT idx_21749_sqlite_autoindex_provider_tokens_1 PRIMARY KEY (user_id, provider);


--
-- Name: cloud_instances idx_21756_sqlite_autoindex_cloud_instances_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cloud_instances
    ADD CONSTRAINT idx_21756_sqlite_autoindex_cloud_instances_1 PRIMARY KEY (id);


--
-- Name: byo_bootstrap_tokens idx_21763_sqlite_autoindex_byo_bootstrap_tokens_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.byo_bootstrap_tokens
    ADD CONSTRAINT idx_21763_sqlite_autoindex_byo_bootstrap_tokens_1 PRIMARY KEY (id);


--
-- Name: runtime_pairings idx_21769_sqlite_autoindex_runtime_pairings_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_pairings
    ADD CONSTRAINT idx_21769_sqlite_autoindex_runtime_pairings_1 PRIMARY KEY (id);


--
-- Name: runtime_devices idx_21777_sqlite_autoindex_runtime_devices_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_devices
    ADD CONSTRAINT idx_21777_sqlite_autoindex_runtime_devices_1 PRIMARY KEY (id);


--
-- Name: user_credits idx_21786_sqlite_autoindex_user_credits_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT idx_21786_sqlite_autoindex_user_credits_1 PRIMARY KEY (user_id);


--
-- Name: credit_transactions idx_21794_sqlite_autoindex_credit_transactions_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT idx_21794_sqlite_autoindex_credit_transactions_1 PRIMARY KEY (id);


--
-- Name: idx_21410_idx_deployments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21410_idx_deployments_created_at ON public.deployments USING btree (created_at);


--
-- Name: idx_21410_idx_deployments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21410_idx_deployments_status ON public.deployments USING btree (status);


--
-- Name: idx_21418_idx_instances_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21418_idx_instances_status ON public.instances USING btree (status);


--
-- Name: idx_21431_idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21431_idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_21437_idx_runs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_created_at ON public.runs USING btree (created_at);


--
-- Name: idx_21437_idx_runs_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_mode ON public.runs USING btree (mode);


--
-- Name: idx_21437_idx_runs_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_owner ON public.runs USING btree (owner_id);


--
-- Name: idx_21437_idx_runs_region; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_region ON public.runs USING btree (region_id);


--
-- Name: idx_21437_idx_runs_schedule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_schedule ON public.runs USING btree (schedule_id);


--
-- Name: idx_21437_idx_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_status ON public.runs USING btree (status);


--
-- Name: idx_21437_idx_runs_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_status_updated ON public.runs USING btree (status, updated_at);


--
-- Name: idx_21437_idx_runs_tenant_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21437_idx_runs_tenant_status ON public.runs USING btree (tenant_id, status, created_at);


--
-- Name: idx_21445_idx_jobs_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_priority ON public.jobs USING btree (priority, created_at);


--
-- Name: idx_21445_idx_jobs_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_queue ON public.jobs USING btree (status, priority, created_at);


--
-- Name: idx_21445_idx_jobs_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_run_id ON public.jobs USING btree (run_id);


--
-- Name: idx_21445_idx_jobs_run_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_run_status ON public.jobs USING btree (run_id, status);


--
-- Name: idx_21445_idx_jobs_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_scheduled ON public.jobs USING btree (scheduled_at);


--
-- Name: idx_21445_idx_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21445_idx_jobs_status ON public.jobs USING btree (status);


--
-- Name: idx_21455_idx_schedules_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21455_idx_schedules_enabled ON public.schedules USING btree (enabled);


--
-- Name: idx_21455_idx_schedules_next_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21455_idx_schedules_next_run ON public.schedules USING btree (next_run_at);


--
-- Name: idx_21455_idx_schedules_region; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21455_idx_schedules_region ON public.schedules USING btree (region_id);


--
-- Name: idx_21467_idx_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_created_at ON public.events USING btree (created_at);


--
-- Name: idx_21467_idx_events_run_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_run_created ON public.events USING btree (run_id, created_at);


--
-- Name: idx_21467_idx_events_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_run_id ON public.events USING btree (run_id);


--
-- Name: idx_21467_idx_events_run_sequence; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_run_sequence ON public.events USING btree (run_id, sequence);


--
-- Name: idx_21467_idx_events_run_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_run_type ON public.events USING btree (run_id, event_type);


--
-- Name: idx_21467_idx_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21467_idx_events_type ON public.events USING btree (event_type);


--
-- Name: idx_21473_idx_attachments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21473_idx_attachments_active ON public.attachments USING btree (run_id, detached_at);


--
-- Name: idx_21473_idx_attachments_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21473_idx_attachments_client ON public.attachments USING btree (client_id);


--
-- Name: idx_21473_idx_attachments_last_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21473_idx_attachments_last_seen ON public.attachments USING btree (last_seen_at);


--
-- Name: idx_21473_idx_attachments_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21473_idx_attachments_run ON public.attachments USING btree (run_id);


--
-- Name: idx_21473_sqlite_autoindex_attachments_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21473_sqlite_autoindex_attachments_2 ON public.attachments USING btree (run_id, client_id);


--
-- Name: idx_21481_idx_checkpoints_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21481_idx_checkpoints_created ON public.checkpoints USING btree (run_id, created_at);


--
-- Name: idx_21481_idx_checkpoints_cursor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21481_idx_checkpoints_cursor ON public.checkpoints USING btree (run_id, step_cursor);


--
-- Name: idx_21481_idx_checkpoints_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21481_idx_checkpoints_run ON public.checkpoints USING btree (run_id);


--
-- Name: idx_21488_idx_approvals_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21488_idx_approvals_created ON public.approval_requests USING btree (created_at);


--
-- Name: idx_21488_idx_approvals_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21488_idx_approvals_pending ON public.approval_requests USING btree (run_id, status);


--
-- Name: idx_21488_idx_approvals_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21488_idx_approvals_run ON public.approval_requests USING btree (run_id);


--
-- Name: idx_21488_idx_approvals_run_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21488_idx_approvals_run_pending ON public.approval_requests USING btree (run_id, created_at);


--
-- Name: idx_21488_idx_approvals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21488_idx_approvals_status ON public.approval_requests USING btree (status);


--
-- Name: idx_21496_idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21496_idx_users_email ON public.users USING btree (email);


--
-- Name: idx_21496_idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21496_idx_users_status ON public.users USING btree (status);


--
-- Name: idx_21496_idx_users_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21496_idx_users_tenant ON public.users USING btree (tenant_id);


--
-- Name: idx_21496_sqlite_autoindex_users_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21496_sqlite_autoindex_users_2 ON public.users USING btree (email);


--
-- Name: idx_21505_idx_api_tokens_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21505_idx_api_tokens_hash ON public.api_tokens USING btree (token_hash);


--
-- Name: idx_21505_idx_api_tokens_revoked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21505_idx_api_tokens_revoked ON public.api_tokens USING btree (is_revoked);


--
-- Name: idx_21505_idx_api_tokens_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21505_idx_api_tokens_user ON public.api_tokens USING btree (user_id);


--
-- Name: idx_21505_idx_api_tokens_valid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21505_idx_api_tokens_valid ON public.api_tokens USING btree (token_hash, is_revoked, expires_at);


--
-- Name: idx_21505_sqlite_autoindex_api_tokens_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21505_sqlite_autoindex_api_tokens_2 ON public.api_tokens USING btree (token_hash);


--
-- Name: idx_21514_idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21514_idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_21514_idx_user_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21514_idx_user_sessions_token ON public.user_sessions USING btree (session_token_hash);


--
-- Name: idx_21514_idx_user_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21514_idx_user_sessions_user ON public.user_sessions USING btree (user_id);


--
-- Name: idx_21514_sqlite_autoindex_user_sessions_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21514_sqlite_autoindex_user_sessions_2 ON public.user_sessions USING btree (session_token_hash);


--
-- Name: idx_21521_idx_audit_log_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_21521_idx_audit_log_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_log_resource ON public.audit_log USING btree (resource_type, resource_id);


--
-- Name: idx_21521_idx_audit_log_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_log_timestamp ON public.audit_log USING btree ("timestamp");


--
-- Name: idx_21521_idx_audit_log_timestamp_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_log_timestamp_range ON public.audit_log USING btree ("timestamp");


--
-- Name: idx_21521_idx_audit_log_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_21521_idx_audit_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21521_idx_audit_user_time ON public.audit_log USING btree (user_id, "timestamp");


--
-- Name: idx_21538_idx_regions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21538_idx_regions_active ON public.regions USING btree (active);


--
-- Name: idx_21538_idx_regions_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21538_idx_regions_provider ON public.regions USING btree (provider);


--
-- Name: idx_21568_idx_run_costs_ended_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21568_idx_run_costs_ended_at ON public.run_costs USING btree (ended_at);


--
-- Name: idx_21568_idx_run_costs_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21568_idx_run_costs_provider ON public.run_costs USING btree (provider);


--
-- Name: idx_21568_idx_run_costs_region; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21568_idx_run_costs_region ON public.run_costs USING btree (region);


--
-- Name: idx_21568_idx_run_costs_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21568_idx_run_costs_run_id ON public.run_costs USING btree (run_id);


--
-- Name: idx_21568_idx_run_costs_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21568_idx_run_costs_started_at ON public.run_costs USING btree (started_at);


--
-- Name: idx_21593_idx_cost_alerts_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21593_idx_cost_alerts_sent_at ON public.cost_alerts USING btree (sent_at);


--
-- Name: idx_21593_idx_cost_alerts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21593_idx_cost_alerts_user_id ON public.cost_alerts USING btree (user_id);


--
-- Name: idx_21599_idx_tasks_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21599_idx_tasks_assignee ON public.tasks USING btree (assignee_type, assignee_id);


--
-- Name: idx_21599_idx_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21599_idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_21599_idx_tasks_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21599_idx_tasks_tenant ON public.tasks USING btree (tenant_id);


--
-- Name: idx_21599_idx_tasks_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21599_idx_tasks_workspace ON public.tasks USING btree (workspace_id);


--
-- Name: idx_21608_idx_comments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21608_idx_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_21614_idx_assignments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21614_idx_assignments_task ON public.task_assignments USING btree (task_id);


--
-- Name: idx_21620_idx_queue_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21620_idx_queue_agent ON public.task_queue USING btree (agent_id);


--
-- Name: idx_21620_idx_queue_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21620_idx_queue_status ON public.task_queue USING btree (status);


--
-- Name: idx_21620_idx_queue_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21620_idx_queue_task ON public.task_queue USING btree (task_id);


--
-- Name: idx_21629_idx_task_events_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21629_idx_task_events_task ON public.task_events USING btree (task_id);


--
-- Name: idx_21629_idx_task_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21629_idx_task_events_type ON public.task_events USING btree (event_type);


--
-- Name: idx_21635_idx_mirror_sessions_active_by_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_active_by_user ON public.mirror_sessions USING btree (user_id, status);


--
-- Name: idx_21635_idx_mirror_sessions_cleanup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_cleanup ON public.mirror_sessions USING btree (status, expires_at);


--
-- Name: idx_21635_idx_mirror_sessions_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_expires_at ON public.mirror_sessions USING btree (expires_at);


--
-- Name: idx_21635_idx_mirror_sessions_pairing_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_pairing_code ON public.mirror_sessions USING btree (pairing_code);


--
-- Name: idx_21635_idx_mirror_sessions_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_run_id ON public.mirror_sessions USING btree (run_id);


--
-- Name: idx_21635_idx_mirror_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_status ON public.mirror_sessions USING btree (status);


--
-- Name: idx_21635_idx_mirror_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_token ON public.mirror_sessions USING btree (access_token);


--
-- Name: idx_21635_idx_mirror_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21635_idx_mirror_sessions_user_id ON public.mirror_sessions USING btree (user_id);


--
-- Name: idx_21635_sqlite_autoindex_mirror_sessions_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21635_sqlite_autoindex_mirror_sessions_2 ON public.mirror_sessions USING btree (access_token);


--
-- Name: idx_21635_sqlite_autoindex_mirror_sessions_3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21635_sqlite_autoindex_mirror_sessions_3 ON public.mirror_sessions USING btree (pairing_code);


--
-- Name: idx_21643_idx_trigger_history_schedule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21643_idx_trigger_history_schedule_id ON public.trigger_history USING btree (schedule_id);


--
-- Name: idx_21643_idx_trigger_history_triggered_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21643_idx_trigger_history_triggered_at ON public.trigger_history USING btree (triggered_at);


--
-- Name: idx_21665_idx_user_runtime_quotas_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21665_idx_user_runtime_quotas_tier ON public.user_runtime_quotas USING btree (plan_tier_id);


--
-- Name: idx_21674_idx_user_pairing_usage_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21674_idx_user_pairing_usage_user_date ON public.user_pairing_usage USING btree (user_id, usage_date);


--
-- Name: idx_21674_sqlite_autoindex_user_pairing_usage_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21674_sqlite_autoindex_user_pairing_usage_2 ON public.user_pairing_usage USING btree (user_id, usage_date);


--
-- Name: idx_21683_idx_user_relay_usage_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21683_idx_user_relay_usage_user_date ON public.user_relay_usage USING btree (user_id, usage_date);


--
-- Name: idx_21683_sqlite_autoindex_user_relay_usage_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21683_sqlite_autoindex_user_relay_usage_2 ON public.user_relay_usage USING btree (user_id, usage_date);


--
-- Name: idx_21693_idx_runtime_relay_sockets_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21693_idx_runtime_relay_sockets_open ON public.runtime_relay_sockets USING btree (runtime_id, closed_at);


--
-- Name: idx_21693_idx_runtime_relay_sockets_runtime; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21693_idx_runtime_relay_sockets_runtime ON public.runtime_relay_sockets USING btree (runtime_id);


--
-- Name: idx_21701_idx_hosted_instances_device; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21701_idx_hosted_instances_device ON public.hosted_runtime_instances USING btree (runtime_device_id);


--
-- Name: idx_21701_idx_hosted_instances_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21701_idx_hosted_instances_status ON public.hosted_runtime_instances USING btree (status);


--
-- Name: idx_21701_idx_hosted_instances_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21701_idx_hosted_instances_user ON public.hosted_runtime_instances USING btree (user_id);


--
-- Name: idx_21701_sqlite_autoindex_hosted_runtime_instances_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21701_sqlite_autoindex_hosted_runtime_instances_2 ON public.hosted_runtime_instances USING btree (bootstrap_token_hash);


--
-- Name: idx_21713_idx_hosted_usage_instance_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21713_idx_hosted_usage_instance_started ON public.hosted_runtime_usage_sessions USING btree (hosted_instance_id, started_at);


--
-- Name: idx_21713_idx_hosted_usage_one_open_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21713_idx_hosted_usage_one_open_session ON public.hosted_runtime_usage_sessions USING btree (hosted_instance_id);


--
-- Name: idx_21713_idx_hosted_usage_user_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21713_idx_hosted_usage_user_started ON public.hosted_runtime_usage_sessions USING btree (user_id, started_at);


--
-- Name: idx_21722_idx_billing_entitlement_events_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21722_idx_billing_entitlement_events_user ON public.billing_entitlement_events USING btree (user_id, created_at);


--
-- Name: idx_21729_idx_dispatch_handoff_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21729_idx_dispatch_handoff_expiry ON public.dispatch_handoff_tokens USING btree (expires_at);


--
-- Name: idx_21729_idx_dispatch_handoff_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21729_idx_dispatch_handoff_user ON public.dispatch_handoff_tokens USING btree (user_id);


--
-- Name: idx_21735_idx_gizzi_instances_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21735_idx_gizzi_instances_user ON public.gizzi_instances USING btree (user_id);


--
-- Name: idx_21735_sqlite_autoindex_gizzi_instances_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21735_sqlite_autoindex_gizzi_instances_2 ON public.gizzi_instances USING btree (user_id, name);


--
-- Name: idx_21742_idx_wizard_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21742_idx_wizard_sessions_user ON public.wizard_sessions USING btree (user_id);


--
-- Name: idx_21756_idx_cloud_instances_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21756_idx_cloud_instances_provider ON public.cloud_instances USING btree (provider);


--
-- Name: idx_21756_idx_cloud_instances_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21756_idx_cloud_instances_status ON public.cloud_instances USING btree (status);


--
-- Name: idx_21763_idx_byo_bootstrap_tokens_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21763_idx_byo_bootstrap_tokens_user ON public.byo_bootstrap_tokens USING btree (user_id);


--
-- Name: idx_21763_sqlite_autoindex_byo_bootstrap_tokens_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21763_sqlite_autoindex_byo_bootstrap_tokens_2 ON public.byo_bootstrap_tokens USING btree (token_hash);


--
-- Name: idx_21769_idx_runtime_pairings_byo_bootstrap; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21769_idx_runtime_pairings_byo_bootstrap ON public.runtime_pairings USING btree (byo_bootstrap_token_id);


--
-- Name: idx_21769_idx_runtime_pairings_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21769_idx_runtime_pairings_code ON public.runtime_pairings USING btree (user_code);


--
-- Name: idx_21769_idx_runtime_pairings_hosted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21769_idx_runtime_pairings_hosted ON public.runtime_pairings USING btree (hosted_instance_id);


--
-- Name: idx_21769_idx_runtime_pairings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21769_idx_runtime_pairings_status ON public.runtime_pairings USING btree (status, expires_at);


--
-- Name: idx_21769_idx_runtime_pairings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21769_idx_runtime_pairings_user ON public.runtime_pairings USING btree (user_id);


--
-- Name: idx_21769_sqlite_autoindex_runtime_pairings_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21769_sqlite_autoindex_runtime_pairings_2 ON public.runtime_pairings USING btree (device_code_hash);


--
-- Name: idx_21769_sqlite_autoindex_runtime_pairings_3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21769_sqlite_autoindex_runtime_pairings_3 ON public.runtime_pairings USING btree (user_code);


--
-- Name: idx_21777_idx_runtime_devices_credential; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21777_idx_runtime_devices_credential ON public.runtime_devices USING btree (credential_hash);


--
-- Name: idx_21777_idx_runtime_devices_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21777_idx_runtime_devices_org ON public.runtime_devices USING btree (organization_id);


--
-- Name: idx_21777_idx_runtime_devices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21777_idx_runtime_devices_status ON public.runtime_devices USING btree (status);


--
-- Name: idx_21777_idx_runtime_devices_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21777_idx_runtime_devices_user ON public.runtime_devices USING btree (user_id);


--
-- Name: idx_21777_sqlite_autoindex_runtime_devices_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21777_sqlite_autoindex_runtime_devices_2 ON public.runtime_devices USING btree (credential_hash);


--
-- Name: idx_21794_idx_credit_transactions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_21794_idx_credit_transactions_user ON public.credit_transactions USING btree (user_id, created_at);


--
-- Name: idx_21794_sqlite_autoindex_credit_transactions_2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_21794_sqlite_autoindex_credit_transactions_2 ON public.credit_transactions USING btree (transaction_id);


--
-- Name: api_tokens api_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.api_tokens(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: billing_entitlement_events billing_entitlement_events_plan_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_entitlement_events
    ADD CONSTRAINT billing_entitlement_events_plan_tier_id_fkey FOREIGN KEY (plan_tier_id) REFERENCES public.plan_tiers(id);


--
-- Name: billing_entitlement_events billing_entitlement_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_entitlement_events
    ADD CONSTRAINT billing_entitlement_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: byo_bootstrap_tokens byo_bootstrap_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.byo_bootstrap_tokens
    ADD CONSTRAINT byo_bootstrap_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: checkpoints checkpoints_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: cloud_instances cloud_instances_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cloud_instances
    ADD CONSTRAINT cloud_instances_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE SET NULL;


--
-- Name: cost_alerts cost_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_alerts
    ADD CONSTRAINT cost_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_cost_budgets(user_id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispatch_handoff_tokens dispatch_handoff_tokens_runtime_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_handoff_tokens
    ADD CONSTRAINT dispatch_handoff_tokens_runtime_id_fkey FOREIGN KEY (runtime_id) REFERENCES public.runtime_devices(id) ON DELETE CASCADE;


--
-- Name: dispatch_handoff_tokens dispatch_handoff_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_handoff_tokens
    ADD CONSTRAINT dispatch_handoff_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: gizzi_instances gizzi_instances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gizzi_instances
    ADD CONSTRAINT gizzi_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hosted_runtime_instances hosted_runtime_instances_runtime_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_instances
    ADD CONSTRAINT hosted_runtime_instances_runtime_device_id_fkey FOREIGN KEY (runtime_device_id) REFERENCES public.runtime_devices(id) ON DELETE SET NULL;


--
-- Name: hosted_runtime_instances hosted_runtime_instances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_instances
    ADD CONSTRAINT hosted_runtime_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hosted_runtime_usage_sessions hosted_runtime_usage_sessions_hosted_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_usage_sessions
    ADD CONSTRAINT hosted_runtime_usage_sessions_hosted_instance_id_fkey FOREIGN KEY (hosted_instance_id) REFERENCES public.hosted_runtime_instances(id) ON DELETE CASCADE;


--
-- Name: hosted_runtime_usage_sessions hosted_runtime_usage_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosted_runtime_usage_sessions
    ADD CONSTRAINT hosted_runtime_usage_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: instances instances_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instances
    ADD CONSTRAINT instances_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.deployments(id);


--
-- Name: jobs jobs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: mirror_sessions mirror_sessions_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mirror_sessions
    ADD CONSTRAINT mirror_sessions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: provider_tokens provider_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_tokens
    ADD CONSTRAINT provider_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: region_capacity region_capacity_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_capacity
    ADD CONSTRAINT region_capacity_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: run_costs run_costs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.run_costs
    ADD CONSTRAINT run_costs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: runs runs_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: runtime_devices runtime_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_devices
    ADD CONSTRAINT runtime_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: runtime_pairings runtime_pairings_byo_bootstrap_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_pairings
    ADD CONSTRAINT runtime_pairings_byo_bootstrap_token_id_fkey FOREIGN KEY (byo_bootstrap_token_id) REFERENCES public.byo_bootstrap_tokens(id) ON DELETE SET NULL;


--
-- Name: runtime_pairings runtime_pairings_hosted_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_pairings
    ADD CONSTRAINT runtime_pairings_hosted_instance_id_fkey FOREIGN KEY (hosted_instance_id) REFERENCES public.hosted_runtime_instances(id) ON DELETE SET NULL;


--
-- Name: runtime_pairings runtime_pairings_runtime_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_pairings
    ADD CONSTRAINT runtime_pairings_runtime_id_fkey FOREIGN KEY (runtime_id) REFERENCES public.runtime_devices(id) ON DELETE SET NULL;


--
-- Name: runtime_pairings runtime_pairings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_pairings
    ADD CONSTRAINT runtime_pairings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: runtime_relay_sockets runtime_relay_sockets_runtime_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runtime_relay_sockets
    ADD CONSTRAINT runtime_relay_sockets_runtime_id_fkey FOREIGN KEY (runtime_id) REFERENCES public.runtime_devices(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: task_assignments task_assignments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_queue task_queue_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: trigger_history trigger_history_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trigger_history
    ADD CONSTRAINT trigger_history_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: user_credits user_credits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pairing_usage user_pairing_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_pairing_usage
    ADD CONSTRAINT user_pairing_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_relay_usage user_relay_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_relay_usage
    ADD CONSTRAINT user_relay_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_runtime_quotas user_runtime_quotas_plan_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_runtime_quotas
    ADD CONSTRAINT user_runtime_quotas_plan_tier_id_fkey FOREIGN KEY (plan_tier_id) REFERENCES public.plan_tiers(id);


--
-- Name: user_runtime_quotas user_runtime_quotas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_runtime_quotas
    ADD CONSTRAINT user_runtime_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wizard_sessions wizard_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_sessions
    ADD CONSTRAINT wizard_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO allternit;


--
-- Name: TABLE _sqlx_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._sqlx_migrations TO allternit;


--
-- Name: TABLE api_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_tokens TO allternit;


--
-- Name: TABLE approval_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approval_requests TO allternit;


--
-- Name: TABLE attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attachments TO allternit;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_log TO allternit;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO allternit;


--
-- Name: TABLE billing_entitlement_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.billing_entitlement_events TO allternit;


--
-- Name: TABLE byo_bootstrap_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.byo_bootstrap_tokens TO allternit;


--
-- Name: TABLE checkpoints; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.checkpoints TO allternit;


--
-- Name: TABLE cloud_instances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cloud_instances TO allternit;


--
-- Name: TABLE cost_alerts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cost_alerts TO allternit;


--
-- Name: TABLE cost_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cost_rates TO allternit;


--
-- Name: TABLE credit_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.credit_transactions TO allternit;


--
-- Name: TABLE deployments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.deployments TO allternit;


--
-- Name: TABLE dispatch_handoff_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dispatch_handoff_tokens TO allternit;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.events TO allternit;


--
-- Name: TABLE gizzi_instances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gizzi_instances TO allternit;


--
-- Name: TABLE hosted_runtime_instances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hosted_runtime_instances TO allternit;


--
-- Name: TABLE hosted_runtime_usage_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hosted_runtime_usage_sessions TO allternit;


--
-- Name: TABLE instances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.instances TO allternit;


--
-- Name: TABLE jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.jobs TO allternit;


--
-- Name: TABLE mirror_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mirror_sessions TO allternit;


--
-- Name: TABLE plan_tiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plan_tiers TO allternit;


--
-- Name: TABLE provider_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.provider_credentials TO allternit;


--
-- Name: TABLE provider_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.provider_tokens TO allternit;


--
-- Name: TABLE region_capacity; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.region_capacity TO allternit;


--
-- Name: TABLE regions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.regions TO allternit;


--
-- Name: TABLE run_costs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.run_costs TO allternit;


--
-- Name: TABLE runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.runs TO allternit;


--
-- Name: TABLE runtime_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.runtime_devices TO allternit;


--
-- Name: TABLE runtime_pairings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.runtime_pairings TO allternit;


--
-- Name: TABLE runtime_relay_sockets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.runtime_relay_sockets TO allternit;


--
-- Name: TABLE schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.schedules TO allternit;


--
-- Name: TABLE sqlite_stat1; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sqlite_stat1 TO allternit;


--
-- Name: TABLE sqlite_stat4; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sqlite_stat4 TO allternit;


--
-- Name: TABLE task_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_assignments TO allternit;


--
-- Name: TABLE task_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_comments TO allternit;


--
-- Name: TABLE task_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_events TO allternit;


--
-- Name: TABLE task_queue; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_queue TO allternit;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tasks TO allternit;


--
-- Name: TABLE trigger_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trigger_history TO allternit;


--
-- Name: TABLE user_cost_budgets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_cost_budgets TO allternit;


--
-- Name: TABLE user_credits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_credits TO allternit;


--
-- Name: TABLE user_pairing_usage; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_pairing_usage TO allternit;


--
-- Name: TABLE user_relay_usage; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_relay_usage TO allternit;


--
-- Name: TABLE user_runtime_quotas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_runtime_quotas TO allternit;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_sessions TO allternit;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO allternit;


--
-- Name: TABLE wizard_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wizard_sessions TO allternit;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO allternit;


--
-- PostgreSQL database dump complete
--

\unrestrict BQ4USXIuAXydMh6B8Vbvw0Q40PaIz9ibZtTgYCTgWPaQYVEUbBZHx7DiU2S5AeF

