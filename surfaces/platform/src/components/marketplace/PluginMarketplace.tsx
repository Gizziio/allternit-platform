'use client';

import React, { useState, useEffect } from 'react';
import { 
  pluginMarketplace, 
  type MarketplacePlugin, 
  type InstalledPlugin,
  CATEGORY_METADATA,
  BUILTIN_MODES,
  COLOR_GRADES,
  formatAgentDisplayName,
  getModeColorClasses,
  type PluginCategory 
} from '@/lib/plugins/marketplace';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Star, Download, Check, Search, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PluginCardProps {
  plugin: MarketplacePlugin;
  installed: boolean;
  enabled?: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle?: () => void;
}

function PluginCard({ plugin, installed, enabled, onInstall, onUninstall, onToggle }: PluginCardProps) {
  const categoryMeta = CATEGORY_METADATA[plugin.category];
  
  // Get shade for color gradient (default to 0 if not specified)
  const shade = plugin.shade ?? 0;
  const bgClass = categoryMeta.color.bg[shade];
  const textClass = categoryMeta.color.text[shade];
  const borderClass = categoryMeta.color.border[shade];
  const dotClass = categoryMeta.color.dot[shade];
  
  // Format name as "Agent | Group-Mode" for built-in modes
  const displayName = plugin.isBuiltIn 
    ? formatAgentDisplayName(plugin.id)
    : plugin.name;
  
  const formatPrice = () => {
    switch (plugin.price?.type) {
      case 'free':
        return 'Free';
      case 'paid':
        return `$${plugin.price.amount}`;
      case 'subscription':
        return `$${plugin.price.amount}/mo`;
      default:
        return 'Free';
    }
  };

  return (
    <Card className="flex flex-col h-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-100 truncate flex items-center gap-2">
              {plugin.isBuiltIn && (
                <span className={cn("w-2 h-2 rounded-full", dotClass)} />
              )}
              {plugin.isBuiltIn ? displayName.split(' | ')[1] : plugin.name}
            </h3>
            <p className="text-xs text-zinc-500">
              {plugin.isBuiltIn ? 'Built-in' : `by ${plugin.author.name}`}
              {plugin.author.verified && !plugin.isBuiltIn && (
                <Badge variant="outline" className="ml-2 border-blue-500 text-blue-400 text-[10px] py-0">
                  Verified
                </Badge>
              )}
            </p>
          </div>
          {installed && (
            <Badge 
              variant="outline" 
              className={cn(
                "shrink-0",
                enabled 
                  ? "border-emerald-500 text-emerald-400" 
                  : "border-zinc-600 text-zinc-500"
              )}
            >
              <Check className="w-3 h-3 mr-1" /> 
              {enabled ? 'Active' : 'Installed'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-zinc-400 line-clamp-2">{plugin.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Category badge with gradient color */}
          <Badge 
            variant="secondary" 
            className={cn("text-xs border", bgClass, textClass, borderClass)}
          >
            {plugin.isBuiltIn 
              ? displayName.split(' | ')[0].replace('Agent | ', '')
              : categoryMeta.label
            }
          </Badge>
          {plugin.isBuiltIn && (
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
              Built-in
            </Badge>
          )}
          {plugin.permissions && plugin.permissions.length > 0 && (
            <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-500">
              <AlertCircle className="w-3 h-3 mr-1" />
              Permissions
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
          {plugin.rating ? (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              {plugin.rating.average} ({plugin.rating.count})
            </span>
          ) : !plugin.isBuiltIn && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-zinc-700" />
              No ratings
            </span>
          )}
          {!plugin.isBuiltIn && (
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.downloads.toLocaleString()}
            </span>
          )}
          <span className={cn(
            plugin.price?.type === 'free' ? 'text-emerald-400' : 'text-zinc-300'
          )}>
            {formatPrice()}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-0 gap-2">
        {installed ? (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "flex-1",
                enabled 
                  ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10" 
                  : "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
              )}
              onClick={onToggle}
            >
              {enabled ? 'Disable' : 'Enable'}
            </Button>
            {!plugin.isBuiltIn && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={onUninstall}
              >
                <TrashIcon />
              </Button>
            )}
          </>
        ) : (
          <Button 
            size="sm" 
            className={cn(
              "w-full",
              plugin.category === 'create' && "bg-violet-600 hover:bg-violet-700",
              plugin.category === 'analyze' && "bg-blue-600 hover:bg-blue-700",
              plugin.category === 'build' && "bg-emerald-600 hover:bg-emerald-700",
              plugin.category === 'automate' && "bg-amber-600 hover:bg-amber-700",
              !['create', 'analyze', 'build', 'automate'].includes(plugin.category) && "bg-violet-600 hover:bg-violet-700"
            )}
            onClick={onInstall}
          >
            Install
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// Group plugins by the 4 main categories
function groupByCategory(plugins: MarketplacePlugin[]): { 
  create: MarketplacePlugin[]; 
  analyze: MarketplacePlugin[]; 
  build: MarketplacePlugin[]; 
  automate: MarketplacePlugin[]; 
  other: MarketplacePlugin[]; 
} {
  const grouped = {
    create: [] as MarketplacePlugin[],
    analyze: [] as MarketplacePlugin[],
    build: [] as MarketplacePlugin[],
    automate: [] as MarketplacePlugin[],
    other: [] as MarketplacePlugin[],
  };
  
  for (const plugin of plugins) {
    if (plugin.category === 'create') {
      grouped.create.push(plugin);
    } else if (plugin.category === 'analyze') {
      grouped.analyze.push(plugin);
    } else if (plugin.category === 'build') {
      grouped.build.push(plugin);
    } else if (plugin.category === 'automate') {
      grouped.automate.push(plugin);
    } else {
      grouped.other.push(plugin);
    }
  }
  
  // Sort each group by shade (built-in modes first, then alphabetically)
  for (const key of Object.keys(grouped)) {
    grouped[key as keyof typeof grouped].sort((a, b) => {
      if (a.isBuiltIn && !b.isBuiltIn) return -1;
      if (!a.isBuiltIn && b.isBuiltIn) return 1;
      return (a.shade ?? 0) - (b.shade ?? 0);
    });
  }
  
  return grouped;
}

export function PluginMarketplace() {
  const [activeTab, setActiveTab] = useState('browse');
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [marketplacePlugins, installedPlugins] = await Promise.all([
        pluginMarketplace.browse({ sort: 'popular' }),
        Promise.resolve(pluginMarketplace.getInstalled()),
      ]);
      
      // Add built-in modes as "plugins" for display (in production, these come from API)
      const builtInPlugins: MarketplacePlugin[] = Object.entries(BUILTIN_MODES).map(([id, config]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: config.description,
        version: '1.0.0',
        author: { name: 'Allternit' },
        category: config.category,
        capabilities: [],
        license: 'Proprietary',
        price: { type: 'free' as const },
        downloads: 0,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: true,
        shade: config.shade,
      }));
      
      setPlugins([...builtInPlugins, ...marketplacePlugins]);
      setInstalled(installedPlugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await pluginMarketplace.browse({ search, sort: 'popular' });
      // Re-add built-ins on search
      const builtInPlugins: MarketplacePlugin[] = Object.entries(BUILTIN_MODES).map(([id, config]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: config.description,
        version: '1.0.0',
        author: { name: 'Allternit' },
        category: config.category,
        capabilities: [],
        license: 'Proprietary',
        price: { type: 'free' as const },
        downloads: 0,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: true,
        shade: config.shade,
      }));
      setPlugins([...builtInPlugins, ...results]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginId: string) => {
    try {
      await pluginMarketplace.install(pluginId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    }
  };

  const handleUninstall = async (pluginId: string) => {
    await pluginMarketplace.uninstall(pluginId);
    await loadData();
  };

  const handleToggle = async (pluginId: string) => {
    await pluginMarketplace.toggleEnabled(pluginId);
    await loadData();
  };

  const isInstalled = (pluginId: string) => {
    // Built-in modes are always "installed"
    if (BUILTIN_MODES[pluginId]) return true;
    return installed.some(p => p.id === pluginId);
  };
  
  const isEnabled = (pluginId: string) => {
    // Built-in modes are always "enabled"
    if (BUILTIN_MODES[pluginId]) return true;
    return installed.find(p => p.id === pluginId)?.enabled ?? false;
  };

  const groupedPlugins = groupByCategory(plugins);

  const renderPluginGrid = (pluginList: MarketplacePlugin[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pluginList.map(plugin => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          installed={isInstalled(plugin.id)}
          enabled={isEnabled(plugin.id)}
          onInstall={() => handleInstall(plugin.id)}
          onUninstall={() => handleUninstall(plugin.id)}
          onToggle={() => handleToggle(plugin.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Plugin Marketplace</h1>
          <p className="text-zinc-500">Extend Allternit with powerful plugins</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="installed">
            Installed ({installed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6 space-y-10">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search plugins..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-zinc-900 border-zinc-800"
              />
            </div>
            <Button onClick={handleSearch} variant="outline" className="border-zinc-800">
              Search
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-500">Loading plugins...</div>
          ) : (
            <>
              {/* Create Group (Violet gradient) */}
              {groupedPlugins.create.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <h2 className="text-lg font-semibold text-zinc-100">Create</h2>
                    </div>
                    <span className="text-sm text-zinc-500">Generate images, videos, slides, websites</span>
                  </div>
                  {renderPluginGrid(groupedPlugins.create)}
                </section>
              )}

              {/* Analyze Group (Blue gradient) */}
              {groupedPlugins.analyze.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <h2 className="text-lg font-semibold text-zinc-100">Analyze</h2>
                    </div>
                    <span className="text-sm text-zinc-500">Research and data analysis</span>
                  </div>
                  {renderPluginGrid(groupedPlugins.analyze)}
                </section>
              )}

              {/* Build Group (Emerald gradient) */}
              {groupedPlugins.build.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <h2 className="text-lg font-semibold text-zinc-100">Build</h2>
                    </div>
                    <span className="text-sm text-zinc-500">Code generation and assets</span>
                  </div>
                  {renderPluginGrid(groupedPlugins.build)}
                </section>
              )}

              {/* Automate Group (Amber gradient) */}
              {groupedPlugins.automate.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <h2 className="text-lg font-semibold text-zinc-100">Automate</h2>
                    </div>
                    <span className="text-sm text-zinc-500">Multi-agent swarms and workflows</span>
                  </div>
                  {renderPluginGrid(groupedPlugins.automate)}
                </section>
              )}

              {/* Other Categories */}
              {groupedPlugins.other.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-zinc-500" />
                      <h2 className="text-lg font-semibold text-zinc-100">Other</h2>
                    </div>
                    <span className="text-sm text-zinc-500">Productivity, integrations, custom</span>
                  </div>
                  {renderPluginGrid(groupedPlugins.other)}
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          {installed.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Package className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
              <p className="text-lg font-medium text-zinc-400">No plugins installed</p>
              <p className="text-sm mt-1">Browse the marketplace to find plugins</p>
              <Button 
                variant="outline" 
                className="mt-4 border-zinc-800"
                onClick={() => setActiveTab('browse')}
              >
                Browse Marketplace
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {installed.map(plugin => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  installed={true}
                  enabled={plugin.enabled}
                  onInstall={() => {}}
                  onUninstall={() => handleUninstall(plugin.id)}
                  onToggle={() => handleToggle(plugin.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
