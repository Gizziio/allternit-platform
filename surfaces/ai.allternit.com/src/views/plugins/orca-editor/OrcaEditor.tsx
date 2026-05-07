/**
 * Orca Markdown Editor - Main Component
 * 
 * Block-based markdown editor inspired by Notion
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Block, BlockType, EditorProps, SlashCommand } from './types';
import { BlockRenderer } from './BlockRenderer';
import { SlashCommandMenu } from './SlashCommandMenu';
import {
  Plus,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Download,
  FileText,
} from '@phosphor-icons/react';

// Generate unique ID
const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const OrcaEditor: React.FC<EditorProps> = ({
  document,
  onChange,
  onSave,
  readOnly = false,
}) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

  // Create new block
  const createBlock = useCallback((type: BlockType = 'paragraph', content: string = ''): Block => ({
    id: generateId(),
    type,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), []);

  // Insert block after specific block
  const insertBlock = useCallback((type: BlockType, afterId?: string) => {
    const newBlock = createBlock(type);
    const newBlocks = [...document.blocks];
    
    if (afterId) {
      const index = newBlocks.findIndex(b => b.id === afterId);
      if (index !== -1) {
        newBlocks.splice(index + 1, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }
    } else {
      newBlocks.push(newBlock);
    }
    
    onChange({ ...document, blocks: newBlocks });
    setActiveBlockId(newBlock.id);
    
    // Focus new block after render
    setTimeout(() => {
      const element = typeof window !== 'undefined' ? window.document.getElementById(`block-${newBlock.id}`) : null;
      element?.focus();
    }, 0);
  }, [document, onChange, createBlock]);

  // Delete block
  const deleteBlock = useCallback((id: string) => {
    const index = document.blocks.findIndex(b => b.id === id);
    const newBlocks = document.blocks.filter(b => b.id !== id);
    
    onChange({ ...document, blocks: newBlocks });
    
    // Focus previous block or next block
    if (newBlocks.length > 0 && index > 0) {
      setActiveBlockId(newBlocks[Math.min(index, newBlocks.length - 1)].id);
    }
  }, [document, onChange]);

  // Move block up/down
  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    const index = document.blocks.findIndex(b => b.id === id);
    if (index === -1) return;
    
    const newBlocks = [...document.blocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newBlocks.length) {
      [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
      onChange({ ...document, blocks: newBlocks });
    }
  }, [document, onChange]);

  // Update block
  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    const newBlocks = document.blocks.map(b =>
      b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
    );
    onChange({ ...document, blocks: newBlocks });
  }, [document, onChange]);

  // Convert block type
  const convertBlock = useCallback((id: string, type: BlockType) => {
    updateBlock(id, { type });
    setActiveBlockId(id);
  }, [updateBlock]);

  // Duplicate block
  const duplicateBlock = useCallback((id: string) => {
    const block = document.blocks.find(b => b.id === id);
    if (!block) return;
    
    const newBlock: Block = {
      ...block,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const index = document.blocks.findIndex(b => b.id === id);
    const newBlocks = [...document.blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    
    onChange({ ...document, blocks: newBlocks });
  }, [document, onChange]);

  // Handle key down in blocks
  const handleBlockKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    const block = document.blocks.find(b => b.id === blockId);
    if (!block) return;

    // Handle slash command
    if (e.key === '/') {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      if (range) {
        const rect = range.getBoundingClientRect();
        setSlashMenuPosition({ top: rect.bottom + 5, left: rect.left });
        setShowSlashMenu(true);
        setSlashSearchQuery('');
      }
      return;
    }

    // Hide slash menu on escape
    if (e.key === 'Escape') {
      setShowSlashMenu(false);
      return;
    }

    // Backspace on empty block deletes it
    if (e.key === 'Backspace' && block.content === '' && document.blocks.length > 1) {
      e.preventDefault();
      deleteBlock(blockId);
      return;
    }

    // Enter creates new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBlock('paragraph', blockId);
      return;
    }

    // Arrow navigation
    const index = document.blocks.findIndex(b => b.id === blockId);
    
    if (e.key === 'ArrowUp' && index > 0) {
      setActiveBlockId(document.blocks[index - 1].id);
    }
    
    if (e.key === 'ArrowDown' && index < document.blocks.length - 1) {
      setActiveBlockId(document.blocks[index + 1].id);
    }
  }, [document.blocks, deleteBlock, insertBlock]);

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback((command: SlashCommand) => {
    if (activeBlockId) {
      convertBlock(activeBlockId, command.blockType);
    }
    setShowSlashMenu(false);
    setSlashSearchQuery('');
  }, [activeBlockId, convertBlock]);

  // Export document to markdown
  const exportToMarkdown = useCallback(() => {
    let markdown = `# ${document.title}\n\n`;
    
    document.blocks.forEach(block => {
      switch (block.type) {
        case 'heading-1':
          markdown += `# ${block.content}\n\n`;
          break;
        case 'heading-2':
          markdown += `## ${block.content}\n\n`;
          break;
        case 'heading-3':
          markdown += `### ${block.content}\n\n`;
          break;
        case 'bullet-list':
          markdown += `- ${block.content}\n`;
          break;
        case 'numbered-list':
          markdown += `1. ${block.content}\n`;
          break;
        case 'todo':
          markdown += `- [${block.props?.checked ? 'x' : ' '}] ${block.content}\n`;
          break;
        case 'code':
          markdown += `\`\`\`${block.props?.language || ''}\n${block.content}\n\`\`\`\n\n`;
          break;
        case 'quote':
          markdown += `> ${block.content}\n\n`;
          break;
        case 'divider':
          markdown += `---\n\n`;
          break;
        default:
          markdown += `${block.content}\n\n`;
      }
    });
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    if (typeof window === 'undefined') return;
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [document]);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      onSave?.(document);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [document, onSave]);

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Sidebar - File Tree */}
      {isSidebarOpen && (
        <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-medium text-zinc-300">Files</span>
            <button className="p-1 text-zinc-500 hover:text-zinc-300">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {/* Placeholder for file tree */}
            <div className="text-sm text-zinc-500 text-center py-8">
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p>File tree will appear here</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
            >
              {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            
            <input
              type="text"
              value={document.title}
              onChange={(e) => onChange({ ...document, title: e.target.value })}
              className="bg-transparent text-lg font-semibold text-zinc-200 outline-none placeholder-zinc-600"
              placeholder="Untitled Document"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 mr-2">
              {document.blocks.length} blocks • Auto-saving
            </span>
            <button
              onClick={exportToMarkdown}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-1 text-sm"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800/50 text-sm text-zinc-300 rounded-t border-t-2 border-blue-500">
              <FileText size={14} />
              {document.title || 'Untitled'}
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div 
          ref={editorRef}
          className="flex-1 overflow-y-auto"
          onClick={(e) => {
            if (e.target === editorRef.current) {
              // Clicked on empty area, focus last block or create new
              if (document.blocks.length === 0) {
                insertBlock('paragraph');
              } else {
                setActiveBlockId(document.blocks[document.blocks.length - 1].id);
              }
            }
          }}
        >
          <div className="max-w-3xl mx-auto px-8 py-8">
            {document.blocks.map((block, index) => (
              <div key={block.id} id={`block-${block.id}`}>
                <BlockRenderer
                  block={block}
                  isActive={activeBlockId === block.id}
                  onChange={(updatedBlock) => updateBlock(block.id, updatedBlock)}
                  onFocus={() => setActiveBlockId(block.id)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, 'up')}
                  onMoveDown={() => moveBlock(block.id, 'down')}
                  onConvert={(type) => convertBlock(block.id, type)}
                  onAddBelow={() => insertBlock('paragraph', block.id)}
                />
              </div>
            ))}
            
            {/* Empty state */}
            {document.blocks.length === 0 && (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-lg mb-2">Start writing...</p>
                <p className="text-sm">Type &apos;/&apos; for commands or just start typing</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slash Command Menu */}
      <SlashCommandMenu
        isOpen={showSlashMenu}
        searchQuery={slashSearchQuery}
        onSelect={handleSlashCommandSelect}
        onClose={() => setShowSlashMenu(false)}
        position={slashMenuPosition}
      />
    </div>
  );
};

export default OrcaEditor;
