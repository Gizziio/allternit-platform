/**
 * Icon Explorer Dev Tool
 * 
 * A development tool for browsing, searching, and previewing icons.
 * 
 * Usage:
 * ```tsx
 * import { IconExplorer } from '@allternit/platform/dev/icon-explorer';
 * 
 * // In your dev page:
 * <IconExplorer />
 * ```
 * 
 * @module @allternit/platform/dev/icon-explorer
 */

'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MagnifyingGlass as Search, Copy, Check, Sun, Moon, SquaresFour as Grid, List } from '@phosphor-icons/react';

import { Icon } from '../design/icons/Icon';
import { 
  ALL_ICON_NAMES, 
  ICON_CATEGORIES, 
  type IconName, 
  type IconCategory,
  type IconSize,
} from '../design/icons/types';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'grid' | 'list';
type ColorScheme = 'light' | 'dark';

interface IconItemProps {
  name: IconName;
  category: IconCategory;
  size: IconSize;
  viewMode: ViewMode;
  colorScheme: ColorScheme;
  onCopy: (name: IconName) => void;
  copied: boolean;
}

// ============================================================================
// Icon Item Component
// ============================================================================

function IconItem({ 
  name, 
  category, 
  size, 
  viewMode, 
  colorScheme,
  onCopy,
  copied,
}: IconItemProps) {
  const handleClick = () => onCopy(name);
  
  if (viewMode === 'list') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-4 px-4 py-3 rounded-lg',
          'transition-all duration-200',
          'hover:bg-[var(--color-surface-hover)]',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[var(--color-primary)]',
          'w-full text-left',
          colorScheme === 'dark' ? 'text-white' : 'text-gray-900'
        )}
      >
        <div className="flex-shrink-0">
          <Icon name={name} size={size} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className={cn(
            'text-sm',
            colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {category}
          </p>
        </div>
        <div className="flex-shrink-0">
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className={cn(
              'w-4 h-4',
              colorScheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )} />
          )}
        </div>
      </button>
    );
  }
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-xl',
        'transition-all duration-200',
        'hover:bg-[var(--color-surface-hover)]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--color-primary)]',
        'group relative'
      )}
    >
      <div className={cn(
        'p-4 rounded-lg',
        'bg-[var(--color-surface)]',
        'group-hover:bg-[var(--color-surface-active)]',
        'transition-colors'
      )}>
        <Icon name={name} size={size} />
      </div>
      <div className="text-center">
        <p className={cn(
          'text-sm font-medium truncate max-w-[100px]',
          colorScheme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {name}
        </p>
      </div>
      {copied && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-green-500" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Main Icon Explorer Component
// ============================================================================

interface IconExplorerProps {
  /** Initial search query */
  defaultSearch?: string;
  /** Initial selected category */
  defaultCategory?: IconCategory | 'all';
  /** Initial icon size */
  defaultSize?: IconSize;
  /** Initial view mode */
  defaultViewMode?: ViewMode;
  /** Initial color scheme */
  defaultColorScheme?: ColorScheme;
  /** Additional className */
  className?: string;
}

/**
 * Icon Explorer - Development tool for browsing icons
 * 
 * @example
 * ```tsx
 * // Default usage
 * <IconExplorer />
 * 
 * // With initial settings
 * <IconExplorer 
 *   defaultCategory="navigation"
 *   defaultSize="lg"
 *   defaultViewMode="grid"
 * />
 * ```
 */
export function IconExplorer({
  defaultSearch = '',
  defaultCategory = 'all',
  defaultSize = 'md',
  defaultViewMode = 'grid',
  defaultColorScheme = 'light',
  className,
}: IconExplorerProps = {}) {
  // State
  const [search, setSearch] = React.useState(defaultSearch);
  const [selectedCategory, setSelectedCategory] = React.useState<IconCategory | 'all'>(defaultCategory);
  const [size, setSize] = React.useState<IconSize>(defaultSize);
  const [viewMode, setViewMode] = React.useState<ViewMode>(defaultViewMode);
  const [colorScheme, setColorScheme] = React.useState<ColorScheme>(defaultColorScheme);
  const [copiedName, setCopiedName] = React.useState<IconName | null>(null);
  
  // Copy to clipboard
  const handleCopy = React.useCallback((name: IconName) => {
    const code = `<Icon name="${name}" size="${size}" />`;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 1500);
    });
  }, [size]);
  
  // Filter icons
  const filteredIcons = React.useMemo(() => {
    let icons: { name: IconName; category: IconCategory }[] = [];
    
    if (selectedCategory === 'all') {
      icons = Object.entries(ICON_CATEGORIES).flatMap(([cat, names]) => 
        names.map(name => ({ name, category: cat as IconCategory }))
      );
    } else {
      icons = ICON_CATEGORIES[selectedCategory].map(name => ({
        name,
        category: selectedCategory,
      }));
    }
    
    if (search.trim()) {
      const query = search.toLowerCase();
      icons = icons.filter(({ name }) => 
        name.toLowerCase().includes(query)
      );
    }
    
    return icons;
  }, [search, selectedCategory]);
  
  // Categories for tabs
  const categories: (IconCategory | 'all')[] = ['all', ...Object.keys(ICON_CATEGORIES) as IconCategory[]];
  
  // Size options
  const sizeOptions: { value: IconSize; label: string }[] = [
    { value: 'xs', label: 'XS (12px)' },
    { value: 'sm', label: 'SM (16px)' },
    { value: 'md', label: 'MD (20px)' },
    { value: 'lg', label: 'LG (24px)' },
    { value: 'xl', label: 'XL (32px)' },
  ];
  
  return (
    <div 
      className={cn(
        'w-full max-w-7xl mx-auto p-6 rounded-2xl',
        colorScheme === 'dark' ? 'bg-gray-900' : 'bg-white',
        'shadow-lg',
        className
      )}
      data-theme={colorScheme}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={cn(
            'text-2xl font-bold',
            colorScheme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Icon Explorer
          </h1>
          <p className={cn(
            'text-sm mt-1',
            colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {filteredIcons.length} icons available
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Color scheme toggle */}
          <button
            onClick={() => setColorScheme(prev => prev === 'light' ? 'dark' : 'light')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              colorScheme === 'dark' 
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
            aria-label="Toggle theme"
          >
            {colorScheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {/* View mode toggle */}
          <div className={cn(
            'flex rounded-lg p-1',
            colorScheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          )}>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid' 
                  ? 'bg-[var(--color-primary)] text-white' 
                  : colorScheme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              )}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'list' 
                  ? 'bg-[var(--color-primary)] text-white' 
                  : colorScheme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              )}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
            colorScheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )} />
          <input
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2.5 rounded-lg',
              'border-2 border-transparent',
              'focus:outline-none focus:border-[var(--color-primary)]',
              'transition-colors',
              colorScheme === 'dark' 
                ? 'bg-gray-800 text-white placeholder:text-gray-500' 
                : 'bg-gray-100 text-gray-900 placeholder:text-gray-400'
            )}
          />
        </div>
        
        {/* Size selector */}
        <select
          value={typeof size === 'number' ? 'custom' : size}
          onChange={(e) => setSize(e.target.value as IconSize)}
          className={cn(
            'px-4 py-2.5 rounded-lg',
            'border-2 border-transparent',
            'focus:outline-none focus:border-[var(--color-primary)]',
            'cursor-pointer',
            colorScheme === 'dark' 
              ? 'bg-gray-800 text-white' 
              : 'bg-gray-100 text-gray-900'
          )}
        >
          {sizeOptions.map(({ value, label }) => (
            <option key={String(value)} value={String(value)}>
              {label}
            </option>
          ))}
        </select>
      </div>
      
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium',
              'transition-colors capitalize',
              selectedCategory === category
                ? 'bg-[var(--color-primary)] text-white'
                : colorScheme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {category}
            {category !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                {ICON_CATEGORIES[category as IconCategory].length}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Icons Grid/List */}
      {filteredIcons.length > 0 ? (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'
            : 'flex flex-col gap-1'
        )}>
          {filteredIcons.map(({ name, category }) => (
            <IconItem
              key={name}
              name={name}
              category={category}
              size={size}
              viewMode={viewMode}
              colorScheme={colorScheme}
              onCopy={handleCopy}
              copied={copiedName === name}
            />
          ))}
        </div>
      ) : (
        <div className={cn(
          'text-center py-16',
          colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        )}>
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No icons found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}
      
      {/* Footer */}
      <div className={cn(
        'mt-8 pt-6 border-t text-center text-sm',
        colorScheme === 'dark' 
          ? 'border-gray-800 text-gray-500' 
          : 'border-gray-200 text-gray-400'
      )}>
        Click any icon to copy its usage code
      </div>
    </div>
  );
}

// ============================================================================
// Standalone Page Export
// ============================================================================

/**
 * Standalone Icon Explorer page component
 * Can be mounted at /dev/icons or similar route
 * 
 * @example
 * ```tsx
 * // app/dev/icons/page.tsx
 * import { IconExplorerPage } from '@allternit/platform/dev/icon-explorer';
 * 
 * export default function IconsPage() {
 *   return <IconExplorerPage />;
 * }
 * ```
 */
export function IconExplorerPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] p-8">
      <IconExplorer defaultViewMode="grid" defaultSize="lg" />
    </div>
  );
}

// ============================================================================
// Export all types
// ============================================================================

export type { IconExplorerProps, ViewMode, ColorScheme };
