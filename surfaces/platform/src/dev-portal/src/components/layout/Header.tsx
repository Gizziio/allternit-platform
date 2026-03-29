import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  List,
  X,
  MagnifyingGlass,
  GithubLogo as Github,
  Sun,
  Moon,
  Monitor,
  CaretDown,
  Sparkle,
} from '@phosphor-icons/react';
import { useThemeStore } from '../../store/themeStore';
import { cn } from '../../utils/cn';

const navItems = [
  { label: 'Getting Started', href: '/getting-started' },
  { 
    label: 'Documentation', 
    href: '/docs',
    children: [
      { label: 'Overview', href: '/docs/overview' },
      { label: 'Manifest', href: '/docs/manifest' },
      { label: 'UI Components', href: '/docs/ui-components' },
      { label: 'AI Integration', href: '/docs/ai-integration' },
    ],
  },
  { label: 'Templates', href: '/templates' },
  { label: 'API', href: '/api' },
  { label: 'Publish', href: '/publish' },
];

const externalLinks = [
  { label: 'Marketplace', href: 'https://marketplace.a2r.dev', external: true },
  { label: 'A2R App', href: 'https://app.a2r.dev', external: true },
];

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const location = useLocation();
  const { mode, setMode } = useThemeStore();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-200 dark:border-surface-800 bg-white/80 dark:bg-surface-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-a2r-500 to-violet-500 flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
              <Sparkle className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              A2R <span className="text-a2r-500">Dev</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <div key={item.label} className="relative group">
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-a2r-600 dark:text-a2r-400 bg-a2r-50 dark:bg-a2r-900/20'
                      : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'
                  )}
                >
                  {item.label}
                  {item.children && (
                    <CaretDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                  )}
                </Link>

                {/* Dropdown */}
                {item.children && (
                  <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl py-2 min-w-[200px]">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="block px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <Link
              to="/search"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <MagnifyingGlass size={20} />
              <span className="hidden md:inline text-sm">Search</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-xs font-mono">
                ⌘K
              </kbd>
            </Link>

            {/* Theme Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                aria-label="Toggle theme"
              >
                {mode === 'dark' ? (
                  <Moon size={20} />
                ) : mode === 'light' ? (
                  <Sun size={20} />
                ) : (
                  <Monitor size={20} />
                )}
              </button>

              {/* Theme Menu */}
              {isThemeMenuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl py-2 min-w-[140px]">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => {
                        setMode(theme);
                        setIsThemeMenuOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                        mode === theme
                          ? 'text-a2r-600 dark:text-a2r-400 bg-a2r-50 dark:bg-a2r-900/20'
                          : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'
                      )}
                    >
                      {theme === 'light' && <Sun size={16} />}
                      {theme === 'dark' && <Moon size={16} />}
                      {theme === 'system' && <Monitor size={16} />}
                      <span className="capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GitHub */}
            <a
              href="https://github.com/a2r-dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="GitHub"
            >
              <Github size={20} />
            </a>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X size={20} />
              ) : (
                <List size={20} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-surface-200 dark:border-surface-800 py-4">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <div key={item.label}>
                  <Link
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-a2r-600 dark:text-a2r-400 bg-a2r-50 dark:bg-a2r-900/20'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'
                    )}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <div className="ml-4 mt-1 flex flex-col gap-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center px-4 py-2 rounded-lg text-sm text-surface-500 dark:text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              <div className="border-t border-surface-200 dark:border-surface-800 my-2" />
              
              {externalLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
