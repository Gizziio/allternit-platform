'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CapabilityCardProps, CapabilityPricing, CapabilityStatus } from '@/components/marketplace/CapabilityCard';
import type { CapabilityDetailData } from '@/components/marketplace/CapabilityDetail';
import type { CapabilityCategory } from '@/components/marketplace/CapabilitySearchBar';

export interface MarketplaceCapability {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  author: string;
  version: string;
  kind: 'skill' | 'tool' | 'plugin' | 'mcp' | 'connector' | 'workflow';
  pricing: CapabilityPricing;
  amountCents?: number;
  currency?: string;
  rating?: number;
  installCount?: number;
  icon?: string;
  tags?: string[];
  repository?: string;
  homepage?: string;
  license?: string;
  permissions?: Array<{ resource: string; access: string; description: string }>;
  tools?: Array<{ name: string; description: string }>;
  createdAt?: string;
  updatedAt?: string;
}

const INITIAL_CAPABILITIES: MarketplaceCapability[] = [
  {
    id: 'cap-web-researcher',
    name: 'Advanced Web Researcher',
    description: 'Specialized agent skill for deep technical research and data verification across multiple sources.',
    longDescription: 'A comprehensive research capability that performs deep web searches, cross-references multiple sources, and produces verified summaries with citations. Ideal for technical documentation research, competitive analysis, and fact-checking.',
    author: 'Allternit Labs',
    version: '2.1.0',
    kind: 'skill',
    pricing: 'free',
    rating: 4.8,
    installCount: 12400,
    icon: '🔍',
    tags: ['research', 'web', 'verification', 'citations'],
    license: 'MIT',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-11-20T00:00:00Z',
    tools: [
      { name: 'deep_search', description: 'Perform multi-source web search with result aggregation' },
      { name: 'verify_claim', description: 'Cross-reference a claim against multiple sources' },
      { name: 'cite_sources', description: 'Generate formatted citations for research findings' },
    ],
  },
  {
    id: 'cap-github-suite',
    name: 'GitHub Suite',
    description: 'Manage issues, PRs, repository settings, and workflows directly through Allternit agents.',
    longDescription: 'Full-featured GitHub integration that allows agents to create issues, review PRs, manage labels, trigger workflows, and perform repository administration. Supports GitHub Enterprise and fine-grained permissions.',
    author: 'DevTools Co',
    version: '3.2.1',
    kind: 'connector',
    pricing: 'free',
    rating: 4.6,
    installCount: 8900,
    icon: '🐙',
    tags: ['git', 'code', 'collaboration', 'devops'],
    license: 'Apache-2.0',
    repository: 'https://github.com/devtools-co/allternit-github',
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: '2024-11-18T00:00:00Z',
    permissions: [
      { resource: 'network', access: 'execute', description: 'Access GitHub API endpoints' },
    ],
    tools: [
      { name: 'github.create_issue', description: 'Create a new issue in a repository' },
      { name: 'github.list_prs', description: 'List pull requests with filters' },
      { name: 'github.review_pr', description: 'Submit a code review on a pull request' },
      { name: 'github.manage_labels', description: 'Create, update, or delete repository labels' },
    ],
  },
  {
    id: 'cap-hiring-pipeline',
    name: 'Talent Acquisition Pipeline',
    description: 'Pre-configured DAG for managing candidate screening, technical assessments, and interview scheduling.',
    longDescription: 'A complete hiring workflow automation capability that handles resume parsing, technical skill assessment, interview scheduling, and candidate communication. Includes customizable evaluation rubrics and bias-detection features.',
    author: 'HR Automation',
    version: '1.5.0',
    kind: 'workflow',
    pricing: 'enterprise',
    amountCents: 29900,
    currency: 'USD',
    rating: 4.9,
    installCount: 3200,
    icon: '👥',
    tags: ['hr', 'recruitment', 'dag', 'automation'],
    license: 'Commercial',
    homepage: 'https://hr-automation.io/capabilities/hiring',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'cap-finance-pack',
    name: 'Finance Intelligence Pack',
    description: 'Comprehensive set of agents and tools for market analysis, portfolio tracking, and financial reporting.',
    longDescription: 'A professional-grade financial analysis toolkit with real-time market data integration, portfolio performance tracking, risk assessment tools, and automated report generation. Supports multiple asset classes and international markets.',
    author: 'Quant Labs',
    version: '2.0.0',
    kind: 'plugin',
    pricing: 'subscription',
    amountCents: 4900,
    currency: 'USD',
    rating: 4.7,
    installCount: 1500,
    icon: '📈',
    tags: ['finance', 'reporting', 'analysis', 'portfolio'],
    license: 'Commercial',
    createdAt: '2024-04-20T00:00:00Z',
    updatedAt: '2024-11-10T00:00:00Z',
    tools: [
      { name: 'market_data.fetch', description: 'Fetch real-time and historical market data' },
      { name: 'portfolio.analyze', description: 'Analyze portfolio performance and risk metrics' },
      { name: 'report.generate', description: 'Generate formatted financial reports' },
    ],
  },
  {
    id: 'cap-code-review',
    name: 'Advanced Code Reviewer',
    description: 'Automated code review with security scanning, best practice enforcement, and architectural analysis.',
    longDescription: 'An intelligent code review capability that goes beyond linting to identify security vulnerabilities, performance issues, architectural anti-patterns, and maintainability concerns. Supports 20+ languages with customizable rule sets.',
    author: 'CodeGuard',
    version: '4.0.0',
    kind: 'tool',
    pricing: 'paid',
    amountCents: 9900,
    currency: 'USD',
    rating: 4.5,
    installCount: 6700,
    icon: '🔒',
    tags: ['code', 'security', 'review', 'quality'],
    license: 'MIT',
    repository: 'https://github.com/codeguard/code-reviewer-mcp',
    createdAt: '2024-02-28T00:00:00Z',
    updatedAt: '2024-11-22T00:00:00Z',
    tools: [
      { name: 'review.scan', description: 'Run a comprehensive code review scan' },
      { name: 'review.security', description: 'Perform security-focused vulnerability analysis' },
      { name: 'review.architecture', description: 'Analyze code architecture and dependencies' },
    ],
  },
  {
    id: 'cap-doc-generator',
    name: 'Documentation Generator',
    description: 'Generate comprehensive documentation from code, APIs, and existing docs with multiple output formats.',
    longDescription: 'Automatically generate API references, user guides, tutorials, and technical documentation from your codebase. Supports Markdown, OpenAPI, JSDoc, and custom templates with cross-linking and versioning.',
    author: 'Allternit Labs',
    version: '1.3.0',
    kind: 'mcp',
    pricing: 'free',
    rating: 4.4,
    installCount: 4500,
    icon: '📝',
    tags: ['documentation', 'api', 'generation', 'markdown'],
    license: 'MIT',
    createdAt: '2024-05-15T00:00:00Z',
    updatedAt: '2024-11-19T00:00:00Z',
    tools: [
      { name: 'docs.generate_api', description: 'Generate API reference documentation from code' },
      { name: 'docs.generate_guide', description: 'Create user guides and tutorials' },
      { name: 'docs.update', description: 'Update existing documentation with changes' },
    ],
  },
];

