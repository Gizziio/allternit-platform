'use client';

import React, { useState } from 'react';

type Section = 'overview' | 'authentication' | 'api-reference' | 'sdk' | 'playground';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '⚡' },
  { id: 'authentication', label: 'Authentication', icon: '🔑' },
  { id: 'api-reference', label: 'API Reference', icon: '📋' },
  { id: 'sdk', label: 'SDK Setup', icon: '🛠' },
  { id: 'playground', label: 'Playground', icon: '🎮' },
];

const CODE = {
  apiKey: `# Set your API key in environment variables\nALLTERNIT_API_KEY=your_api_key_here`,
  sdkInstall: `npm install @allternit/sdk\n# or\npnpm add @allternit/sdk`,
  sdkUsage: `import { AllternitClient } from '@allternit/sdk';\n\nconst client = new AllternitClient({\n  apiKey: process.env.ALLTERNIT_API_KEY,\n});\n\nconst response = await client.chat.create({\n  model: 'allternit-1',\n  messages: [{ role: 'user', content: 'Hello!' }],\n});\n\nconsole.log(response.content);`,
  curlExample: `curl -X POST https://api.allternit.com/v1/chat \\\n  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "allternit-1",\n    "messages": [{ "role": "user", "content": "Hello!" }]\n  }'`,
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#0d1117', border: '1px solid #30363d' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{lang}</span>
        <button
          onClick={copy}
          style={{ fontSize: 11, color: copied ? '#3fb950' : '#8b949e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '16px', overflow: 'auto', fontSize: 13, lineHeight: 1.6, fontFamily: 'ui-monospace, monospace', color: '#e6edf3' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Overview() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Allternit Developer API</h2>
      <p style={{ color: '#8b949e', marginBottom: 24 }}>
        Build powerful AI applications with the Allternit API. Access language models, image generation, web search, code execution, and more.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { title: 'Chat Completions', desc: 'Multi-turn conversations with top models', icon: '💬' },
          { title: 'Image Generation', desc: 'Generate and edit images with AI', icon: '🎨' },
          { title: 'Web Search', desc: 'Real-time web search with citations', icon: '🔍' },
          { title: 'Code Execution', desc: 'Run code in sandboxed environments', icon: '⚙️' },
          { title: 'Deep Research', desc: 'Multi-step research and synthesis', icon: '📚' },
          { title: 'MCP Tools', desc: 'Connect external tools via MCP protocol', icon: '🔌' },
        ].map((card) => (
          <div key={card.title} style={{ padding: 16, borderRadius: 8, border: '1px solid #30363d', background: '#0d1117' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 13, color: '#8b949e' }}>{card.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderRadius: 8, border: '1px solid #388bfd40', background: '#388bfd10' }}>
        <strong>Base URL:</strong>{' '}
        <code style={{ fontFamily: 'monospace', color: '#79c0ff' }}>https://api.allternit.com/v1</code>
      </div>
    </div>
  );
}

function Authentication() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Authentication</h2>
      <p style={{ color: '#8b949e', marginBottom: 20 }}>
        All API requests require a Bearer token in the <code style={{ fontFamily: 'monospace' }}>Authorization</code> header.
      </p>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Environment Variable</h3>
      <CodeBlock code={CODE.apiKey} lang="env" />
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Request Header</h3>
        <CodeBlock code={`Authorization: Bearer YOUR_API_KEY`} lang="http" />
      </div>
      <div style={{ marginTop: 24, padding: 16, borderRadius: 8, border: '1px solid #f7853540', background: '#f7853510' }}>
        <strong>⚠ Security:</strong> Never expose your API key in client-side code or version control.
        Use environment variables and server-side requests only.
      </div>
    </div>
  );
}

function ApiReference() {
  const endpoints = [
    { method: 'POST', path: '/chat', desc: 'Create a chat completion' },
    { method: 'POST', path: '/images/generate', desc: 'Generate an image' },
    { method: 'POST', path: '/search', desc: 'Perform a web search' },
    { method: 'POST', path: '/code/execute', desc: 'Execute code in a sandbox' },
    { method: 'GET', path: '/models', desc: 'List available models' },
    { method: 'POST', path: '/research', desc: 'Start a deep research task' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>API Reference</h2>
      <p style={{ color: '#8b949e', marginBottom: 20 }}>Complete list of available endpoints.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {endpoints.map((ep) => (
          <div key={ep.path} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117' }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: ep.method === 'POST' ? '#388bfd20' : '#3fb95020',
              color: ep.method === 'POST' ? '#79c0ff' : '#56d364',
            }}>{ep.method}</span>
            <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#e6edf3' }}>{ep.path}</code>
            <span style={{ fontSize: 13, color: '#8b949e', marginLeft: 'auto' }}>{ep.desc}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Example: Chat Completion</h3>
        <CodeBlock code={CODE.curlExample} lang="bash" />
      </div>
    </div>
  );
}

function SdkSetup() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>SDK Setup</h2>
      <p style={{ color: '#8b949e', marginBottom: 20 }}>
        The official TypeScript/JavaScript SDK provides a type-safe interface to the Allternit API.
      </p>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Installation</h3>
      <CodeBlock code={CODE.sdkInstall} lang="bash" />
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Basic Usage</h3>
        <CodeBlock code={CODE.sdkUsage} lang="typescript" />
      </div>
    </div>
  );
}

function Playground() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json() as Record<string, unknown>;
      setResponse(typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>API Playground</h2>
      <p style={{ color: '#8b949e', marginBottom: 20 }}>Test the API directly from your browser.</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter a message..."
        rows={4}
        style={{
          width: '100%', padding: 12, borderRadius: 8, border: '1px solid #30363d',
          background: '#0d1117', color: '#e6edf3', fontFamily: 'inherit', fontSize: 14,
          resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <button
        onClick={run}
        disabled={loading || !prompt.trim()}
        style={{
          marginTop: 12, padding: '10px 20px', borderRadius: 6, border: 'none',
          background: loading ? '#21262d' : '#238636', color: '#fff',
          fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Running…' : 'Run'}
      </button>
      {response && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#8b949e' }}>Response</h3>
          <CodeBlock code={response} lang="json" />
        </div>
      )}
    </div>
  );
}

const SECTION_COMPONENTS: Record<Section, React.FC> = {
  overview: Overview,
  authentication: Authentication,
  'api-reference': ApiReference,
  sdk: SdkSetup,
  playground: Playground,
};

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e6edf3', background: '#010409' }}>
      <nav style={{ width: 220, flexShrink: 0, borderRight: '1px solid #30363d', padding: '24px 0', background: '#0d1117' }}>
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid #30363d', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Allternit</div>
          <div style={{ fontSize: 12, color: '#8b949e' }}>Developer Portal</div>
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 16px', border: 'none', background: activeSection === s.id ? '#388bfd20' : 'none',
              color: activeSection === s.id ? '#79c0ff' : '#c9d1d9',
              fontSize: 14, cursor: 'pointer', textAlign: 'left',
              borderLeft: `2px solid ${activeSection === s.id ? '#388bfd' : 'transparent'}`,
            }}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <ActiveComponent />
      </main>
    </div>
  );
}
