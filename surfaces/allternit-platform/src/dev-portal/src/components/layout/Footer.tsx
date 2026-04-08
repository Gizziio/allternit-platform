import { Link } from 'react-router-dom';
import {
  GithubLogo as Github,
  TwitterLogo as Twitter,
  ChatCircle,
  Sparkle,
} from '@phosphor-icons/react';

const footerLinks = {
  Product: [
    { label: 'Features', href: 'https://a2r.dev/features' },
    { label: 'Pricing', href: 'https://a2r.dev/pricing' },
    { label: 'Changelog', href: 'https://a2r.dev/changelog' },
    { label: 'Roadmap', href: 'https://a2r.dev/roadmap' },
  ],
  Developers: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/api' },
    { label: 'Templates', href: '/templates' },
    { label: 'Status', href: 'https://status.a2r.dev' },
  ],
  Community: [
    { label: 'Discord', href: 'https://discord.gg/a2r' },
    { label: 'Twitter', href: 'https://twitter.com/a2r' },
    { label: 'GitHub', href: 'https://github.com/a2r-dev' },
    { label: 'Forum', href: 'https://forum.a2r.dev' },
  ],
  Company: [
    { label: 'About', href: 'https://a2r.dev/about' },
    { label: 'Blog', href: 'https://a2r.dev/blog' },
    { label: 'Careers', href: 'https://a2r.dev/careers' },
    { label: 'Contact', href: 'https://a2r.dev/contact' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-allternit-500 to-violet-500 flex items-center justify-center">
                <Sparkle className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">
                Allternit <span className="text-allternit-500">Dev</span>
              </span>
            </Link>
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-4 max-w-xs">
              Build, test, and publish plugins for the Allternit platform. 
              Join thousands of developers extending Allternit.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/a2r-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                aria-label="GitHub"
              >
                <Github size={20} />
              </a>
              <a
                href="https://twitter.com/a2r"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://discord.gg/a2r"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                aria-label="Discord"
              >
                <ChatCircle size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-surface-600 dark:text-surface-400 hover:text-allternit-600 dark:hover:text-allternit-400 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500 dark:text-surface-500">
            © {new Date().getFullYear()} Allternit. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://a2r.dev/privacy"
              className="text-sm text-surface-500 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://a2r.dev/terms"
              className="text-sm text-surface-500 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
