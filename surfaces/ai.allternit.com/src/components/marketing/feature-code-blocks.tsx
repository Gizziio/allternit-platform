'use client';

/**
 * Feature Code Blocks
 *
 * Marketing component that pairs code snippets with feature highlights.
 * Common pattern on AI/ developer tool landing pages — show a feature
 * description on the left and a relevant code example on the right (or vice versa).
 *
 * Inspired by aisdkagents.com feature code block patterns.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconCheck,
  IconCopy,
  IconTerminal,
  IconCode,
  IconBraces,
  IconBolt,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

export interface FeatureCodeBlock {
  id: string;
  title: string;
  description: string;
  features: string[];
  code: {
    language: string;
    snippet: string;
  };
  icon?: React.ReactNode;
}

export interface FeatureCodeBlocksProps {
  blocks: FeatureCodeBlock[];
  className?: string;
  title?: string;
  subtitle?: string;
}

// ─── Main Component ────────────────────────────────────────────────

export function FeatureCodeBlocks({
  blocks,
  className,
  title = 'Built for developers',
  subtitle = 'Powerful APIs that just work',
}: FeatureCodeBlocksProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeBlock = blocks[activeIndex];

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-base text-[var(--text-muted)]"
          >
            {subtitle}
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {blocks.map((block, i) => (
            <button
              key={block.id}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                i === activeIndex
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/20'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]'
              )}
            >
              {block.icon || <IconCode className="size-4 " />}
              {block.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeBlock && (
            <motion.div
              key={activeBlock.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="grid gap-8 lg:grid-cols-2"
            >
              {/* Feature Description */}
              <div className="flex flex-col justify-center space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10  items-center justify-center rounded-xl bg-[var(--accent-primary)]/10">
                    {activeBlock.icon || <IconBolt className="size-5  text-[var(--accent-primary)]" />}
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                    {activeBlock.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {activeBlock.description}
                </p>
                <ul className="space-y-3">
                  {activeBlock.features.map((feature, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="flex items-start gap-2.5"
                    >
                      <div className="mt-0.5 flex size-5  shrink-0 items-center justify-center rounded-full bg-green-500/10">
                        <IconCheck className="size-3  text-green-400" />
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Code Block */}
              <div className="overflow-hidden rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)]">
                {/* Code Header */}
                <div className="flex items-center justify-between border-b border-[var(--ui-border-muted)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <IconTerminal className="size-3.5  text-[var(--text-muted)]" />
                    <span className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {activeBlock.code.language}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(activeBlock.code.snippet, activeBlock.id)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    {copiedId === activeBlock.id ? (
                      <>
                        <IconCheck className="size-3  text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <IconCopy className="size-3 " />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                {/* Code Content */}
                <div className="overflow-x-auto p-4">
                  <pre className="text-xs leading-relaxed">
                    <code className="font-mono text-[var(--text-primary)]">
                      <SyntaxHighlight code={activeBlock.code.snippet} />
                    </code>
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Simple Syntax Highlighting ────────────────────────────────────

function SyntaxHighlight({ code }: { code: string }) {
  const tokens = tokenize(code);

  return (
    <>
      {tokens.map((token, i) => (
        <span
          key={i}
          className={cn(
            token.type === 'keyword' && 'text-purple-400',
            token.type === 'string' && 'text-green-400',
            token.type === 'comment' && 'text-[var(--text-muted)]',
            token.type === 'number' && 'text-amber-400',
            token.type === 'function' && 'text-blue-400',
            token.type === 'operator' && 'text-[var(--text-secondary)]',
            token.type === 'punctuation' && 'text-[var(--text-secondary)]',
            token.type === 'plain' && 'text-[var(--text-primary)]'
          )}
        >
          {token.value}
        </span>
      ))}
    </>
  );
}

// ─── Simple Tokenizer ──────────────────────────────────────────────

const KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'async', 'await',
  'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'try', 'catch', 'throw', 'typeof',
  'interface', 'type', 'enum', 'switch', 'case', 'break', 'continue', 'default', 'yield',
  'true', 'false', 'null', 'undefined', 'void', 'as', 'in', 'of',
]);

const OPERATORS = new Set([
  '=', '=>', '===', '!==', '==', '!=', '>=', '<=', '>', '<', '+', '-', '*', '/', '%',
  '&&', '||', '!', '??', '?', ':', '++', '--', '+=', '-=', '*=', '/=',
]);

interface Token {
  type: string;
  value: string;
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    // Comments
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < code.length && code[i] !== '\n') i++;
      tokens.push({ type: 'comment', value: code.slice(start, i) });
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      if (i < code.length) i++;
      tokens.push({ type: 'string', value: code.slice(start, i) });
      continue;
    }

    // Numbers
    if (/\d/.test(ch)) {
      const start = i;
      while (i < code.length && /[\d.]/.test(code[i])) i++;
      tokens.push({ type: 'number', value: code.slice(start, i) });
      continue;
    }

    // Words
    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (code[i] === '(') {
        tokens.push({ type: 'function', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      continue;
    }

    // Operators (try longest first)
    let op = '';
    for (const operator of Array.from(OPERATORS).sort((a, b) => b.length - a.length)) {
      if (code.slice(i, i + operator.length) === operator) {
        op = operator;
        break;
      }
    }
    if (op) {
      tokens.push({ type: 'operator', value: op });
      i += op.length;
      continue;
    }

    // Punctuation / whitespace
    if (/[{}[\]();,.]/.test(ch)) {
      tokens.push({ type: 'punctuation', value: ch });
      i++;
      continue;
    }

    // Default: plain character
    tokens.push({ type: 'plain', value: ch });
    i++;
  }

  return tokens;
}

// ─── Demo Data ─────────────────────────────────────────────────────

export const DEMO_FEATURE_BLOCKS: FeatureCodeBlock[] = [
  {
    id: 'streaming',
    title: 'Stream in Real-Time',
    description:
      'Build chat interfaces that feel alive. Stream tokens as they are generated with zero latency, giving users immediate feedback and a sense of progress.',
    features: [
      'Token-by-token streaming with useChat hook',
      'Automatic message history management',
      'Built-in loading and error states',
      'Works with any AI SDK provider',
    ],
    code: {
      language: 'typescript',
      snippet: `import { useChat } from '@ai-sdk/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something…"
        />
      </form>
    </div>
  );
}`,
    },
    icon: <IconBolt className="size-5  text-[var(--accent-primary)]" />,
  },
  {
    id: 'tools',
    title: 'Tool Calling',
    description:
      'Give your AI agents superpowers. Define tools with Zod schemas and let the model decide when to call them — search the web, query databases, or trigger workflows.',
    features: [
      'Type-safe tool definitions with Zod',
      'Automatic tool result streaming',
      'Multi-step reasoning out of the box',
      'Composable tool ecosystems',
    ],
    code: {
      language: 'typescript',
      snippet: `import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get the weather for a location',
      parameters: z.object({
        city: z.string(),
        unit: z.enum(['C', 'F']).default('C'),
      }),
      execute: async ({ city, unit }) => {
        const data = await fetchWeather(city, unit);
        return data;
      },
    }),
  },
  prompt: 'What is the weather in San Francisco?',
});`,
    },
    icon: <IconBraces className="size-5  text-[var(--accent-primary)]" />,
  },
  {
    id: 'structured',
    title: 'Structured Output',
    description:
      'Get exactly the data shape you need. Use Zod schemas to constrain model outputs with automatic validation and retry logic built in.',
    features: [
      'Zod schema validation with automatic retry',
      'TypeScript inference from schemas',
      'Array and object generation support',
      'Fallback to text on schema failure',
    ],
    code: {
      language: 'typescript',
      snippet: `import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({
        name: z.string(),
        amount: z.string(),
      })),
      steps: z.array(z.string()),
      prepTime: z.number(),
    }),
  }),
  prompt: 'Generate a pasta recipe',
});`,
    },
    icon: <IconCode className="size-5  text-[var(--accent-primary)]" />,
  },
];
