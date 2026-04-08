import { useState } from 'react';
import {
  Browsers,
  MagnifyingGlass,
  Funnel,
  Star,
  DownloadSimple,
  Clock,
  CheckCircle,
  Terminal,
} from '@phosphor-icons/react';

const categories = [
  { id: 'all', label: 'All Templates', count: 24 },
  { id: 'webhook', label: 'Webhooks', count: 8 },
  { id: 'api', label: 'API Integration', count: 6 },
  { id: 'automation', label: 'Automation', count: 5 },
  { id: 'ai', label: 'AI/LLM', count: 3 },
  { id: 'utility', label: 'Utilities', count: 2 },
];

const templates = [
  {
    id: 'webhook-starter',
    name: 'Webhook Starter',
    description: 'Basic webhook handler with signature verification and retry logic.',
    category: 'webhook',
    language: 'TypeScript',
    stars: 234,
    downloads: 1250,
    updated: '2 days ago',
    tags: ['webhook', 'http', 'starter'],
    verified: true,
  },
  {
    id: 'slack-bot',
    name: 'Slack Bot',
    description: 'Interactive Slack bot with slash commands and modal support.',
    category: 'api',
    language: 'TypeScript',
    stars: 189,
    downloads: 890,
    updated: '1 week ago',
    tags: ['slack', 'bot', 'messaging'],
    verified: true,
  },
  {
    id: 'openai-integration',
    name: 'OpenAI Integration',
    description: 'Complete OpenAI integration with streaming and error handling.',
    category: 'ai',
    language: 'Python',
    stars: 567,
    downloads: 3200,
    updated: '3 days ago',
    tags: ['openai', 'llm', 'ai', 'streaming'],
    verified: true,
  },
  {
    id: 'database-sync',
    name: 'Database Sync',
    description: 'Synchronize data between multiple databases with conflict resolution.',
    category: 'automation',
    language: 'TypeScript',
    stars: 123,
    downloads: 456,
    updated: '2 weeks ago',
    tags: ['database', 'sync', 'automation'],
    verified: false,
  },
  {
    id: 'github-actions',
    name: 'GitHub Actions Trigger',
    description: 'Trigger and monitor GitHub Actions workflows from your skills.',
    category: 'automation',
    language: 'TypeScript',
    stars: 89,
    downloads: 234,
    updated: '1 month ago',
    tags: ['github', 'ci/cd', 'automation'],
    verified: true,
  },
  {
    id: 'stripe-webhook',
    name: 'Stripe Webhook Handler',
    description: 'Process Stripe webhooks with idempotency and event validation.',
    category: 'webhook',
    language: 'TypeScript',
    stars: 312,
    downloads: 1567,
    updated: '5 days ago',
    tags: ['stripe', 'payment', 'webhook'],
    verified: true,
  },
  {
    id: 'redis-cache',
    name: 'Redis Cache Layer',
    description: 'Add caching to your skills with Redis integration.',
    category: 'utility',
    language: 'TypeScript',
    stars: 78,
    downloads: 345,
    updated: '3 weeks ago',
    tags: ['redis', 'cache', 'performance'],
    verified: false,
  },
  {
    id: 'notion-integration',
    name: 'Notion Integration',
    description: 'Create, read, and update Notion pages and databases.',
    category: 'api',
    language: 'Python',
    stars: 156,
    downloads: 678,
    updated: '1 week ago',
    tags: ['notion', 'cms', 'productivity'],
    verified: true,
  },
  {
    id: 'anthropic-claude',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude integration with tool use support.',
    category: 'ai',
    language: 'TypeScript',
    stars: 234,
    downloads: 890,
    updated: '4 days ago',
    tags: ['anthropic', 'claude', 'llm', 'ai'],
    verified: true,
  },
];

const languageColors: Record<string, string> = {
  TypeScript: 'text-blue-400 bg-blue-400/10',
  Python: 'text-yellow-400 bg-yellow-400/10',
  Go: 'text-cyan-400 bg-cyan-400/10',
  Rust: 'text-orange-400 bg-orange-400/10',
};

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [_selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-allternit-text mb-2">Templates</h1>
        <p className="text-allternit-text-secondary">
          Jumpstart your development with pre-built skill templates and boilerplates.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-allternit-text-muted" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-allternit-surface border border-allternit-border rounded-lg text-sm text-allternit-text placeholder:text-allternit-text-muted focus:outline-none focus:border-allternit-accent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-allternit-surface border border-allternit-border rounded-lg text-sm text-allternit-text hover:bg-allternit-surface-hover transition-colors">
          <Funnel size={16} />
          Filter
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === category.id
                ? 'bg-allternit-accent text-allternit-bg'
                : 'bg-allternit-surface text-allternit-text-secondary hover:text-allternit-text hover:bg-allternit-surface-hover'
            }`}
          >
            {category.label}
            <span className={`ml-2 text-xs ${activeCategory === category.id ? 'text-allternit-bg/70' : 'text-allternit-text-muted'}`}>
              {category.count}
            </span>
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="group p-5 bg-allternit-surface border border-allternit-border rounded-xl hover:border-allternit-border-hover transition-all cursor-pointer"
            onClick={() => setSelectedTemplate(template.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-allternit-accent/10 flex items-center justify-center">
                <Browsers className="w-5 h-5 text-allternit-accent" />
              </div>
              <div className="flex items-center gap-1">
                {template.verified && (
                  <div className="p-1 rounded text-emerald-400" title="Verified">
                    <CheckCircle size={16} />
                  </div>
                )}
                <span className={`text-xs font-medium px-2 py-1 rounded ${languageColors[template.language]}`}>
                  {template.language}
                </span>
              </div>
            </div>

            {/* Content */}
            <h3 className="font-semibold text-allternit-text mb-1 group-hover:text-allternit-accent transition-colors">
              {template.name}
            </h3>
            <p className="text-sm text-allternit-text-secondary mb-4 line-clamp-2">
              {template.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {template.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded bg-allternit-bg text-allternit-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-allternit-border text-xs text-allternit-text-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" />
                  {template.stars}
                </span>
                <span className="flex items-center gap-1">
                  <DownloadSimple className="w-3.5 h-3.5" />
                  {template.downloads}
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {template.updated}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start CTA */}
      <div className="mt-12 p-6 bg-gradient-to-br from-allternit-surface to-allternit-surface-elevated border border-allternit-border rounded-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold text-allternit-text mb-2">
              Create your own template
            </h3>
            <p className="text-sm text-allternit-text-secondary max-w-md">
              Have a reusable skill pattern? Share it with the community by publishing 
              your own template to the marketplace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <code className="hidden sm:block px-4 py-2 bg-allternit-bg rounded-lg text-sm font-mono text-allternit-accent border border-allternit-border">
              allternit template create
            </code>
            <button className="flex items-center gap-2 px-4 py-2 bg-allternit-accent text-allternit-bg rounded-lg font-medium hover:bg-allternit-accent-hover transition-colors whitespace-nowrap">
              <Terminal size={16} />
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
