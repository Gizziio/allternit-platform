'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Package, 
  AlertCircle, 
  Download, 
  Check, 
  HardDrive, 
  Wifi, 
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { 
  getBundledPlugins,
  getDownloadablePlugins,
  getBundledBySource,
  searchPlugins,
  EXTERNAL_MARKETPLACE_SOURCES,
  MARKETPLACE_STATS,
  type UnifiedMarketplacePlugin
} from '@/lib/plugins/marketplace-integration';
import { TeamSkillsPanel } from './TeamSkillsPanel';
import { CATEGORY_METADATA } from '@/lib/plugins/marketplace';
import { openInBrowser } from '@/lib/openInBrowser';

// =============================================================================
// PLUGIN CARD COMPONENT
// =============================================================================

interface PluginCardProps {
  plugin: UnifiedMarketplacePlugin;
  installed?: boolean;
  enabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onToggle?: () => void;
}

function PluginCard({ plugin, installed, enabled, onInstall, onUninstall, onToggle }: PluginCardProps) {
  const categoryMeta = CATEGORY_METADATA[plugin.category];
  const isBundled = plugin.sourceType === 'bundled';
  const isDownloadable = plugin.sourceType === 'downloadable';
  
  // Determine shade for color (default to 0 if not specified)
  const shade = 'shade' in plugin ? plugin.shade ?? 0 : 0;
  const bgClass = categoryMeta.color.bg[Math.min(shade, 3)];
  const textClass = categoryMeta.color.text[Math.min(shade, 3)];
  const borderClass = categoryMeta.color.border[Math.min(shade, 3)];
  const dotClass = categoryMeta.color.dot[Math.min(shade, 3)];

  return (
    <Card className="flex flex-col h-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-100 truncate flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", dotClass)} />
              {plugin.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-zinc-500">by {plugin.author.name}</p>
              {plugin.author.verified && (
                <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-[10px] py-0 h-4">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
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
          {/* Category badge */}
          <Badge 
            variant="secondary" 
            className={cn("text-xs border", bgClass, textClass, borderClass)}
          >
            {categoryMeta.label}
          </Badge>
          
          {/* Source badge */}
          {isBundled && (
            <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
              <HardDrive className="w-3 h-3 mr-1" />
              Bundled
            </Badge>
          )}
          {isDownloadable && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
              <Wifi className="w-3 h-3 mr-1" />
              Download
            </Badge>
          )}
          
          {/* Price badge */}
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
            {plugin.price.type === 'free' ? 'Free' : `$${plugin.price.amount}`}
          </Badge>
        </div>
        
        {/* Stats row */}
        <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
          {plugin.rating && plugin.rating.count > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-amber-500">★</span>
              {plugin.rating.average} ({plugin.rating.count})
            </span>
          )}
          {plugin.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.downloads.toLocaleString()}
            </span>
          )}
          {isBundled && (
            <span className="text-emerald-500/70">
              Ready to use
            </span>
          )}
          {isDownloadable && 'vendoredDate' in plugin && (
            <span className="text-amber-500/70">
              Available offline
            </span>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 gap-2">
        {isBundled ? (
          // Bundled plugins can be enabled/disabled
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "w-full",
              enabled 
                ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10" 
                : "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
            )}
            onClick={onToggle}
          >
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        ) : installed ? (
          // Installed downloadable plugins
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
            <Button 
              variant="outline" 
              size="sm"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 px-3"
              onClick={onUninstall}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </Button>
          </>
        ) : (
          // Downloadable plugins
          <Button 
            size="sm" 
            className={cn(
              "w-full",
              plugin.category === 'create' && "bg-violet-600 hover:bg-violet-700",
              plugin.category === 'analyze' && "bg-blue-600 hover:bg-blue-700",
              plugin.category === 'build' && "bg-emerald-600 hover:bg-emerald-700",
              plugin.category === 'automate' && "bg-amber-600 hover:bg-amber-700",
              plugin.category === 'cowork' && "bg-cyan-600 hover:bg-cyan-700",
              !['create', 'analyze', 'build', 'automate', 'cowork'].includes(plugin.category) && "bg-violet-600 hover:bg-violet-700"
            )}
            onClick={onInstall}
          >
            <Download className="w-4 h-4 mr-2" />
            Install
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

function SectionHeader({ 
  title, 
  subtitle, 
  icon: Icon, 
  color,
  count,
  expanded,
  onToggle 
}: { 
  title: string; 
  subtitle: string; 
  icon: React.ElementType;
  color: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div 
      className="flex items-center justify-between gap-3 mb-4 pb-2 border-b border-zinc-800 cursor-pointer group"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <Badge variant="secondary" className="text-xs bg-zinc-800 text-zinc-400">
              {count}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300">
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </Button>
    </div>
  );
}

function PluginGrid({ plugins }: { plugins: UnifiedMarketplacePlugin[] }) {
  const safePlugins = plugins || [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {safePlugins.map(plugin => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          onInstall={() => console.log('Install', plugin.id)}
          onUninstall={() => console.log('Uninstall', plugin.id)}
          onToggle={() => console.log('Toggle', plugin.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PluginMarketplace() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    builtin: true,
    vendor: true,
    downloadable: true,
    external: false,
    cowork: true,
  });

  // Get all plugins (with fallbacks for SSR safety)
  const bundledPlugins = useMemo(() => getBundledPlugins() || [], []);
  const builtInPlugins = useMemo(() => getBundledBySource('built-in') || [], []);
  const vendorPlugins = useMemo(() => getBundledBySource('vendor') || [], []);
  const downloadablePlugins = useMemo(() => getDownloadablePlugins() || [], []);

  // Filter by search
  const filteredBuiltIn = useMemo(() => 
    search ? searchPlugins(search).filter(p => p.sourceType === 'bundled' && p.bundledSource === 'built-in') : builtInPlugins,
    [search, builtInPlugins]
  );
  const filteredVendor = useMemo(() => 
    search ? searchPlugins(search).filter(p => p.sourceType === 'bundled' && p.bundledSource === 'vendor') : vendorPlugins,
    [search, vendorPlugins]
  );
  const filteredDownloadable = useMemo(() => 
    search ? searchPlugins(search).filter(p => p.sourceType === 'downloadable') : downloadablePlugins,
    [search, downloadablePlugins]
  );

  const allPlugins = useMemo(() => [...bundledPlugins, ...downloadablePlugins], [bundledPlugins, downloadablePlugins]);
  const filteredCowork = useMemo(() => 
    search ? searchPlugins(search).filter(p => p.category === 'cowork') : allPlugins.filter(p => p.category === 'cowork'),
    [search, allPlugins]
  );

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 via-blue-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-violet-900/20">
          <Package className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Plugin Marketplace</h1>
          <p className="text-zinc-500 flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            {MARKETPLACE_STATS.bundled.total} bundled • 
            <Wifi className="w-4 h-4 ml-1" />
            {MARKETPLACE_STATS.downloadable.vendored + MARKETPLACE_STATS.downloadable.external}+ available
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search all plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 h-11"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 h-11">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="bundled">Bundled</TabsTrigger>
            <TabsTrigger value="downloadable">Downloadable</TabsTrigger>
            <TabsTrigger value="cowork" className="relative">
              <span className="relative">
                Cowork
                <span className="absolute -top-2 -right-6 flex h-4 items-center justify-center rounded-full bg-cyan-600 px-1.5 text-[9px] font-medium text-white">
                  NEW
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="team" className="relative">
              <span className="relative">
                Team
                <span className="absolute -top-2 -right-6 flex h-4 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[9px] font-medium text-white">
                  NEW
                </span>
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
          Loading plugins...
        </div>
      ) : (
        <div className="space-y-8">
          {/* === BUNDLED PLUGINS SECTION === */}
          {(activeTab === 'all' || activeTab === 'bundled') && (
            <>
              {/* Built-in Plugins */}
              {(search === '' || filteredBuiltIn.length > 0) && (
                <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
                  <SectionHeader
                    title="Built-in Agent Modes"
                    subtitle="Core Allternit capabilities — always available offline"
                    icon={Package}
                    color="bg-gradient-to-br from-violet-600 to-violet-700"
                    count={filteredBuiltIn.length}
                    expanded={expandedSections.builtin}
                    onToggle={() => toggleSection('builtin')}
                  />
                  {expandedSections.builtin && <PluginGrid plugins={filteredBuiltIn} />}
                </section>
              )}

              {/* Vendor Plugins */}
              {(search === '' || filteredVendor.length > 0) && (
                <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
                  <SectionHeader
                    title="Claude Desktop Plugins"
                    subtitle="Professional workflows from Anthropic — available offline"
                    icon={Sparkles}
                    color="bg-gradient-to-br from-blue-600 to-blue-700"
                    count={filteredVendor.length}
                    expanded={expandedSections.vendor}
                    onToggle={() => toggleSection('vendor')}
                  />
                  {expandedSections.vendor && <PluginGrid plugins={filteredVendor} />}
                </section>
              )}
            </>
          )}

          {/* === DOWNLOADABLE PLUGINS SECTION === */}
          {(activeTab === 'all' || activeTab === 'downloadable') && (
            <>
              {/* Vendored Plugins (Available in repo) */}
              {(search === '' || filteredDownloadable.length > 0) && (
                <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
                  <SectionHeader
                    title="Available for Download"
                    subtitle="Ready-to-install plugins from verified sources"
                    icon={Download}
                    color="bg-gradient-to-br from-amber-600 to-amber-700"
                    count={filteredDownloadable.length}
                    expanded={expandedSections.downloadable}
                    onToggle={() => toggleSection('downloadable')}
                  />
                  {expandedSections.downloadable && <PluginGrid plugins={filteredDownloadable} />}
                </section>
              )}

              {/* External Sources */}
              <section className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800/30">
                <SectionHeader
                  title="External Marketplaces"
                  subtitle="Discover more plugins from official sources"
                  icon={ExternalLink}
                  color="bg-gradient-to-br from-emerald-600 to-emerald-700"
                  count={EXTERNAL_MARKETPLACE_SOURCES.length}
                  expanded={expandedSections.external}
                  onToggle={() => toggleSection('external')}
                />
                {expandedSections.external && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EXTERNAL_MARKETPLACE_SOURCES.map(source => (
                      <Card key={source.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-zinc-100">{source.name}</h3>
                              <p className="text-sm text-zinc-500 mt-1">
                                ~{source.estimatedPlugins} plugins available
                              </p>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "mt-2 text-xs",
                                  source.trust === 'official' 
                                    ? "border-blue-500/50 text-blue-400" 
                                    : "border-emerald-500/50 text-emerald-400"
                                )}
                              >
                                {source.trust === 'official' ? 'Official' : 'Verified'}
                              </Badge>
                            </div>
                            <ExternalLink className="w-5 h-5 text-zinc-600" />
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full border-zinc-700 text-zinc-400 hover:text-zinc-200"
                            onClick={() => openInBrowser(source.url.replace('/marketplace.json', ''))}
                          >
                            Browse Source
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* === COWORK PLUGINS SECTION === */}
          {activeTab === 'cowork' && (
            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <SectionHeader
                title="Cowork Plugins"
                subtitle="Team skills and agent collaboration tools"
                icon={Users}
                color="bg-gradient-to-br from-cyan-600 to-cyan-700"
                count={filteredCowork.length}
                expanded={expandedSections.cowork}
                onToggle={() => toggleSection('cowork')}
              />
              {expandedSections.cowork && <PluginGrid plugins={filteredCowork} />}
            </section>
          )}

          {/* === TEAM SKILLS SECTION === */}
          {activeTab === 'team' && (
            <TeamSkillsPanel />
          )}

          {/* Empty state */}
          {search && filteredBuiltIn.length === 0 && filteredVendor.length === 0 && filteredDownloadable.length === 0 && filteredCowork.length === 0 && (
            <div className="text-center py-20 text-zinc-500">
              <Search className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
              <p className="text-lg font-medium text-zinc-400">No plugins found</p>
              <p className="text-sm mt-1">Try a different search term</p>
              <Button 
                variant="outline" 
                className="mt-4 border-zinc-800"
                onClick={() => setSearch('')}
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PluginMarketplace;
