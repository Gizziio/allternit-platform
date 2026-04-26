"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, 
  Key, 
  ExternalLink, 
  RefreshCw, 
  Wand2, 
  Settings,
  AlertCircle,
  CheckCircle2,
  Play,
  Image as ImageIcon,
  Clock,
  MonitorPlay,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VideoModeViewProps {
  initialPrompt?: string;
}

interface VideoConfig {
  provider: 'minimax' | 'kling';
  model: string;
  duration: 6 | 10;
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16' | '1:1';
}

interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  thumbnailUrl: string;
  status: 'generating' | 'completed' | 'failed';
  progress: number;
  metadata: {
    provider: string;
    model: string;
    duration: number;
    resolution: string;
    createdAt: string;
  };
}

const VIDEO_PROVIDERS = {
  minimax: {
    name: 'MiniMax',
    description: 'Best for character animation & motion',
    website: 'https://hailuoai.video',
    signupUrl: 'https://hailuoai.video',
    apiDocs: 'https://www.minimaxi.com/en',
    models: [
      { id: 'T2V-01', name: 'Text-to-Video', duration: 6, cost: '$0.43' },
      { id: 'I2V-01', name: 'Image-to-Video', duration: 6, cost: '$0.43' },
      { id: 'T2V-01-Director', name: 'Text-to-Video (Director)', duration: 6, cost: '$0.43' },
    ],
    freeTier: '500 credits one-time',
  },
  kling: {
    name: 'Kling AI',
    description: 'Best for cinematic scenes & realism',
    website: 'https://klingai.com',
    signupUrl: 'https://klingai.com',
    apiDocs: 'https://klingai.com',
    models: [
      { id: 'kling-2.0', name: 'Kling 2.0', duration: 10, cost: '~$0.15' },
      { id: 'kling-1.6', name: 'Kling 1.6', duration: 10, cost: '~$0.10' },
    ],
    freeTier: '~66 credits/day (refreshes daily!)',
  },
};

