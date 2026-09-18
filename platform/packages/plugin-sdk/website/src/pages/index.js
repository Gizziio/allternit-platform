import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

function Hero() {
  return (
    <header className={styles.hero}>
      <div className="container">
        <h1 className={styles.heroTitle}>
          <span className={styles.gradient}>Universal Plugin SDK</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Run Allternit plugins on any LLM platform.<br />
          Write once. Run everywhere.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/quickstart">
            Get Started →
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            Documentation
          </Link>
        </div>
        
        <div className={styles.installBox}>
          <code>npm install -g @allternit/plugin-sdk</code>
        </div>
      </div>
    </header>
  );
}

function Feature({title, description, icon}) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featureGrid}>
          <Feature
            icon="🌐"
            title="6 Platform Adapters"
            description="MCP, HTTP, CLI, VS Code, LangChain, and Native. Covering every major LLM platform."
          />
          <Feature
            icon="🔄"
            title="Universal Format"
            description="One plugin works everywhere. No platform-specific rewrites needed."
          />
          <Feature
            icon="🛡️"
            title="Graceful Degradation"
            description="Plugins adapt to available capabilities. Missing tools? LLM fills in."
          />
          <Feature
            icon="⚡"
            title="Quick Conversion"
            description="Convert existing templates in minutes with the allternit-plugin CLI."
          />
        </div>
      </div>
    </section>
  );
}

function Platforms() {
  const platforms = [
    { name: 'Claude Desktop', status: 'Ready', icon: '🎯' },
    { name: 'VS Code', status: 'Ready', icon: '📝' },
    { name: 'OpenAI Codex', status: 'Ready', icon: '🤖' },
    { name: 'Cursor', status: 'Ready', icon: '⚡' },
    { name: 'LangChain', status: 'Ready', icon: '🦜' },
    { name: 'HTTP API', status: 'Ready', icon: '🌐' },
  ];

  return (
    <section className={styles.platforms}>
      <div className="container">
        <h2>Supported Platforms</h2>
        <div className={styles.platformGrid}>
          {platforms.map(p => (
            <div key={p.name} className={styles.platformCard}>
              <span className={styles.platformIcon}>{p.icon}</span>
              <span className={styles.platformName}>{p.name}</span>
              <span className={styles.platformStatus}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section className={styles.codeSection}>
      <div className="container">
        <h2>Write Once, Run Anywhere</h2>
        <div className={styles.codeExample}>
          <pre>
            <code>{`import { PluginHost } from '@allternit/plugin-sdk';

export async function run(host: PluginHost, params: any) {
  // Works on Claude, VS Code, Codex, Cursor...
  const analysis = await host.llm.complete(
    \`Analyze: \${params.topic}\`
  );
  
  // UI adapts to platform
  host.ui.renderMarkdown(analysis);
  
  // Tools gracefully degrade
  if (host.tools.has('browser')) {
    return host.tools.execute('browser', { url: params.url });
  }
  
  // Fallback to LLM knowledge
  return host.llm.complete(
    \`Research this URL: \${params.url}\`
  );
}`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.cta}>
      <div className="container">
        <h2>Ready to build universal plugins?</h2>
        <p>Join the ecosystem. Publish once. Reach every LLM platform.</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/quickstart">
            Start Building
          </Link>
          <a className="button button--outline button--lg" href="https://github.com/allternit/plugin-sdk">
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Universal Plugin SDK"
      description="Run Allternit plugins on any LLM platform">
      <Hero />
      <main>
        <Features />
        <Platforms />
        <CodeExample />
        <CTASection />
      </main>
    </Layout>
  );
}
