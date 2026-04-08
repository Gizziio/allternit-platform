/**
 * AllternitDocumentEditor.tsx
 * 
 * A2R-native document editor wrapping BlockNote.
 * Rich, Notion-style block editor with A2R theming.
 */

import React, { useEffect, useState } from 'react';
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import {
  FileText,
  PencilSimple,
  Eye,
  FloppyDisk,
  ShareNetwork,
  DotsThreeOutline,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AllternitDocumentEditorProps {
  /** Initial content as markdown or BlockNote blocks */
  initialContent?: string | PartialBlock[];
  /** Document title */
  title?: string;
  /** Read-only mode for viewing generated docs */
  readOnly?: boolean;
  /** Callback when content changes */
  onChange?: (content: PartialBlock[]) => void;
  /** Callback when title changes */
  onTitleChange?: (title: string) => void;
  /** Optional className for styling */
  className?: string;
  /** Show/hide toolbar */
  showToolbar?: boolean;
  /** Document metadata */
  metadata?: {
    author?: string;
    createdAt?: Date;
    updatedAt?: Date;
    source?: string;
  };
}

/**
 * A2R Document Editor
 * 
 * Wraps BlockNote with A2R-native theming and branding.
 * All user-facing labels say "A2R Document" not "BlockNote".
 */
export function AllternitDocumentEditor({
  initialContent,
  title = 'Untitled Document',
  readOnly = false,
  onChange,
  onTitleChange,
  className,
  showToolbar = true,
  metadata,
}: AllternitDocumentEditorProps) {
  const [documentTitle, setDocumentTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Initialize BlockNote editor
  const editor = useCreateBlockNote({
    initialContent: typeof initialContent === 'string' 
      ? undefined 
      : initialContent,
    // A2R-native placeholders
    placeholders: {
      default: "Start typing or press '/' for commands...",
      heading: "Heading",
      bulletListItem: "List item",
      numberedListItem: "List item",
    },
  });

  // Parse markdown if string provided
  useEffect(() => {
    if (typeof initialContent === 'string' && editor && initialContent) {
      try {
        // Try to parse as markdown blocks
        const blocks = parseMarkdownToBlocks(initialContent);
        editor.replaceBlocks(editor.document, blocks);
      } catch (e) {
        console.warn('[AllternitDocument] Failed to parse markdown:', e);
      }
    }
  }, [editor, initialContent]);

  // Track word count
  useEffect(() => {
    if (!editor) return;
    
    const updateStats = () => {
      const text = editor.document.reduce((acc: string, block: any) => {
        if (block.content && Array.isArray(block.content)) {
          const textContent = block.content
            .map((c: any) => c.text || '')
            .join(' ');
          return acc + textContent;
        }
        return acc;
      }, '');
      setWordCount(text.split(/\s+/).filter(w => w.length > 0).length);
    };

    editor.onChange(updateStats);
    updateStats();
  }, [editor]);

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setDocumentTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  // Handle content change
  const handleContentChange = () => {
    if (editor) {
      onChange?.(editor.document);
    }
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#1a1a1a] rounded-lg">
        <div className="text-[var(--text-tertiary)]">Loading A2R Document...</div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333]",
        className
      )}
    >
      {/* A2R Document Toolbar */}
      {showToolbar && (
        <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-[#D4956A]" />
            
            {/* Editable title */}
            {isEditingTitle ? (
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false);
                }}
                autoFocus
                className="bg-transparent text-sm font-medium text-[#ECECEC] border-none outline-none min-w-[200px]"
              />
            ) : (
              <button
                onClick={() => !readOnly && setIsEditingTitle(true)}
                className="text-sm font-medium text-[#ECECEC] hover:text-[#D4956A] transition-colors flex items-center gap-2"
              >
                {documentTitle}
                {!readOnly && <PencilSimple className="w-3 h-3 opacity-50" />}
              </button>
            )}

            {/* Document metadata */}
            <span className="text-xs text-[#666]">
              {wordCount} words
            </span>
          </div>

          <div className="flex items-center gap-2">
            {readOnly && (
              <span className="text-xs text-[#666] flex items-center gap-1">
                <Eye size={12} />
                Read-only
              </span>
            )}
            
            <Button variant="ghost" size="sm" className="h-7 text-[#888] hover:text-[#ECECEC]">
              <FloppyDisk size={16} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[#888] hover:text-[#ECECEC]">
              <ShareNetwork size={16} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[#888] hover:text-[#ECECEC]">
              <DotsThreeOutline size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* BlockNote Editor with A2R Theme */}
      <div className="flex-1 overflow-auto a2r-document-theme">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          onChange={handleContentChange}
          className="min-h-full"
          theme={{
            colors: {
              editor: {
                text: '#ECECEC',
                background: '#1a1a1a',
              },
              menu: {
                text: '#ECECEC',
                background: '#242424',
              },
              tooltip: {
                text: '#ECECEC',
                background: '#333',
              },
            },
            borderRadius: 6,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        />
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[#333] flex items-center justify-between px-4 text-xs text-[#666] bg-[#1e1e1e]">
        <div className="flex items-center gap-4">
          <span>A2R Document</span>
          <span>{editor.document.length} blocks</span>
          <span>{wordCount} words</span>
        </div>
        
        {metadata?.source && (
          <div className="flex items-center gap-2">
            <span>Source: {metadata.source}</span>
            {metadata.updatedAt && (
              <span>• Last edited {formatTime(metadata.updatedAt)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Parse markdown content to BlockNote blocks
 */
function parseMarkdownToBlocks(markdown: string): PartialBlock[] {
  const lines = markdown.split('\n');
  const blocks: PartialBlock[] = [];
  let currentList: PartialBlock[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'codeBlock',
          props: { language: codeLanguage },
          content: codeContent.trim(),
        });
        inCodeBlock = false;
        codeContent = '';
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      flushList(blocks, currentList);
      blocks.push({
        type: 'heading',
        props: { level: 1 },
        content: line.slice(2),
      });
      continue;
    }

    if (line.startsWith('## ')) {
      flushList(blocks, currentList);
      blocks.push({
        type: 'heading',
        props: { level: 2 },
        content: line.slice(3),
      });
      continue;
    }

    if (line.startsWith('### ')) {
      flushList(blocks, currentList);
      blocks.push({
        type: 'heading',
        props: { level: 3 },
        content: line.slice(4),
      });
      continue;
    }

    // Bullet lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push({
        type: 'bulletListItem',
        content: line.slice(2),
      });
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      currentList.push({
        type: 'numberedListItem',
        content: line.replace(/^\d+\.\s/, ''),
      });
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      flushList(blocks, currentList);
      blocks.push({
        type: 'quote',
        content: line.slice(2),
      });
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      flushList(blocks, currentList);
      continue;
    }

    // Regular paragraph
    flushList(blocks, currentList);
    blocks.push({
      type: 'paragraph',
      content: line,
    });
  }

  // Flush any remaining list items
  flushList(blocks, currentList);

  // If we ended in a code block
  if (inCodeBlock) {
    blocks.push({
      type: 'codeBlock',
      props: { language: codeLanguage },
      content: codeContent.trim(),
    });
  }

  return blocks;
}

function flushList(blocks: PartialBlock[], currentList: PartialBlock[]) {
  if (currentList.length > 0) {
    blocks.push(...currentList);
    currentList.length = 0;
  }
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default AllternitDocumentEditor;
