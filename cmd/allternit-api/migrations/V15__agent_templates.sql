-- V15: server-persisted agent pattern templates (solo, orchestrator, company, ...).
-- `spec` is JSON: { pattern, agent: {...}, subagents: [...] }. model/provider are
-- filled at instantiation time from the user's chosen brain so templates stay
-- brain-agnostic.
CREATE TABLE IF NOT EXISTS agent_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    spec        TEXT NOT NULL,
    is_builtin  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO agent_templates (id, name, description, category, spec, is_builtin) VALUES
(
  'solo-general',
  'General Agent',
  'A single agent for ad-hoc tasks in any surface.',
  'general',
  '{"pattern":"solo","agent":{"name":"General Agent","type":"worker","mode":"primary","description":"General-purpose agent for ad-hoc tasks.","harness_config":{"mode":"local"},"enabled_modes":["chat","cowork","code","browser","design"],"trust_tier":"standard"},"subagents":[]}',
  1
),
(
  'orchestrator-workers',
  'Orchestrator + Workers',
  'A primary orchestrator that delegates to a Researcher and a Builder subagent.',
  'orchestration',
  '{"pattern":"orchestrator","agent":{"name":"Orchestrator","type":"orchestrator","mode":"orchestrator","description":"Routes work to specialist subagents and synthesizes results.","harness_config":{"mode":"local"},"enabled_modes":["chat","cowork","code","browser","design"],"trust_tier":"standard"},"subagents":[{"name":"Researcher","type":"researcher","mode":"subagent","description":"Read-only research and codebase exploration.","harness_config":{"mode":"local"},"enabled_modes":["chat","code"],"trust_tier":"standard"},{"name":"Builder","type":"coder","mode":"subagent","description":"Implements changes and runs builds/tests.","harness_config":{"mode":"local"},"enabled_modes":["chat","code"],"trust_tier":"standard"}]}',
  1
),
(
  'company-builder',
  'Company Builder',
  'A founder crew: a Companion orchestrating Strategy, Engineering, Growth and Operations subagents.',
  'business',
  '{"pattern":"company","agent":{"name":"Founder Companion","type":"orchestrator","mode":"orchestrator","description":"Always-on founder agent that coordinates the company-building crew.","harness_config":{"mode":"local"},"enabled_modes":["chat","cowork","code","browser","design"],"trust_tier":"standard"},"subagents":[{"name":"Strategy (CEO)","type":"strategist","mode":"subagent","description":"Vision, market, prioritization, roadmap.","harness_config":{"mode":"local"},"enabled_modes":["chat","cowork"],"trust_tier":"standard"},{"name":"Engineering (CTO)","type":"engineer","mode":"subagent","description":"Architecture, implementation, technical decisions.","harness_config":{"mode":"local"},"enabled_modes":["chat","code"],"trust_tier":"standard"},{"name":"Growth (CMO)","type":"marketer","mode":"subagent","description":"Positioning, content, acquisition, launches.","harness_config":{"mode":"local"},"enabled_modes":["chat","browser"],"trust_tier":"standard"},{"name":"Operations (COO)","type":"operator","mode":"subagent","description":"Finance, legal, process, hiring, metrics.","harness_config":{"mode":"local"},"enabled_modes":["chat","cowork"],"trust_tier":"standard"}]}',
  1
);
