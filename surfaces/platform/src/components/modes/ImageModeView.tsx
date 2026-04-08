"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Download, RefreshCw, Wand2, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  generateImages, 
  generateVariations,
  getImageProviders,
  type ImageGenerationResult,
  type GeneratedImage 
} from '@/lib/agents/modes/image-generation';

interface ImageModeViewProps {
  initialPrompt?: string;
}

export function ImageModeView({ initialPrompt = '' }: ImageModeViewProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ImageGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('pollinations');
  const [showSettings, setShowSettings] = useState(false);

  // Get provider info
  const providers = getImageProviders();
  const activeProvider = providers.find(p => p.id === selectedProvider);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateImages(
        prompt,
        {
          provider: selectedProvider as any,
          n: 4, // Generate 4 images by default
          size: '1024x1024',
        },
        {
          preferredProvider: selectedProvider as any,
          // TODO: Load from user settings
          apiKeys: {},
        }
      );
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariation = async (image: GeneratedImage) => {
    setIsGenerating(true);
    try {
      const variations = await generateVariations(
        image.id,
        image.prompt,
        4,
        { preferredProvider: selectedProvider as any }
      );
      setResult(variations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variations');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Image className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Image Generation</h3>
            <p className="text-xs text-white/50">
              {activeProvider?.type === 'free' ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Free with {activeProvider.name}
                </span>
              ) : (
                `Using ${activeProvider?.name}`
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Provider settings"
        >
          <Settings className="w-4 h-4 text-white/50" />
        </button>
      </div>

      {/* Provider Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <p className="text-xs text-white/50">Select image provider:</p>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    disabled={!provider.isAvailable}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all",
                      selectedProvider === provider.id
                        ? "bg-violet-500/20 border-violet-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10",
                      !provider.isAvailable && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-sm font-medium text-white">{provider.name}</span>
                    <span className="text-xs text-white/40">{provider.description}</span>
                    {provider.type === 'free' && (
                      <span className="text-xs text-emerald-400">✓ Free</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Input */}
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className="w-full h-24 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-violet-500/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                handleGenerate();
              }
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={cn(
              "absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              isGenerating || !prompt.trim()
                ? "bg-white/10 text-white/50 cursor-not-allowed"
                : "bg-violet-500 hover:bg-violet-600 text-white"
            )}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/30">
          Press Cmd+Enter to generate
        </p>
      </div>

      {/* Results Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4"
          >
            {error}
            {error.includes('API key') && (
              <button
                onClick={() => setShowSettings(true)}
                className="ml-2 underline hover:text-red-300"
              >
                Open settings
              </button>
            )}
          </motion.div>
        )}

        {!result && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-white/30">
            <Image className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">Enter a prompt to generate images</p>
            <p className="text-xs mt-2 text-white/20">
              Powered by {activeProvider?.name}
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-white/50">Creating your images...</p>
            <p className="text-xs text-white/30 mt-2">Using {activeProvider?.name}</p>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {result.images.map((image, index) => (
                <GeneratedImageCard
                  key={image.id}
                  image={image}
                  index={index}
                  onVariation={() => handleVariation(image)}
                  onDownload={() => handleDownload(image.url, `generated-${image.id}.png`)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratedImageCard({
  image,
  index,
  onVariation,
  onDownload,
}: {
  image: GeneratedImage;
  index: number;
  onVariation: () => void;
  onDownload: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/10"
    >
      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30">
          <div className="text-center">
            <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Failed to load</p>
          </div>
        </div>
      )}

      {/* Image */}
      <img
        src={image.url}
        alt={image.prompt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-xs text-white/70 line-clamp-1 mb-2">
            {image.metadata.provider === 'pollinations' ? 'Free' : image.metadata.model}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onVariation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Variations
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Free badge */}
      {image.metadata.provider === 'pollinations' && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500/80 rounded text-xs text-white font-medium">
          Free
        </div>
      )}
    </motion.div>
  );
}

export default ImageModeView;
