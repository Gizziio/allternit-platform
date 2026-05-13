-- Seed default data

-- Default providers
INSERT INTO providers (id, name, provider_type, base_url, api_key_env_var, models)
VALUES
    ('openai', 'OpenAI', 'cloud', 'https://api.openai.com', 'OPENAI_API_KEY', '["gpt-4o","gpt-4o-mini","o1-preview"]'),
    ('anthropic', 'Anthropic', 'cloud', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY', '["claude-sonnet-4-5","claude-opus-4","claude-haiku-3-5"]'),
    ('ollama', 'Ollama (Local)', 'local', 'http://localhost:11434', NULL, '[]'),
    ('custom', 'Custom', 'custom', NULL, NULL, '[]')
ON CONFLICT(id) DO NOTHING;

-- Default A://Labs courses
INSERT INTO alabs_courses (id, code, title, description, tier, modules, capstone, canvas_url, published, sort_order)
VALUES
    ('course-copilot', 'ALABS-CORE-COPILOT', 'A://Labs — Core Copilot', 'Master the fundamentals of AI-assisted development and Allternit platform operations.', 'CORE', 4, 'Build a working copilot extension that integrates with the Allternit API.', 'https://canvas.instructure.com/courses/14593493', 1, 4),
    ('course-ops', 'ALABS-OPS-RAG', 'A://Labs — OPS RAG', 'Production-grade RAG systems, vector search, and memory architecture for operations teams.', 'OPS', 5, 'Deploy a RAG pipeline with >90% retrieval accuracy on your own dataset.', 'https://canvas.instructure.com/courses/14593494', 1, 5),
    ('course-agents', 'ALABS-AGENTS-AGENTS', 'A://Labs — Agents × Agents', 'Multi-agent orchestration, swarm design, and autonomous agent systems.', 'AGENTS', 6, 'Build a 3-agent swarm that collaboratively completes a complex research task.', 'https://canvas.instructure.com/courses/14593495', 1, 6),
    ('course-adv', 'ALABS-ADV-MCP', 'A://Labs — ADV MCP', 'Advanced model context protocols, custom tool ecosystems, and deep integration patterns.', 'ADV', 4, 'Design and publish an MCP server with 5+ custom tools used by 10+ users.', 'https://canvas.instructure.com/courses/14593496', 1, 4)
ON CONFLICT(id) DO NOTHING;