export function VideoModeView({ initialPrompt = '' }: VideoModeViewProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [config, setConfig] = useState<VideoConfig>({
    provider: 'minimax',
    model: 'T2V-01',
    duration: 6,
    resolution: '720p',
    aspectRatio: '16:9',
  });
  
  // BYOK State
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('allternit_video_api_keys');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'library'>('generate');

  const hasApiKey = !!apiKeys[config.provider];
  const providerInfo = VIDEO_PROVIDERS[config.provider];

  const saveApiKey = () => {
    if (!tempKey.trim()) return;
    const newKeys = { ...apiKeys, [config.provider]: tempKey.trim() };
    setApiKeys(newKeys);
    localStorage.setItem('allternit_video_api_keys', JSON.stringify(newKeys));
    setShowKeyInput(false);
    setTempKey('');
  };

  const removeApiKey = () => {
    const newKeys = { ...apiKeys };
    delete newKeys[config.provider];
    setApiKeys(newKeys);
    localStorage.setItem('allternit_video_api_keys', JSON.stringify(newKeys));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !hasApiKey) return;
    
    setIsGenerating(true);
    setError(null);

    // Create placeholder video object
    const newVideo: GeneratedVideo = {
      id: `vid_${Date.now()}`,
      url: '',
      prompt: prompt.trim(),
      thumbnailUrl: '',
      status: 'generating',
      progress: 0,
      metadata: {
        provider: providerInfo.name,
        model: config.model,
        duration: config.duration,
        resolution: config.resolution,
        createdAt: new Date().toISOString(),
      },
    };

    setVideos(prev => [newVideo, ...prev]);

    // TODO: Implement actual API call
    // For now, simulate the process
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // Update with mock result
      setVideos(prev => prev.map(v => 
        v.id === newVideo.id 
          ? { 
              ...v, 
              status: 'completed',
              url: 'https://example.com/video.mp4', // TODO: Replace with actual API response
              thumbnailUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&nologo=true`,
            }
          : v
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setVideos(prev => prev.map(v => 
        v.id === newVideo.id ? { ...v, status: 'failed' } : v
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  // Truncate key for display
  const maskKey = (key: string) => {
    if (key.length < 8) return '••••••••';
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
            <Video className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Video Generation</h3>
            <p className="text-xs text-white/50 flex items-center gap-1">
              {hasApiKey ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">{providerInfo.name} connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400">API key required</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('generate')}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg transition-colors",
              activeTab === 'generate' 
                ? "bg-rose-500/20 text-rose-400" 
                : "text-white/50 hover:text-white"
            )}
          >
            Generate
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg transition-colors",
              activeTab === 'library' 
                ? "bg-rose-500/20 text-rose-400" 
                : "text-white/50 hover:text-white"
            )}
          >
            Library ({videos.length})
          </button>
        </div>
      </div>

      {/* BYOK Notice / Setup */}
      {!hasApiKey && activeTab === 'generate' && (
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-400">Bring Your Own API Key</h4>
              <p className="text-xs text-white/60 mt-1">
                Video generation requires a paid API key. We don&apos;t markup costs—you pay the provider directly.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs text-amber-400 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  Add API Key
                </button>
                <a
                  href={providerInfo.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  Get free credits on {providerInfo.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Input Panel */}
      <AnimatePresence>
        {showKeyInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Add {providerInfo.name} API Key</span>
                <button 
                  onClick={() => setShowKeyInput(false)}
                  className="text-xs text-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10 text-white text-sm"
                />
                <Button
                  onClick={saveApiKey}
                  disabled={!tempKey.trim()}
                  className="bg-rose-500 hover:bg-rose-600 text-white"
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-white/40">
                Your key is stored locally in your browser. Never shared with our servers.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected API Key Display */}
      {hasApiKey && activeTab === 'generate' && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">
              {providerInfo.name}: {maskKey(apiKeys[config.provider])}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-xs text-white/40 hover:text-white/60"
            >
              Change
            </button>
            <button
              onClick={removeApiKey}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {activeTab === 'generate' ? (
        <>
          {/* Configuration Panel */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Provider Select */}
              <div className="space-y-1">
                <label className="text-xs text-white/40">Provider</label>
                <Select 
                  value={config.provider} 
                  onValueChange={(v: string) => {
                    setConfig(prev => ({
                      ...prev,
                      provider: v as 'minimax' | 'kling',
                      model: (VIDEO_PROVIDERS as any)[v]?.models?.[0]?.id ?? prev.model,
                    }));
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {Object.entries(VIDEO_PROVIDERS).map(([key, info]) => (
                      <SelectItem 
                        key={key} 
                        value={key}
                        className="text-white focus:bg-white/10"
                      >
                        <div className="flex flex-col">
                          <span>{info.name}</span>
                          <span className="text-xs text-white/40">{info.freeTier}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Select */}
              <div className="space-y-1">
                <label className="text-xs text-white/40">Model</label>
                <Select 
                  value={config.model} 
                  onValueChange={(v) => setConfig(prev => ({ ...prev, model: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {providerInfo.models.map((model) => (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        className="text-white focus:bg-white/10"
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{model.name}</span>
                          <span className="text-xs text-emerald-400">{model.cost}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="text-xs text-white/40">Duration</label>
                <Select 
                  value={String(config.duration)} 
                  onValueChange={(v) => setConfig(prev => ({ ...prev, duration: Number(v) as 6 | 10 }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="6" className="text-white focus:bg-white/10">6 seconds</SelectItem>
                    <SelectItem value="10" className="text-white focus:bg-white/10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1">
                <label className="text-xs text-white/40">Aspect Ratio</label>
                <Select 
                  value={config.aspectRatio} 
                  onValueChange={(v: string) => setConfig(prev => ({ ...prev, aspectRatio: v as '16:9' | '9:16' | '1:1' }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="16:9" className="text-white focus:bg-white/10">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16" className="text-white focus:bg-white/10">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1" className="text-white focus:bg-white/10">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={hasApiKey 
                  ? "Describe the video you want to generate... (e.g., 'A serene mountain lake at sunset with gentle ripples')" 
                  : "Add an API key above to start generating videos..."
                }
                disabled={!hasApiKey}
                className={cn(
                  "w-full h-28 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-rose-500/50",
                  !hasApiKey && "opacity-50 cursor-not-allowed"
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey && hasApiKey) {
                    handleGenerate();
                  }
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || !hasApiKey}
                className={cn(
                  "absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isGenerating || !prompt.trim() || !hasApiKey
                    ? "bg-white/10 text-white/50 cursor-not-allowed"
                    : "bg-rose-500 hover:bg-rose-600 text-white"
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
              {hasApiKey ? 'Press Cmd+Enter to generate' : 'Connect an API key to enable generation'}
            </p>
          </div>

          {/* Tips */}
          <div className="flex-1 p-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                Tips for great videos
              </h4>
              <ul className="space-y-2 text-xs text-white/50">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400">•</span>
                  Be specific about camera movement: &quot;drone shot flying over...&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400">•</span>
                  Describe motion clearly: &quot;gentle waves lapping against shore&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400">•</span>
                  Include lighting: &quot;golden hour sunlight filtering through trees&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400">•</span>
                  Keep it under 6 seconds for best quality with free tiers
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        /* Library View */
        <div className="flex-1 overflow-y-auto p-4">
          {videos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/30">
              <MonitorPlay className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm">No videos generated yet</p>
              <p className="text-xs mt-2 text-white/20">
                Generated videos will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {videos.map((video, index) => (
                <GeneratedVideoCard
                  key={video.id}
                  video={video}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GeneratedVideoCard({
  video,
  index,
}: {
  video: GeneratedVideo;
  index: number;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative aspect-video bg-white/5 rounded-lg overflow-hidden border border-white/10"
    >
      {video.status === 'generating' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative w-12 h-12 mb-3">
            <div className="absolute inset-0 border-3 border-rose-500/20 rounded-full" />
            <div className="absolute inset-0 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-white/50">Generating video...</p>
          <p className="text-xs text-white/30 mt-1">This may take 1-2 minutes</p>
        </div>
      ) : video.status === 'failed' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
          <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
          <p className="text-xs">Generation failed</p>
        </div>
      ) : (
        <>
          {/* Thumbnail */}
          <img
            src={video.thumbnailUrl}
            alt={video.prompt}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
          />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <button className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </button>
          </div>

          {/* Info Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-xs text-white/70 line-clamp-2 mb-2">
                {video.prompt}
              </p>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.metadata.duration}s
                </span>
                <span>{video.metadata.resolution}</span>
              </div>
            </div>
          </div>

          {/* Provider Badge */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white/80">
            {video.metadata.provider}
          </div>
        </>
      )}
    </motion.div>
  );
}

export default VideoModeView;
