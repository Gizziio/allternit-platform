import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  CaretRight,
  MagnifyingGlass,
  FileText,
  Terminal,
  Code,
  GearSix,
  Users,
  Question as HelpCircle,
} from '@phosphor-icons/react';

const docSections = [
  {
    title: 'Getting Started',
    icon: BookOpen,
    items: [
      { id: 'introduction', title: 'Introduction', href: '/docs/introduction' },
      { id: 'quickstart', title: 'Quick Start', href: '/docs/quickstart' },
      { id: 'installation', title: 'Installation', href: '/docs/installation' },
      { id: 'first-skill', title: 'Your First Skill', href: '/docs/first-skill' },
    ],
  },
  {
    title: 'Core Concepts',
    icon: FileText,
    items: [
      { id: 'skills', title: 'Skills Overview', href: '/docs/skills' },
      { id: 'manifest', title: 'Skill Manifest', href: '/docs/manifest' },
      { id: 'runtime', title: 'Runtime Environment', href: '/docs/runtime' },
      { id: 'security', title: 'Security Model', href: '/docs/security' },
    ],
  },
  {
    title: 'Development',
    icon: Code,
    items: [
      { id: 'cli', title: 'CLI Reference', href: '/docs/cli' },
      { id: 'sdk', title: 'SDK Documentation', href: '/docs/sdk' },
      { id: 'testing', title: 'Testing Skills', href: '/docs/testing' },
      { id: 'debugging', title: 'Debugging', href: '/docs/debugging' },
    ],
  },
  {
    title: 'Deployment',
    icon: Terminal,
    items: [
      { id: 'packaging', title: 'Packaging', href: '/docs/packaging' },
      { id: 'publishing', title: 'Publishing', href: '/docs/publishing' },
      { id: 'versioning', title: 'Versioning', href: '/docs/versioning' },
      { id: 'marketplace', title: 'Marketplace', href: '/docs/marketplace' },
    ],
  },
  {
    title: 'Configuration',
    icon: GearSix,
    items: [
      { id: 'env-vars', title: 'Environment Variables', href: '/docs/env-vars' },
      { id: 'secrets', title: 'Secrets Management', href: '/docs/secrets' },
      { id: 'permissions', title: 'Permissions', href: '/docs/permissions' },
    ],
  },
  {
    title: 'Community',
    icon: Users,
    items: [
      { id: 'contributing', title: 'Contributing', href: '/docs/contributing' },
      { id: 'code-of-conduct', title: 'Code of Conduct', href: '/docs/code-of-conduct' },
    ],
  },
];

export default function Docs() {
  const { section } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['Getting Started']);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  // Mock content for the current section
  const currentSection = section || 'introduction';
  const currentDoc = docSections
    .flatMap(s => s.items)
    .find(item => item.id === currentSection);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24">
          {/* Search */}
          <div className="relative mb-6">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-allternit-text-muted" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-allternit-surface border border-allternit-border rounded-lg text-sm text-allternit-text placeholder:text-allternit-text-muted focus:outline-none focus:border-allternit-accent"
            />
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {docSections.map((docSection) => {
              const Icon = docSection.icon;
              const isExpanded = expandedSections.includes(docSection.title);
              
              return (
                <div key={docSection.title}>
                  <button
                    onClick={() => toggleSection(docSection.title)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-allternit-text-secondary hover:text-allternit-text transition-colors"
                  >
                    <CaretRight 
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                    <Icon size={16} />
                    {docSection.title}
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-4 pl-4 border-l border-allternit-border space-y-1 mt-1">
                      {docSection.items.map((item) => (
                        <Link
                          key={item.id}
                          to={item.href}
                          className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            currentSection === item.id
                              ? 'text-allternit-accent bg-allternit-accent/10'
                              : 'text-allternit-text-secondary hover:text-allternit-text hover:bg-allternit-surface-hover'
                          }`}
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-allternit-text-muted mb-6">
          <BookOpen size={16} />
          <span>Documentation</span>
          <CaretRight size={16} />
          <span className="text-allternit-text">{currentDoc?.title || 'Introduction'}</span>
        </div>

        {/* Content */}
        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-allternit-text mb-6">
            {currentDoc?.title || 'Introduction to Allternit'}
          </h1>

          {/* Mock content - would be replaced with actual MDX content */}
          <div className="space-y-6 text-allternit-text-secondary">
            <p className="text-lg leading-relaxed">
              Welcome to the Allternit Developer Portal. This guide will help you understand 
              the platform and build your first skill.
            </p>

            <div className="p-4 bg-allternit-accent/10 border border-allternit-accent/20 rounded-lg">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-allternit-accent shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-allternit-text mb-1">What is Allternit?</h4>
                  <p className="text-sm">
                    Allternit is a platform for building, deploying, and distributing AI-powered 
                    skills. Skills are modular components that can be composed together 
                    to create powerful automation workflows.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-allternit-text mt-8">Prerequisites</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Node.js 18 or higher</li>
              <li>Allternit CLI installed globally</li>
              <li>Basic understanding of TypeScript</li>
            </ul>

            <h2 className="text-xl font-semibold text-allternit-text mt-8">Installation</h2>
            <p>Install the Allternit CLI using npm:</p>
            <pre className="bg-allternit-surface p-4 rounded-lg overflow-x-auto">
              <code>npm install -g @allternit/cli</code>
            </pre>

            <h2 className="text-xl font-semibold text-allternit-text mt-8">Next Steps</h2>
            <p>
              Now that you have the CLI installed, head over to the{' '}
              <Link to="/docs/quickstart" className="text-allternit-accent hover:underline">
                Quick Start guide
              </Link>{' '}
              to build your first skill.
            </p>
          </div>
        </article>

        {/* Page Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-allternit-border">
          <button className="flex items-center gap-2 text-allternit-text-secondary hover:text-allternit-text transition-colors">
            <CaretRight className="w-4 h-4 rotate-180" />
            <span>Previous</span>
          </button>
          <button className="flex items-center gap-2 text-allternit-accent hover:text-allternit-accent-hover transition-colors">
            <span>Next</span>
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {/* Right Sidebar - Table of Contents */}
      <aside className="hidden xl:block w-48 shrink-0">
        <div className="sticky top-24">
          <h4 className="text-sm font-medium text-allternit-text mb-4">On this page</h4>
          <nav className="space-y-2 text-sm">
            <a href="#" className="block text-allternit-accent">Introduction</a>
            <a href="#" className="block text-allternit-text-secondary hover:text-allternit-text">Prerequisites</a>
            <a href="#" className="block text-allternit-text-secondary hover:text-allternit-text">Installation</a>
            <a href="#" className="block text-allternit-text-secondary hover:text-allternit-text">Next Steps</a>
          </nav>
        </div>
      </aside>
    </div>
  );
}
