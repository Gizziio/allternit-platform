import { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Terminal,
  Globe,
  WebhooksLogo,
  Shield,
  Play,
} from '@phosphor-icons/react';

const endpoints = [
  {
    category: 'Skills',
    items: [
      { method: 'GET', path: '/v1/skills', description: 'List all skills' },
      { method: 'POST', path: '/v1/skills', description: 'Create a new skill' },
      { method: 'GET', path: '/v1/skills/:id', description: 'Get skill details' },
      { method: 'PUT', path: '/v1/skills/:id', description: 'Update a skill' },
      { method: 'DELETE', path: '/v1/skills/:id', description: 'Delete a skill' },
    ],
  },
  {
    category: 'Executions',
    items: [
      { method: 'POST', path: '/v1/execute', description: 'Execute a skill' },
      { method: 'GET', path: '/v1/executions/:id', description: 'Get execution status' },
      { method: 'POST', path: '/v1/executions/:id/cancel', description: 'Cancel execution' },
    ],
  },
  {
    category: 'Marketplace',
    items: [
      { method: 'GET', path: '/v1/marketplace', description: 'Browse marketplace' },
      { method: 'POST', path: '/v1/marketplace/publish', description: 'Publish skill' },
      { method: 'GET', path: '/v1/marketplace/categories', description: 'List categories' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-400/10',
  POST: 'text-blue-400 bg-blue-400/10',
  PUT: 'text-amber-400 bg-amber-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
  PATCH: 'text-purple-400 bg-purple-400/10',
};

export default function ApiExplorer() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints[0].items[0]);
  const [activeTab, setActiveTab] = useState<'rest' | 'websocket'>('rest');
  const [copied, setCopied] = useState(false);
  const [requestBody, setRequestBody] = useState(JSON.stringify({
    skill_id: "skill_abc123",
    inputs: {
      prompt: "Hello, world!"
    }
  }, null, 2));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleResponse = JSON.stringify({
    id: "exec_xyz789",
    status: "completed",
    skill_id: "skill_abc123",
    created_at: "2024-01-15T10:30:00Z",
    completed_at: "2024-01-15T10:30:02Z",
    output: {
      result: "Hello, world!",
      tokens_used: 5
    }
  }, null, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-allternit-text mb-2">API Explorer</h1>
          <p className="text-allternit-text-secondary">
            Explore and test the Allternit Platform API endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-allternit-surface rounded-lg border border-allternit-border">
          <button
            onClick={() => setActiveTab('rest')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rest' 
                ? 'bg-allternit-accent text-allternit-bg' 
                : 'text-allternit-text-secondary hover:text-allternit-text'
            }`}
          >
            <Globe size={16} />
            REST API
          </button>
          <button
            onClick={() => setActiveTab('websocket')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'websocket' 
                ? 'bg-allternit-accent text-allternit-bg' 
                : 'text-allternit-text-secondary hover:text-allternit-text'
            }`}
          >
            <WebhooksLogo size={16} />
            WebSocket
          </button>
        </div>
      </div>

      {/* API Key Notice */}
      <div className="p-4 bg-allternit-accent/10 border border-allternit-accent/20 rounded-lg flex items-start gap-3">
        <Shield className="w-5 h-5 text-allternit-accent shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-allternit-text mb-1">Authentication Required</h4>
          <p className="text-sm text-allternit-text-secondary">
            All API requests require an API key. Include it in the Authorization header:{' '}
            <code className="text-allternit-accent">Authorization: Bearer YOUR_API_KEY</code>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoint List */}
        <div className="lg:col-span-1 space-y-4">
          {endpoints.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-allternit-text-muted uppercase tracking-wider mb-2 px-2">
                {category.category}
              </h3>
              <div className="space-y-1">
                {category.items.map((endpoint) => (
                  <button
                    key={endpoint.path}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedEndpoint.path === endpoint.path
                        ? 'bg-allternit-accent/10 border border-allternit-accent/20'
                        : 'hover:bg-allternit-surface-hover'
                    }`}
                  >
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${methodColors[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-mono truncate ${
                        selectedEndpoint.path === endpoint.path ? 'text-allternit-accent' : 'text-allternit-text'
                      }`}>
                        {endpoint.path}
                      </div>
                      <div className="text-xs text-allternit-text-muted truncate">
                        {endpoint.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Request/Response Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Endpoint Header */}
          <div className="p-4 bg-allternit-surface border border-allternit-border rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-sm font-mono font-semibold px-3 py-1 rounded ${methodColors[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
              <code className="text-a2r-text font-mono">https://api.a2r.dev{selectedEndpoint.path}</code>
            </div>
            <p className="text-sm text-allternit-text-secondary">{selectedEndpoint.description}</p>
          </div>

          {/* Request Panel */}
          <div className="bg-allternit-surface border border-allternit-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-allternit-border bg-allternit-surface-elevated">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-allternit-text-muted" />
                <span className="text-sm font-medium text-allternit-text">Request</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(requestBody)}
                  className="p-1.5 text-allternit-text-muted hover:text-allternit-text hover:bg-allternit-surface-hover rounded transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full h-48 bg-allternit-bg border border-allternit-border rounded-lg p-4 font-mono text-sm text-allternit-text resize-none focus:outline-none focus:border-allternit-accent"
                spellCheck={false}
              />
            </div>
            <div className="px-4 py-3 border-t border-allternit-border bg-allternit-surface-elevated">
              <button className="flex items-center gap-2 px-4 py-2 bg-allternit-accent text-allternit-bg rounded-lg font-medium hover:bg-allternit-accent-hover transition-colors">
                <Play size={16} />
                Send Request
              </button>
            </div>
          </div>

          {/* Response Panel */}
          <div className="bg-allternit-surface border border-allternit-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-allternit-border bg-allternit-surface-elevated">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-allternit-text-muted" />
                <span className="text-sm font-medium text-allternit-text">Response</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400">200 OK</span>
                <span className="text-xs text-allternit-text-muted">·</span>
                <span className="text-xs text-allternit-text-muted">142ms</span>
              </div>
            </div>
            <div className="p-4">
              <pre className="font-mono text-sm text-allternit-text overflow-x-auto">
                <code>{sampleResponse}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="pt-8 border-t border-allternit-border">
        <h2 className="text-lg font-semibold text-allternit-text mb-4">Code Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['JavaScript', 'Python', 'cURL', 'Go'].map((lang) => (
            <div key={lang} className="bg-allternit-surface border border-allternit-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-allternit-text">{lang}</span>
                <button className="text-xs text-allternit-text-muted hover:text-allternit-accent transition-colors">
                  Copy
                </button>
              </div>
              <pre className="font-mono text-xs text-allternit-text-secondary overflow-x-auto">
                <code>{`// ${lang} example
const response = await fetch(
  'https://api.a2r.dev${selectedEndpoint.path}',
  {
    method: '${selectedEndpoint.method}',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({...}),
  }
);`}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
