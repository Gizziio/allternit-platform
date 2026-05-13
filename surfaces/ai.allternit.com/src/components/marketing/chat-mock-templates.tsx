'use client';

/**
 * Chat Mock Templates
 *
 * Styled chat UI shells mimicking popular AI chat interfaces.
 * Useful for marketing pages, demos, and onboarding flows.
 *
 * Templates: GPT (OpenAI), Claude (Anthropic), Grok (xAI)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconSend,
  IconPaperclip,
  IconMicrophone,
  IconSparkles,
  IconBolt,
  IconBrain,
  IconCopy,
  IconThumbUp,
  IconThumbDown,
  IconRefresh,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

export type ChatTemplate = 'gpt' | 'claude' | 'grok';

export interface MockMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isTyping?: boolean;
}

export interface ChatMockTemplateProps {
  template: ChatTemplate;
  messages: MockMessage[];
  className?: string;
  title?: string;
  onSend?: (message: string) => void;
  showControls?: boolean;
}

// ─── Main Component ────────────────────────────────────────────────

export function ChatMockTemplate({
  template,
  messages,
  className,
  title,
  onSend,
  showControls = true,
}: ChatMockTemplateProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const theme = TEMPLATES[template];
  const displayTitle = title || theme.defaultTitle;

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.isTyping) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || !onSend) return;
    onSend(inputValue);
    setInputValue('');
  };

  return (
    <div
      className={cn(
        'flex h-[560px] flex-col overflow-hidden rounded-xl border shadow-lg',
        theme.containerClass,
        className
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between border-b px-4 py-3', theme.headerClass)}>
        <div className="flex items-center gap-2.5">
          <div className={cn('flex size-7  items-center justify-center rounded-md', theme.iconBg)}>
            {theme.icon}
          </div>
          <span className={cn('text-sm font-semibold', theme.titleClass)}>{displayTitle}</span>
        </div>
        {showControls && (
          <div className="flex items-center gap-1">
            <button className={cn('rounded p-1.5 transition-colors', theme.buttonClass)}>
              <IconRefresh className="size-3.5 " />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className={cn('flex-1 space-y-4 overflow-y-auto p-4', theme.messagesClass)}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            template={template}
            isLast={i === messages.length - 1}
          />
        ))}
        {isTyping && <TypingIndicator template={template} />}
      </div>

      {/* Input */}
      <div className={cn('border-t px-4 py-3', theme.inputAreaClass)}>
        <div className={cn('flex items-end gap-2 rounded-xl border px-3 py-2', theme.inputClass)}>
          <button className={cn('rounded p-1 transition-colors', theme.buttonClass)}>
            <IconPaperclip className="size-4 " />
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={theme.placeholder}
            className={cn(
              'min-h-[20px] flex-1 resize-none bg-transparent text-sm outline-none',
              theme.textareaClass
            )}
            rows={1}
          />
          <button className={cn('rounded p-1 transition-colors', theme.buttonClass)}>
            <IconMicrophone className="size-4 " />
          </button>
          <button
            onClick={handleSend}
            className={cn(
              'flex size-8  items-center justify-center rounded-lg transition-all',
              inputValue.trim()
                ? theme.sendButtonActive
                : 'bg-[var(--ui-border-muted)] text-[var(--text-muted)]'
            )}
          >
            <IconSend className="size-3.5 " />
          </button>
        </div>
        <div className={cn('mt-1.5 text-center text-xs', theme.disclaimerClass)}>
          {theme.disclaimer}
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────

