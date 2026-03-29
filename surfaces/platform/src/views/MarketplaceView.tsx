import React, { useState, useMemo } from 'react';
import GlassSurface from '@/design/GlassSurface';
import {
  Storefront,
  MagnifyingGlass,
  Check,
  Star,
  Package,
  PlugsConnected,
  Code,
  Lightning,
} from '@phosphor-icons/react';

type Category = 'all' | 'models' | 'tools' | 'integrations' | 'plugins';

interface MarketplaceItem {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  publisher: string;
  description: string;
  version: string;
  rating: number;
  installed: boolean;
  icon?: React.ReactNode;
  color: string;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'gpt4o',
    name: 'GPT-4o',
    category: 'models',
    publisher: 'OpenAI',
    description: 'Advanced reasoning and multimodal capabilities for complex tasks',
    version: '1.0',
    rating: 4.9,
    installed: true,
    color: '#10a37f',
  },
  {
    id: 'claude35',
    name: 'Claude 3.5',
    category: 'models',
    publisher: 'Anthropic',
    description: 'Intelligent assistant with exceptional performance on complex reasoning',
    version: '3.5.1',
    rating: 4.8,
    installed: false,
    color: '#9b59b6',
  },
  {
    id: 'mistral7b',
    name: 'Mistral 7B',
    category: 'models',
    publisher: 'Mistral AI',
    description: 'Lightweight open-source model with excellent performance-to-size ratio',
    version: '0.2.0',
    rating: 4.6,
    installed: false,
    color: '#f39c12',
  },
  {
    id: 'gemini-flash',
    name: 'Gemini Flash',
    category: 'models',
    publisher: 'Google',
    description: 'Fast and efficient multimodal model for real-time applications',
    version: '2.1',
    rating: 4.7,
    installed: false,
    color: '#4285f4',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    category: 'tools',
    publisher: 'A2R',
    description: 'Real-time web search integration for current information retrieval',
    version: '2.3.0',
    rating: 4.5,
    installed: true,
    icon: <MagnifyingGlass size={24} />,
    color: '#3b82f6',
  },
  {
    id: 'code-executor',
    name: 'Code Executor',
    category: 'tools',
    publisher: 'A2R',
    description: 'Execute Python, JavaScript, and more with sandboxed environments',
    version: '1.8.1',
    rating: 4.7,
    installed: false,
    icon: <Code size={24} />,
    color: '#ef4444',
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    category: 'tools',
    publisher: 'A2R',
    description: 'Advanced file operations and document management capabilities',
    version: '3.1.0',
    rating: 4.4,
    installed: false,
    icon: <Package size={24} />,
    color: '#8b5cf6',
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'integrations',
    publisher: 'GitHub',
    description: 'Connect repositories, manage issues, and automate workflows',
    version: '2.0.1',
    rating: 4.9,
    installed: true,
    color: '#24292e',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'integrations',
    publisher: 'Slack Technologies',
    description: 'Send messages and manage Slack channels directly from A2R',
    version: '1.5.2',
    rating: 4.6,
    installed: false,
    color: '#36c5f0',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'integrations',
    publisher: 'Notion',
    description: 'Sync with Notion databases and create pages automatically',
    version: '1.2.0',
    rating: 4.3,
    installed: false,
    color: '#ffffff',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'integrations',
    publisher: 'Linear',
    description: 'Create and manage issues, track work directly in Linear',
    version: '1.1.3',
    rating: 4.5,
    installed: false,
    color: '#5e4c8f',
  },
  {
    id: 'a2r-vision',
    name: 'A2R Vision',
    category: 'plugins',
    publisher: 'A2R',
    description: 'Advanced image analysis and visual understanding capabilities',
    version: '1.0.0',
    rating: 4.8,
    installed: false,
    icon: <Lightning size={24} />,
    color: '#d4b08c',
  },
];

const CATEGORY_COUNTS = {
  all: 12,
  models: 4,
  tools: 3,
  integrations: 4,
  plugins: 1,
};

export const MarketplaceView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    let items = MARKETPLACE_ITEMS;

    // Filter by category
    if (activeCategory !== 'all') {
      items = items.filter((item) => item.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.publisher.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    return items;
  }, [activeCategory, searchQuery]);

  const getInitialLetter = (name: string) => name.charAt(0).toUpperCase();

  const renderIcon = (item: MarketplaceItem) => {
    if (item.icon) {
      return (
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '8px',
            backgroundColor: item.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          {item.icon}
        </div>
      );
    }

    return (
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '8px',
          backgroundColor: item.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: 'bold',
        }}
      >
        {getInitialLetter(item.name)}
      </div>
    );
  };

  const renderRating = (rating: number) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {rating.toFixed(1)} {<Star size={14} style={{ fill: '#fbbf24', color: '#fbbf24' }} />}
        </span>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Storefront size={28} style={{ color: '#d4b08c' }} />
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Marketplace
          </h1>
        </div>
        <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '14px' }}>
          Extensions, models & integrations
        </p>
      </div>

      {/* Main Content */}
      <div style={{ padding: '24px' }}>
        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '12px',
          }}
        >
          {(['all', 'models', 'tools', 'integrations', 'plugins'] as const).map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setSearchQuery('');
              }}
              style={{
                padding: '8px 0',
                border: 'none',
                backgroundColor: 'transparent',
                color:
                  activeCategory === category ? '#d4b08c' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: activeCategory === category ? '600' : '400',
                cursor: 'pointer',
                borderBottom:
                  activeCategory === category ? '2px solid #d4b08c' : 'transparent',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}{' '}
              <span style={{ fontSize: '12px', opacity: 0.6 }}>
                ({CATEGORY_COUNTS[category]})
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search extensions, models, and integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#d4b08c';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            />
          </div>
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--text-secondary)',
            }}
          >
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No items found</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>
              Try adjusting your search or category filters
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredItems.map((item) => (
              <GlassSurface key={item.id}>
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    height: '100%',
                  }}
                >
                  {/* Icon and Header */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {renderIcon(item)}
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: '2px',
                        }}
                      >
                        {item.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {item.publisher}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {item.description}
                  </p>

                  {/* Version Badge */}
                  <div
                    style={{
                      display: 'inline-block',
                      paddingLeft: '6px',
                      paddingRight: '6px',
                      paddingTop: '2px',
                      paddingBottom: '2px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      width: 'fit-content',
                      padding: '4px 8px',
                    }}
                  >
                    v{item.version}
                  </div>

                  {/* Rating */}
                  <div style={{ marginTop: 'auto' }}>
                    {renderRating(item.rating)}
                  </div>

                  {/* Footer Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {item.installed ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#10a37f',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '500',
                          flex: 1,
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={14} />
                        Installed
                      </div>
                    ) : (
                      <button
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: '#d4b08c',
                          color: '#1a1612',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              </GlassSurface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceView;
