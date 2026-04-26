/**
 * Orca Slash Command Menu
 * 
 * Slash commands for inserting blocks (Notion-style)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SlashCommand, SLASH_COMMANDS, BlockType } from './types';
import { cn } from './cn';
import {
  TextT,
  TextH as HeadingH,
  List,
  ListNumbers,
  CheckSquare,
  Code,
  Quotes,
  Minus,
  Info,
  Table,
  Function,
} from '@phosphor-icons/react';

interface SlashCommandMenuProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const iconMap: Record<string, React.ElementType> = {
  'H1': HeadingH,
  'H2': HeadingH,
  'H3': HeadingH,
  'List': List,
  'ListNumbers': ListNumbers,
  'CheckSquare': CheckSquare,
  'Code': Code,
  'Quotes': Quotes,
  'Minus': Minus,
  'Info': Info,
  'Table': Table,
  'Function': Function,
  'TextT': TextT,
};

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  searchQuery,
  onSelect,
  onClose,
  position,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Basic Blocks
        </span>
      </div>
      
      <div className="max-h-80 overflow-y-auto py-1">
        {filteredCommands.map((command, index) => {
          const Icon = iconMap[command.icon] || TextT;
          return (
            <button
              key={command.id}
              ref={el => { itemRefs.current[index] = el; }}
              onClick={() => onSelect(command)}
              className={cn(
                'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                index === selectedIndex 
                  ? 'bg-zinc-800 text-zinc-100' 
                  : 'text-zinc-400 hover:bg-zinc-800/50'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded flex items-center justify-center',
                index === selectedIndex ? 'bg-zinc-700' : 'bg-zinc-800'
              )}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{command.label}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {command.description}
                </div>
              </div>
              {command.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-zinc-800 rounded text-zinc-500">
                  {command.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-600">
          {filteredCommands.length} commands • ↑↓ to navigate • Enter to select
        </span>
      </div>
    </div>
  );
};

export default SlashCommandMenu;