export function useCapabilityMarketplace() {
  const [capabilities] = useState<MarketplaceCapability[]>(INITIAL_CAPABILITIES);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CapabilityCategory>('all');
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const getStatus = useCallback(
    (id: string): CapabilityStatus => {
      if (installingIds.has(id)) return 'installing';
      if (installedIds.has(id)) return 'installed';
      return 'not-installed';
    },
    [installedIds, installingIds],
  );

  const handleInstall = useCallback(
    async (id: string) => {
      if (installingIds.has(id) || installedIds.has(id)) return;
      setInstallingIds((prev) => new Set(prev).add(id));
      // Simulate async install
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setInstalledIds((prev) => new Set(prev).add(id));
      const cap = capabilities.find((c) => c.id === id);
      notify(`Installed ${cap?.name || 'capability'}`);
    },
    [installingIds, installedIds, capabilities, notify],
  );

  const handleUninstall = useCallback(
    (id: string) => {
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      const cap = capabilities.find((c) => c.id === id);
      notify(`Removed ${cap?.name || 'capability'}`);
    },
    [capabilities, notify],
  );

  const handleDetails = useCallback((id: string) => {
    setSelectedCapabilityId(id);
  }, []);

  const filteredCapabilities = useMemo(() => {
    return capabilities.filter((cap) => {
      const matchesSearch =
        !searchQuery ||
        cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cap.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cap.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        activeCategory === 'all' || cap.kind === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [capabilities, searchQuery, activeCategory]);

  const selectedCapability = useMemo(() => {
    return capabilities.find((c) => c.id === selectedCapabilityId) || null;
  }, [capabilities, selectedCapabilityId]);

  return {
    capabilities: filteredCapabilities,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    notification,
    getStatus,
    handleInstall,
    handleUninstall,
    handleDetails,
    selectedCapability,
    selectedCapabilityId,
    setSelectedCapabilityId,
  };
}
