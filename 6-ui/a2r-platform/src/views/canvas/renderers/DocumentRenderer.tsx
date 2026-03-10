/**
 * DocumentRenderer.tsx
 * 
 * Renders document artifacts (Sparkpages equivalent).
 * Notion-style block editor with rich formatting.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Type, 
  Heading1, 
  Heading2, 
  List,
  CheckSquare,
  Quote,
  Code,
  Image as ImageIcon,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';
import { cn } from '@/lib/utils';

interface DocumentRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

export function DocumentRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: DocumentRendererProps) {
  const [editMode, setEditMode] = useState(false);
  
  // Parse document content (mock for now)
  const content = useMemo(() => {
    if (!artifact.content) {
      return {
        title: 'Untitled Document',
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            content: 'Start typing or paste content here...',
          },
        ],
      };
    }

    // Simple markdown-like parsing
    const lines = artifact.content.split('\n');
    const blocks = lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return { id: `block-${index}`, type: 'h1', content: line.slice(2) };
      }
      if (line.startsWith('## ')) {
        return { id: `block-${index}`, type: 'h2', content: line.slice(3) };
      }
      if (line.startsWith('### ')) {
        return { id: `block-${index}`, type: 'h3', content: line.slice(4) };
      }
      if (line.startsWith('- ')) {
        return { id: `block-${index}`, type: 'bullet', content: line.slice(2) };
      }
      if (line.startsWith('[] ')) {
        return { id: `block-${index}`, type: 'todo', content: line.slice(3), checked: false };
      }
      if (line.startsWith('[x] ')) {
        return { id: `block-${index}`, type: 'todo', content: line.slice(4), checked: true };
      }
      if (line.startsWith('> ')) {
        return { id: `block-${index}`, type: 'quote', content: line.slice(2) };
      }
      if (line.startsWith('```')) {
        return { id: `block-${index}`, type: 'code', content: line.slice(3) };
      }
      if (line.trim() === '') {
        return { id: `block-${index}`, type: 'spacer', content: '' };
      }
      return { id: `block-${index}`, type: 'paragraph', content: line };
    });

    return {
      title: artifact.title || 'Untitled Document',
      blocks,
    };
  }, [artifact.content, artifact.title]);

  // Render block based on type
  const renderBlock = (block: any) => {
    switch (block.type) {
      case 'h1':
        return (
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-4 mt-6">
            {block.content}
          </h1>
        );
      case 'h2':
        return (
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3 mt-5">
            {block.content}
          </h2>
        );
      case 'h3':
        return (
          <h3 className="text-xl font-medium text-[var(--text-primary)] mb-2 mt-4">
            {block.content}
          </h3>
        );
      case 'bullet':
        return (
          <li className="text-[var(--text-secondary)] ml-4 list-disc">
            {block.content}
          </li>
        );
      case 'todo':
        return (
          <div className="flex items-start gap-2 my-1">
            <input
              type="checkbox"
              defaultChecked={block.checked}
              className="mt-1 accent-[var(--accent-primary)]"
            />
            <span className={cn(
              "text-[var(--text-secondary)]",
              block.checked && "line-through text-[var(--text-tertiary)]"
            )}>
              {block.content}
            </span>
          </div>
        );
      case 'quote':
        return (
          <blockquote className="border-l-4 border-[var(--accent-primary)] pl-4 py-2 my-4 text-[var(--text-secondary)] italic bg-[var(--bg-primary)] rounded-r">
            {block.content}
          </blockquote>
        );
      case 'code':
        return (
          <pre className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg p-4 my-4 overflow-x-auto">
            <code className="text-sm text-[var(--text-secondary)] font-mono">
              {block.content}
            </code>
          </pre>
        );
      case 'spacer':
        return <div className="h-4" />;
      case 'paragraph':
      default:
        return (
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            {block.content}
          </p>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="h-10 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {content.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "h-7 text-xs",
              editMode && "text-[var(--accent-primary)]"
            )}
          >
            {editMode ? 'Done' : 'Edit'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Block toolbar (edit mode) */}
      {editMode && (
        <div className="h-10 border-b border-[var(--border-subtle)] flex items-center gap-1 px-4 bg-[var(--bg-primary)]">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Type className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <CheckSquare className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Quote className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Code className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <ImageIcon className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Title */}
          {editMode ? (
            <input
              type="text"
              defaultValue={content.title}
              className="w-full text-4xl font-bold text-[var(--text-primary)] bg-transparent border-none outline-none mb-8"
            />
          ) : (
            <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-8">
              {content.title}
            </h1>
          )}

          {/* Blocks */}
          <div className="space-y-2">
            {content.blocks.map((block: any, index: number) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                {block.type === 'bullet' ? (
                  <ul className="space-y-1">{renderBlock(block)}</ul>
                ) : (
                  renderBlock(block)
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
        <span>{content.blocks.length} blocks</span>
        <span>{artifact.content?.length || 0} characters</span>
      </div>
    </div>
  );
}
