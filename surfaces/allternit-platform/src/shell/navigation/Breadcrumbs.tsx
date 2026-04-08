/**
 * WIH: T2-A2
 * Agent: T2-A2 (Navigation System)
 * Scope: 6-ui/allternit-platform/src/shell/navigation/Breadcrumbs.tsx
 * Acceptance: Breadcrumbs with collapsible items, multiple separators, auto-generation from routes
 * Risk Tier: 2
 * Dependencies: Icon component (T1-A5), DropdownMenu component, cn utility
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { IconName } from './CommandPalette';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: IconName;
  onClick?: () => void;
  isCollapsed?: boolean;
}

type SeparatorType = 'slash' | 'chevron' | 'arrow';

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: SeparatorType;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
  className?: string;
}

// Simple icon component for breadcrumbs
function BreadcrumbIcon({ name }: { name: IconName }) {
  const iconPaths: Record<string, React.ReactNode> = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    agent: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></>,
    workflow: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    add: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    more: <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
  };

  return (
    <svg 
      className="w-4 h-4" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {iconPaths[name] || iconPaths.home}
    </svg>
  );
}

function BreadcrumbSeparator({ type }: { type: SeparatorType }) {
  const separatorIcons: Record<SeparatorType, React.ReactNode> = {
    slash: (
      <span className="text-[var(--text-tertiary)]">/</span>
    ),
    chevron: (
      <svg 
        className="w-4 h-4 text-[var(--text-tertiary)]" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    ),
    arrow: (
      <svg 
        className="w-4 h-4 text-[var(--text-tertiary)]" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  };

  return <span className="flex-shrink-0">{separatorIcons[type]}</span>;
}

export function Breadcrumbs({
  items,
  separator = 'chevron',
  maxItems = 5,
  itemsBeforeCollapse = 2,
  itemsAfterCollapse = 1,
  className,
}: BreadcrumbsProps) {
  const [collapsedOpen, setCollapsedOpen] = useState(false);

  // Determine if we need to collapse
  const shouldCollapse = items.length > maxItems;
  
  // Calculate display items
  const displayItems = shouldCollapse
    ? [
        ...items.slice(0, itemsBeforeCollapse),
        { 
          label: '...', 
          isCollapsed: true,
          // Store collapsed items for dropdown
          collapsedItems: items.slice(itemsBeforeCollapse, items.length - itemsAfterCollapse),
        } as BreadcrumbItem & { collapsedItems?: BreadcrumbItem[] },
        ...items.slice(items.length - itemsAfterCollapse),
      ]
    : items;

  return (
    <nav 
      className={cn(
        'flex items-center text-sm',
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2 flex-wrap">
        {displayItems.map((item, index) => (
          <li 
            key={index} 
            className="flex items-center gap-2"
          >
            {index > 0 && <BreadcrumbSeparator type={separator} />}
            <BreadcrumbItemComponent 
              item={item} 
              isLast={index === displayItems.length - 1}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem & { collapsedItems?: BreadcrumbItem[] };
  isLast?: boolean;
}

function BreadcrumbItemComponent({ item, isLast }: BreadcrumbItemComponentProps) {
  // Handle collapsed items (dropdown)
  if (item.isCollapsed && item.collapsedItems) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
              'hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            )}
          >
            <BreadcrumbIcon name="more" />
            <span>...</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {item.collapsedItems.map((collapsedItem, idx) => (
            <DropdownMenuItem
              key={idx}
              onClick={collapsedItem.onClick}
              className="flex items-center gap-2 cursor-pointer"
            >
              {collapsedItem.icon && <BreadcrumbIcon name={collapsedItem.icon} />}
              <span>{collapsedItem.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const content = (
    <>
      {item.icon && <BreadcrumbIcon name={item.icon} />}
      <span className={cn(
        'transition-colors',
        isLast 
          ? 'text-[var(--text-primary)] font-medium' 
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      )}>
        {item.label}
      </span>
    </>
  );

  // Clickable breadcrumb
  if (item.href || item.onClick) {
    const handleClick = () => {
      if (item.onClick) {
        item.onClick();
      } else if (item.href) {
        // Use window.location for simple navigation
        // In a real app, this would use the router's navigate function
        window.location.href = item.href;
      }
    };

    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1.5 cursor-pointer transition-colors',
          'hover:text-[var(--text-primary)]',
          !isLast && 'hover:bg-[var(--bg-hover)] px-2 py-1 rounded'
        )}
        disabled={isLast}
      >
        {content}
      </button>
    );
  }

  // Static breadcrumb
  return (
    <span className="flex items-center gap-1.5">
      {content}
    </span>
  );
}

// Hook to generate breadcrumbs from current route
export function useRouteBreadcrumbs(
  pathname: string,
  routes: Array<{ path: string; label: string; icon?: IconName }>
): BreadcrumbItem[] {
  // Find matching route
  const matchingRoute = routes.find((route) => 
    pathname === route.path || pathname.startsWith(route.path + '/')
  );

  if (!matchingRoute) {
    return [{ label: 'Home', icon: 'home', href: '/' }];
  }

  // Build breadcrumb trail
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', icon: 'home', href: '/' },
  ];

  // Add matching route
  breadcrumbs.push({
    label: matchingRoute.label,
    icon: matchingRoute.icon,
    href: matchingRoute.path,
  });

  // Handle nested paths
  const remainingPath = pathname.slice(matchingRoute.path.length);
  if (remainingPath && remainingPath !== '/') {
    const segments = remainingPath.split('/').filter(Boolean);
    let currentPath = matchingRoute.path;
    
    segments.forEach((segment) => {
      currentPath += `/${segment}`;
      breadcrumbs.push({
        label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        href: currentPath,
      });
    });
  }

  // Mark the last item
  if (breadcrumbs.length > 0) {
    const lastItem = breadcrumbs[breadcrumbs.length - 1];
    delete lastItem.href; // Last item is not clickable
  }

  return breadcrumbs;
}

// Auto-generating breadcrumbs component
export interface AutoBreadcrumbsProps extends Omit<BreadcrumbsProps, 'items'> {
  pathname: string;
  routes: Array<{ path: string; label: string; icon?: IconName }>;
}

export function AutoBreadcrumbs({
  pathname,
  routes,
  ...props
}: AutoBreadcrumbsProps) {
  const items = useRouteBreadcrumbs(pathname, routes);
  return <Breadcrumbs items={items} {...props} />;
}

export default Breadcrumbs;