function MessageBubble({
  message,
  template,
  isLast,
}: {
  message: MockMessage;
  template: ChatTemplate;
  isLast: boolean;
}) {
  const theme = TEMPLATES[template];
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex size-7  shrink-0 items-center justify-center rounded-full',
          isUser ? theme.userAvatar : theme.assistantAvatar
        )}
      >
        {isUser ? (
          <span className="text-xs font-bold">U</span>
        ) : (
          theme.smallIcon
        )}
      </div>

      {/* Content */}
      <div className={cn('max-w-[80%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser ? theme.userBubble : theme.assistantBubble
          )}
        >
          {message.content}
        </div>

        {/* Actions */}
        {!isUser && isLast && (
          <div className={cn('flex items-center gap-1 pt-0.5', theme.actionsClass)}>
            <ActionButton template={template}>
              <IconCopy className="size-3 " />
            </ActionButton>
            <ActionButton template={template}>
              <IconThumbUp className="size-3 " />
            </ActionButton>
            <ActionButton template={template}>
              <IconThumbDown className="size-3 " />
            </ActionButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActionButton({
  template,
  children,
}: {
  template: ChatTemplate;
  children: React.ReactNode;
}) {
  const theme = TEMPLATES[template];
  return (
    <button className={cn('rounded p-1 transition-colors', theme.actionButtonClass)}>{children}</button>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────

function TypingIndicator({ template }: { template: ChatTemplate }) {
  const theme = TEMPLATES[template];

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'flex size-7  shrink-0 items-center justify-center rounded-full',
          theme.assistantAvatar
        )}
      >
        {theme.smallIcon}
      </div>
      <div className={cn('rounded-2xl px-4 py-3', theme.assistantBubble)}>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              className={cn('size-1.5  rounded-full', theme.dotClass)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Template Definitions ──────────────────────────────────────────

const TEMPLATES: Record<
  ChatTemplate,
  {
    defaultTitle: string;
    containerClass: string;
    headerClass: string;
    icon: React.ReactNode;
    smallIcon: React.ReactNode;
    iconBg: string;
    titleClass: string;
    messagesClass: string;
    userAvatar: string;
    assistantAvatar: string;
    userBubble: string;
    assistantBubble: string;
    inputAreaClass: string;
    inputClass: string;
    textareaClass: string;
    buttonClass: string;
    sendButtonActive: string;
    placeholder: string;
    disclaimer: string;
    disclaimerClass: string;
    actionsClass: string;
    actionButtonClass: string;
    dotClass: string;
  }
> = {
  gpt: {
    defaultTitle: 'ChatGPT',
    containerClass: 'border-neutral-800 bg-neutral-900',
    headerClass: 'border-neutral-800 bg-neutral-900',
    icon: <IconSparkles className="size-4  text-emerald-400" />,
    smallIcon: <IconSparkles className="size-3  text-emerald-400" />,
    iconBg: 'bg-emerald-500/10',
    titleClass: 'text-neutral-100',
    messagesClass: 'bg-neutral-900',
    userAvatar: 'bg-emerald-600 text-white',
    assistantAvatar: 'bg-neutral-800 border border-neutral-700',
    userBubble: 'bg-emerald-600 text-white rounded-br-md',
    assistantBubble: 'bg-neutral-800 text-neutral-100 rounded-bl-md',
    inputAreaClass: 'bg-neutral-900 border-neutral-800',
    inputClass: 'bg-neutral-800 border-neutral-700',
    textareaClass: 'text-neutral-100 placeholder:text-neutral-500',
    buttonClass: 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
    sendButtonActive: 'bg-emerald-600 text-white hover:bg-emerald-500',
    placeholder: 'Message ChatGPT…',
    disclaimer: 'ChatGPT can make mistakes. Check important info.',
    disclaimerClass: 'text-neutral-600',
    actionsClass: 'text-neutral-500',
    actionButtonClass: 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800',
    dotClass: 'bg-neutral-400',
  },
  claude: {
    defaultTitle: 'Claude',
    containerClass: 'border-[#e5e0d8] bg-[#faf9f7]',
    headerClass: 'border-[#e5e0d8] bg-[#faf9f7]',
    icon: <IconBrain className="size-4  text-[#d97757]" />,
    smallIcon: <IconBrain className="size-3  text-[#d97757]" />,
    iconBg: 'bg-[#d97757]/10',
    titleClass: 'text-[#1a1a1a]',
    messagesClass: 'bg-[#faf9f7]',
    userAvatar: 'bg-[#d97757] text-white',
    assistantAvatar: 'bg-white border border-[#e5e0d8]',
    userBubble: 'bg-[#d97757] text-white rounded-br-md',
    assistantBubble: 'bg-white text-[#1a1a1a] border border-[#e5e0d8] rounded-bl-md',
    inputAreaClass: 'bg-[#faf9f7] border-[#e5e0d8]',
    inputClass: 'bg-white border-[#e5e0d8] shadow-sm',
    textareaClass: 'text-[#1a1a1a] placeholder:text-[#a8a29e]',
    buttonClass: 'text-[#a8a29e] hover:text-[#1a1a1a] hover:bg-[#f0ece6]',
    sendButtonActive: 'bg-[#d97757] text-white hover:bg-[#c46a4d]',
    placeholder: 'Message Claude…',
    disclaimer: 'Claude can make mistakes. Please double-check responses.',
    disclaimerClass: 'text-[#a8a29e]',
    actionsClass: 'text-[#a8a29e]',
    actionButtonClass: 'text-[#a8a29e] hover:text-[#1a1a1a] hover:bg-[#f0ece6]',
    dotClass: 'bg-[#a8a29e]',
  },
  grok: {
    defaultTitle: 'Grok',
    containerClass: 'border-neutral-800 bg-black',
    headerClass: 'border-neutral-800 bg-black',
    icon: <IconBolt className="size-4  text-white" />,
    smallIcon: <IconBolt className="size-3  text-white" />,
    iconBg: 'bg-white/10',
    titleClass: 'text-white',
    messagesClass: 'bg-black',
    userAvatar: 'bg-white text-black',
    assistantAvatar: 'bg-neutral-900 border border-neutral-800',
    userBubble: 'bg-white text-black rounded-br-md',
    assistantBubble: 'bg-neutral-900 text-white border border-neutral-800 rounded-bl-md',
    inputAreaClass: 'bg-black border-neutral-800',
    inputClass: 'bg-neutral-900 border-neutral-800',
    textareaClass: 'text-white placeholder:text-neutral-500',
    buttonClass: 'text-neutral-500 hover:text-white hover:bg-neutral-800',
    sendButtonActive: 'bg-white text-black hover:bg-neutral-200',
    placeholder: 'What do you want to know?',
    disclaimer: 'Grok can make mistakes. Verify its outputs.',
    disclaimerClass: 'text-neutral-600',
    actionsClass: 'text-neutral-500',
    actionButtonClass: 'text-neutral-500 hover:text-white hover:bg-neutral-800',
    dotClass: 'bg-neutral-400',
  },
};

// ─── Demo / Preset Messages ────────────────────────────────────────

export const DEMO_MESSAGES: Record<ChatTemplate, MockMessage[]> = {
  gpt: [
    {
      id: '1',
      role: 'user',
      content: 'Explain quantum computing in simple terms',
    },
    {
      id: '2',
      role: 'assistant',
      content:
        "Quantum computing uses quantum bits (qubits) instead of regular bits. While a normal bit is either 0 or 1, a qubit can be both at the same time thanks to superposition. This allows quantum computers to process vast amounts of possibilities simultaneously, making them incredibly powerful for certain tasks like cryptography and drug discovery.",
    },
  ],
  claude: [
    {
      id: '1',
      role: 'user',
      content: 'Write a haiku about autumn',
    },
    {
      id: '2',
      role: 'assistant',
      content:
        'Golden leaves descend,\nCrisp air whispers through the trees,\nAutumn\'s quiet song.',
    },
  ],
  grok: [
    {
      id: '1',
      role: 'user',
      content: 'What is the meaning of life?',
    },
    {
      id: '2',
      role: 'assistant',
      content:
        "The meaning of life is one of humanity's oldest questions. Philosophers, scientists, and thinkers have proposed many answers — from seeking happiness and knowledge to serving others or simply experiencing existence. What matters most is what gives your own life purpose and fulfillment.",
    },
  ],
};
