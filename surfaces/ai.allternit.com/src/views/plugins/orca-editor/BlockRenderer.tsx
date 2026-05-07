/**
 * Orca Block Renderer
 * 
 * Renders individual blocks based on their type
 */

import React, { useState, useRef, useCallback } from 'react';
import { Block, BlockType, EditorAPI } from './types';
import { cn } from './cn';
import { 
  CheckSquare, 
  Square, 
  DotsSixVertical as GripVertical, 
  Plus,
  Trash as Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  TextT,
} from '@phosphor-icons/react';

interface BlockRendererProps {
  block: Block;
  isActive: boolean;
  isDragging?: boolean;
  onChange: (block: Block) => void;
  onFocus: () => void;
  onBlur?: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onConvert: (type: BlockType) => void;
  onAddBelow: () => void;
  placeholder?: string;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isActive,
  isDragging,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onConvert,
  onAddBelow,
  placeholder,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      onChange({
        ...block,
        content: contentRef.current.innerText,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [block, onChange]);

  const handleToggleTodo = useCallback(() => {
    if (block.type === 'todo') {
      onChange({
        ...block,
        props: { ...block.props, checked: !block.props?.checked },
        updatedAt: new Date().toISOString(),
      });
    }
  }, [block, onChange]);

  const renderBlockContent = () => {
    const commonProps = {
      ref: contentRef,
      contentEditable: true,
      suppressContentEditableWarning: true,
      onInput: handleInput,
      onFocus,
      onBlur,
      onKeyDown,
      className: cn(
        'outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 empty:before:cursor-text',
        isActive && 'ring-2 ring-blue-500/20 rounded px-1 -mx-1',
      ),
      'data-placeholder': placeholder || getPlaceholder(block.type),
    };

    switch (block.type) {
      case 'heading-1':
        return (
          <h1 {...commonProps} className={cn(commonProps.className, 'text-3xl font-bold text-zinc-100 mb-4')}>
            {block.content}
          </h1>
        );
      
      case 'heading-2':
        return (
          <h2 {...commonProps} className={cn(commonProps.className, 'text-2xl font-semibold text-zinc-100 mb-3')}>
            {block.content}
          </h2>
        );
      
      case 'heading-3':
        return (
          <h3 {...commonProps} className={cn(commonProps.className, 'text-xl font-semibold text-zinc-200 mb-2')}>
            {block.content}
          </h3>
        );
      
      case 'bullet-list':
        return (
          <div className="flex items-start gap-2 mb-1">
            <span className="text-zinc-400 mt-1.5 select-none">•</span>
            <div {...commonProps} className={cn(commonProps.className, 'flex-1 text-zinc-300')}>
              {block.content}
            </div>
          </div>
        );
      
      case 'numbered-list':
        return (
          <div className="flex items-start gap-2 mb-1">
            <span className="text-zinc-400 mt-1.5 select-none min-w-[1.5rem]">{block.props?.index || 1}.</span>
            <div {...commonProps} className={cn(commonProps.className, 'flex-1 text-zinc-300')}>
              {block.content}
            </div>
          </div>
        );
      
      case 'todo':
        return (
          <div className="flex items-start gap-2 mb-1">
            <button
              onClick={handleToggleTodo}
              className="mt-1.5 text-zinc-400 hover:text-blue-400 transition-colors"
            >
              {block.props?.checked ? (
                <CheckSquare size={18} className="text-blue-500" weight="fill" />
              ) : (
                <Square size={18} />
              )}
            </button>
            <div
              {...commonProps}
              className={cn(
                commonProps.className,
                'flex-1 text-zinc-300',
                block.props?.checked && 'line-through text-zinc-500'
              )}
            >
              {block.content}
            </div>
          </div>
        );
      
      case 'code':
        return (
          <div className="relative my-4">
            <div className="absolute top-2 right-2 text-xs text-zinc-500 font-mono">
              {block.props?.language || 'plaintext'}
            </div>
            <pre className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
              <code
                {...commonProps}
                className={cn(commonProps.className, 'font-mono text-sm text-zinc-300 block')}
              >
                {block.content}
              </code>
            </pre>
          </div>
        );
      
      case 'quote':
        return (
          <blockquote className="border-l-4 border-zinc-600 pl-4 py-1 my-3 italic text-zinc-400">
            <div {...commonProps}>{block.content}</div>
          </blockquote>
        );
      
      case 'callout':
        return (
          <div className={cn(
            'flex gap-3 p-4 rounded-lg my-3',
            block.props?.variant === 'warning' && 'bg-yellow-500/10 border border-yellow-500/20',
            block.props?.variant === 'danger' && 'bg-red-500/10 border border-red-500/20',
            block.props?.variant === 'success' && 'bg-green-500/10 border border-green-500/20',
            !block.props?.variant && 'bg-blue-500/10 border border-blue-500/20'
          )}>
            <span className="text-xl">
              {block.props?.icon || '💡'}
            </span>
            <div {...commonProps} className={cn(commonProps.className, 'flex-1')}>
              {block.content}
            </div>
          </div>
        );
      
      case 'divider':
        return <hr className="border-zinc-700 my-6" />;
      
      case 'paragraph':
      default:
        return (
          <p {...commonProps} className={cn(commonProps.className, 'text-zinc-300 mb-1 leading-relaxed')}>
            {block.content}
          </p>
        );
    }
  };

  if (block.type === 'divider') {
    return renderBlockContent();
  }

  return (
    <div
      className={cn(
        'relative group flex items-start gap-1 py-0.5 -mx-8 px-8 transition-colors',
        isDragging && 'opacity-50 bg-zinc-800/30',
        (isActive || isHovered) && 'bg-zinc-800/20'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle & Add Button */}
      <div className={cn(
        'flex items-center gap-1 opacity-0 transition-opacity',
        (isActive || isHovered) && 'opacity-100'
      )}>
        <button
          className="p-1 text-zinc-600 hover:text-zinc-400 cursor-grab"
          title="Drag to move"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={onAddBelow}
          className="p-1 text-zinc-600 hover:text-zinc-400"
          title="Add block below"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Block Content */}
      <div className="flex-1 min-w-0">
        {renderBlockContent()}
      </div>

      {/* Block Actions Menu */}
      <div className={cn(
        'opacity-0 transition-opacity',
        (isActive || isHovered) && 'opacity-100'
      )}>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-600 hover:text-zinc-400"
          >
            <TextT size={16} />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)} 
              />
              <div className="absolute right-0 top-full mt-1 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 min-w-[160px]">
                <button onClick={() => { onMoveUp(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                  <ArrowUp size={14} /> Move Up
                </button>
                <button onClick={() => { onMoveDown(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                  <ArrowDown size={14} /> Move Down
                </button>
                <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                  <Copy size={14} /> Duplicate
                </button>
                <div className="my-1 border-t border-zinc-800" />
                <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function getPlaceholder(type: BlockType): string {
  switch (type) {
    case 'heading-1': return 'Heading 1';
    case 'heading-2': return 'Heading 2';
    case 'heading-3': return 'Heading 3';
    case 'bullet-list': return 'List item';
    case 'numbered-list': return 'List item';
    case 'todo': return 'To-do';
    case 'code': return "// Code here...";
    case 'quote': return 'Quote';
    case 'callout': return 'Callout content';
    default: return "Type '/' for commands...";
  }
}

export default BlockRenderer;
