import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  House,
  BookOpen,
  Code,
  Browsers,
  UploadSimple,
  List,
  GithubLogo as Github,
  TwitterLogo as Twitter,
  ArrowSquareOut,
  CaretRight,
} from '@phosphor-icons/react';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Home', icon: House },
  { path: '/docs', label: 'Documentation', icon: BookOpen },
  { path: '/api', label: 'API Explorer', icon: Code },
  { path: '/templates', label: 'Templates', icon: Browsers },
  { path: '/publish', label: 'Publish Guide', icon: UploadSimple },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-allternit-bg flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen
          w-64 bg-allternit-surface border-r border-allternit-border
          transform transition-transform duration-300 ease-out
          lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-allternit-border">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-allternit-accent/10 flex items-center justify-center">
              <span className="text-allternit-accent font-bold text-lg">Allternit</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-allternit-text group-hover:text-allternit-accent transition-colors">
                Developer
              </span>
              <span className="text-xs text-allternit-text-muted">Portal</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
                  transition-all duration-200 group
                  ${isActive 
                    ? 'bg-allternit-accent/10 text-allternit-accent font-medium' 
                    : 'text-allternit-text-secondary hover:text-allternit-text hover:bg-allternit-surface-hover'
                  }
                `}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.path === '/publish' && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-allternit-accent/20 text-allternit-accent">
                    New
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-allternit-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-allternit-text-muted">v1.0.0</span>
            <div className="flex items-center gap-2">
              <a 
                href="https://github.com/a2r" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-allternit-text-muted hover:text-allternit-text hover:bg-allternit-surface-hover transition-all"
              >
                <Github size={16} />
              </a>
              <a 
                href="https://twitter.com/a2r" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-allternit-text-muted hover:text-allternit-text hover:bg-allternit-surface-hover transition-all"
              >
                <Twitter size={16} />
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-allternit-border bg-allternit-bg/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="h-full px-4 lg:px-8 flex items-center justify-between">
            {/* Left: Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-allternit-text-secondary hover:text-allternit-text hover:bg-allternit-surface-hover transition-all"
            >
              <List size={20} />
            </button>

            {/* Center: Breadcrumb (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-allternit-text-muted">Allternit Platform</span>
              <CaretRight className="w-4 h-4 text-allternit-text-muted" />
              <span className="text-allternit-text">Developer Portal</span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <a
                href="https://a2r.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm text-allternit-text-secondary hover:text-allternit-text transition-colors"
              >
                <span>Go to App</span>
                <ArrowSquareOut size={16} />
              </a>
              <a
                href="https://a2r.dev"
                className="flex items-center gap-2 px-4 py-2 bg-allternit-accent text-allternit-bg rounded-lg font-medium hover:bg-allternit-accent-hover transition-colors"
              >
                <span className="hidden sm:inline">Launch Allternit</span>
                <span className="sm:hidden">Launch</span>
              </a>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 animate-fade-in">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-allternit-border py-6 px-4 lg:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-allternit-text-muted">
              <span>© 2024 Allternit Platform</span>
              <span className="hidden sm:inline">·</span>
              <a href="/privacy" className="hover:text-allternit-text">Privacy</a>
              <span className="hidden sm:inline">·</span>
              <a href="/terms" className="hover:text-allternit-text">Terms</a>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://discord.gg/a2r" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-allternit-text-muted hover:text-allternit-accent transition-colors"
              >
                Discord
              </a>
              <a 
                href="mailto:dev@allternit.dev" 
                className="text-sm text-allternit-text-muted hover:text-allternit-accent transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
