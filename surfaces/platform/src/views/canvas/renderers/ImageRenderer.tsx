/**
 * ImageRenderer.tsx
 * 
 * Renders image artifacts with gallery view and lightbox.
 * Supports draw-to-edit integration.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Share2, 
  Edit, 
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  MoreHorizontal,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';
import { cn } from '@/lib/utils';

interface ImageRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

interface ImageAsset {
  id: string;
  url: string;
  title: string;
  width?: number;
  height?: number;
  size?: number;
  createdAt?: number;
}

export function ImageRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: ImageRendererProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Parse images from artifact
  const images = useMemo<ImageAsset[]>(() => {
    // Mock images for demo
    const mockImages: ImageAsset[] = [
      {
        id: 'img-1',
        url: 'https://picsum.photos/800/600',
        title: 'Generated Image 1',
        width: 800,
        height: 600,
      },
      {
        id: 'img-2',
        url: 'https://picsum.photos/600/800',
        title: 'Generated Image 2',
        width: 600,
        height: 800,
      },
      {
        id: 'img-3',
        url: 'https://picsum.photos/800/800',
        title: 'Generated Image 3',
        width: 800,
        height: 800,
      },
    ];

    if (!artifact.content && artifact.type === 'artifact' && artifact.kind === 'image') {
      // Single image from artifact
      return [{
        id: artifact.artifactId,
        url: artifact.url || '',
        title: artifact.title,
      }];
    }

    return mockImages;
  }, [artifact]);

  // Lightbox navigation
  const goToPreviousImage = () => {
    setSelectedImageIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextImage = () => {
    setSelectedImageIndex(prev => Math.min(images.length - 1, prev + 1));
  };

  // Handle draw-to-edit
  const handleDrawToEdit = (image: ImageAsset) => {
    console.log('[ImageRenderer] Opening draw-to-edit for:', image);
    // In production, this would open the DrawToEditCanvas modal
    // For now, just log
  };

  // Grid view
  const renderGridView = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {images.map((image, index) => (
        <motion.div
          key={image.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          className="group relative aspect-square rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-hidden cursor-pointer"
          onClick={() => {
            setSelectedImageIndex(index);
            setLightboxOpen(true);
          }}
        >
          {/* Image */}
          <img
            src={image.url}
            alt={image.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
                setSelectedImageIndex(index);
              }}
              className="h-9 w-9 p-0 text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDrawToEdit(image);
              }}
              className="h-9 w-9 p-0 text-white"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Download logic
              }}
              className="h-9 w-9 p-0 text-white"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-xs text-white truncate">{image.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );

  // List view
  const renderListView = () => (
    <div className="divide-y divide-[var(--border-subtle)]">
      {images.map((image, index) => (
        <div
          key={image.id}
          className="flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
          onClick={() => {
            setSelectedImageIndex(index);
            setLightboxOpen(true);
          }}
        >
          {/* Thumbnail */}
          <div className="w-20 h-20 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-hidden flex-shrink-0">
            <img
              src={image.url}
              alt={image.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {image.title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)]">
              {image.width && image.height && (
                <span>{image.width} × {image.height}</span>
              )}
              {image.size && (
                <span>{(image.size / 1024 / 1024).toFixed(2)} MB</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDrawToEdit(image)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <Image className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {artifact.title}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {images.length} images
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn(
              "h-7 w-7 p-0",
              viewMode === 'grid' && "text-[var(--accent-primary)]"
            )}
          >
            <Grid3x3 className="w-4 h-4" />
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
            <List className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Palette className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'grid' ? renderGridView() : renderListView()}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Image */}
            <div
              className="relative max-w-7xl max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s',
              }}
            >
              <img
                src={images[selectedImageIndex]?.url}
                alt={images[selectedImageIndex]?.title}
                className="max-w-full max-h-[90vh] object-contain"
              />
            </div>

            {/* Lightbox controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-black/80 backdrop-blur">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousImage}
                disabled={selectedImageIndex === 0}
                className="text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <span className="text-white text-sm font-medium min-w-[100px] text-center">
                {selectedImageIndex + 1} / {images.length}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextImage}
                disabled={selectedImageIndex === images.length - 1}
                className="text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>

              <div className="w-px h-4 bg-white/30" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>

              <span className="text-white text-xs min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>

              <div className="w-px h-4 bg-white/30" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDrawToEdit(images[selectedImageIndex])}
                className="text-white hover:bg-white/20"
              >
                <Edit className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLightboxOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <Maximize2 className="w-6 h-6 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
