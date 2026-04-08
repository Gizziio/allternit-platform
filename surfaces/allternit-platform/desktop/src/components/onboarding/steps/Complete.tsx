/**
 * @fileoverview Complete Step Component
 * 
 * Final step of the onboarding wizard showing success state,
 * next steps, and call-to-action to start using A2R.
 * 
 * @module components/onboarding/steps/Complete
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Terminal, 
  ArrowRight, 
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  BookOpen,
  Settings,
} from 'lucide-react';
import { Step } from '../components/Step';
import { Button } from '../components/Button';

/**
 * Props for the CompleteStep component
 */
export interface CompleteStepProps {
  /** Callback to finish the wizard */
  onFinish: () => void;
}

/**
 * Success animation with checkmark and particles
 */
function SuccessAnimation(): JSX.Element {
  return (
    <div className="relative flex items-center justify-center">
      {/* Animated rings */}
      <motion.div
        className="absolute w-32 h-32 rounded-full border-2 border-green-500/30"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-40 h-40 rounded-full border-2 border-green-500/20"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />

      {/* Central checkmark */}
      <motion.div
        className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <motion.div
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      {/* Sparkle effects */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: `${50 + 40 * Math.sin((i * Math.PI) / 3)}%`,
            left: `${50 + 40 * Math.cos((i * Math.PI) / 3)}%`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1, delay: 0.5 + i * 0.1, repeat: Infinity, repeatDelay: 2 }}
        >
          <Sparkles className="w-4 h-4 text-green-400" />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Code block with copy functionality
 */
function CodeBlock({ code, label }: { code: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/50 bg-gray-900">
      {label && (
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
          <span className="text-xs font-medium text-gray-400">{label}</span>
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-lg bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100"
          aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Quick link card component
 */
interface QuickLinkProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

function QuickLink({ icon, title, description, href }: QuickLinkProps): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-4 rounded-xl bg-gray-800/30 border border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/50 transition-all group"
    >
      <div className="p-2 rounded-lg bg-gray-700/50 text-gray-400 group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white">{title}</h4>
          <ExternalLink className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
    </a>
  );
}

/**
 * Complete step component
 * 
 * Shows a success animation, provides example commands,
 * quick links to documentation, and a CTA to finish setup.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Complete step component
 */
export function CompleteStep({ onFinish }: CompleteStepProps): JSX.Element {
  const exampleCommands = [
    { cmd: 'a2r run "uname -a"', desc: 'Run a simple command' },
    { cmd: 'a2r run --interactive', desc: 'Start an interactive session' },
    { cmd: 'a2r status', desc: 'Check VM status' },
  ];

  const quickLinks: QuickLinkProps[] = [
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: 'Documentation',
      description: 'Learn more about A2R commands and features',
      href: 'https://docs.a2r.dev',
    },
    {
      icon: <Terminal className="w-5 h-5" />,
      title: 'CLI Reference',
      description: 'Complete command-line interface documentation',
      href: 'https://docs.a2r.dev/cli',
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: 'Settings',
      description: 'Configure VM resources and preferences',
      href: 'a2r://settings',
    },
  ];

  return (
    <Step
      title="Setup Complete!"
      description="Your A2R environment is ready to use"
      showNavigation={false}
    >
      <div className="space-y-8">
        {/* Success Animation */}
        <motion.div
          className="flex justify-center py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <SuccessAnimation />
        </motion.div>

        {/* Main content */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-white">
            Your A2R environment is ready
          </h2>
          <p className="text-gray-400 max-w-md mx-auto">
            You can now run commands in an isolated VM environment. 
            Here are some examples to get you started:
          </p>
        </motion.div>

        {/* Example commands */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CodeBlock 
            code={exampleCommands[0].cmd} 
            label={exampleCommands[0].desc}
          />
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="lg"
            onClick={onFinish}
            className="group"
          >
            Start Using A2R
            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* Quick links */}
        <motion.div
          className="grid gap-3 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm font-medium text-gray-500 text-center mb-2">
            Helpful resources
          </p>
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
            >
              <QuickLink {...link} />
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="text-center text-xs text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          You can reopen this wizard anytime from Settings → Onboarding
        </motion.p>
      </div>
    </Step>
  );
}
