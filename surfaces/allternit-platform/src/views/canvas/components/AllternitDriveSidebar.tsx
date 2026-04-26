/**
 * AllternitDriveSidebar.tsx
 * 
 * Asset manager sidebar for Allternit-Drive.
 * Shows generated/downloaded assets (images, documents, code, audio, video).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image,
  FileText,
  FileCode,
  Video,
  MusicNote,
  File,
  SquaresFour,
  List,
  DownloadSimple,
  Trash,
  Eye,
  PencilSimple,
  DotsThreeVertical,
  MagnifyingGlass,
  Funnel,
  Clock,
  FolderOpen,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type AssetType = 'all' | 'image' | 'document' | 'code' | 'audio' | 'video' | 'other';

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  thumbnailUrl?: string;
  size: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface AllternitDriveSidebarProps {
  sessionId?: string;
  onSelectArtifact: (artifactId: string) => void;
  onClose?: () => void;
}


export function AllternitDriveSidebar({
  sessionId,
  onSelectArtifact,
  onClose,
}: AllternitDriveSidebarProps) {
  // State
  const [activeFilter, setActiveFilter] = useState<AssetType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const url = sessionId ? `/api/v1/drive/assets?sessionId=${sessionId}` : '/api/v1/drive/assets';
    fetch(url).then(r => r.json()).then(setAssets).catch(() => {});
  }, [sessionId]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Type filter
      if (activeFilter !== 'all' && asset.type !== activeFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [assets, activeFilter, searchQuery]);

  // Get icon for asset type
  const getTypeIcon = (type: AssetType) => {
    switch (type) {
      case 'image': return Image;
      case 'document': return FileText;
      case 'code': return FileCode;
      case 'audio': return MusicNote;
      case 'video': return Video;
      default: return File;
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Allternit-Drive
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {filteredAssets.length} items
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn(
              "h-7 w-7 p-0",
              viewMode === 'grid' && "text-[var(--accent-primary)]"
            )}
          >
            <SquaresFour size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn(
              "h-7 w-7 p-0",
              viewMode === 'list' && "text-[var(--accent-primary)]"
            )}
          >
            <List size={16} />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-[var(--text-tertiary)]"
            >
              <Trash size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-3 border-b border-[var(--border-subtle)] space-y-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs bg-[var(--bg-primary)] border-[var(--border-subtle)]"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(['all', 'image', 'document', 'code', 'audio', 'video'] as AssetType[]).map(type => (
            <Button
              key={type}
              variant={activeFilter === type ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter(type)}
              className={cn(
                "h-6 px-2 text-xs whitespace-nowrap",
                activeFilter === type 
                  ? "bg-[var(--accent-primary)] text-[var(--bg-primary)]" 
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              )}
            >
              {type === 'all' && 'All'}
              {type === 'image' && 'Images'}
              {type === 'document' && 'Docs'}
              {type === 'code' && 'Code'}
              {type === 'audio' && 'Audio'}
              {type === 'video' && 'Video'}
            </Button>
          ))}
        </div>
      </div>

      {/* Assets */}
      <div className="flex-1 overflow-auto p-3">
        {filteredAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] text-xs text-center">
            <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
            <p>No assets yet</p>
            <p className="mt-1">Generated images, documents, and code will appear here</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => {
              const TypeIcon = getTypeIcon(asset.type);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  className="group relative aspect-square rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-hidden cursor-pointer"
                  onClick={() => onSelectArtifact(asset.id)}
                >
                  {/* Thumbnail or icon */}
                  {asset.type === 'image' && asset.thumbnailUrl ? (
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="w-8 h-8 text-[var(--text-tertiary)] opacity-50" />
                    </div>
                  )}
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white"
                    >
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white"
                    >
                      <DownloadSimple size={16} />
                    </Button>
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                    <TypeIcon size={12} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAssets.map(asset => {
              const TypeIcon = getTypeIcon(asset.type);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 2 }}
                  className="group flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                  onClick={() => onSelectArtifact(asset.id)}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                    {asset.type === 'image' && asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <TypeIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {asset.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <span>{formatSize(asset.size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTimeAgo(asset.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <Eye size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <DownloadSimple size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <DotsThreeVertical size={12} />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-10 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-xs text-[var(--text-tertiary)]">
        <span>Allternit-Drive</span>
        <span>{formatSize(assets.reduce((sum, a) => sum + a.size, 0))} used</span>
      </div>
    </div>
  );
}
