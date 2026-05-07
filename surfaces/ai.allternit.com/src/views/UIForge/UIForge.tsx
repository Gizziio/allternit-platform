/**
 * UI Forge Component
 * 
 * Generative & Manual Interface Studio:
 * - Prompt-based generation (OpenUI)
 * - Manual component palette (Legacy)
 * - Live workspace preview
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AllternitOpenUIRenderer } from '@/lib/openui/AllternitOpenUIRenderer';
import { generatePrompt } from '@openuidev/react-lang';
import { schemas } from '@/lib/openui/registry';
import { ContextWindowCard } from '@/components/ai-elements/ContextWindowCard';
import {
  Palette,
  Eye,
  DownloadSimple,
  Copy,
  MagicWand,
  Sparkle,
  Terminal,
  Robot
} from '@phosphor-icons/react';

// Types
interface ComponentSpec {
  component_id: string;
  component_type: string;
  properties: Record<string, string>;
}

interface UISpec {
  spec_id: string;
  title: string;
  description: string;
  components: ComponentSpec[];
  layout_type: string;
  style_theme: string;
}

export function UIForge() {
  const [activeTab, setActiveTab] = useState('generative');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generativeStream, setGenerativeStream] = useState('');
  
  // Manual Spec state (legacy)
  const [spec, setSpec] = useState<UISpec>({
    spec_id: '',
    title: '',
    description: '',
    components: [],
    layout_type: 'flex',
    style_theme: 'light',
  });

  const systemInstructions = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (generatePrompt as any)(schemas, {
      framework: 'OpenUI Lang',
      instructions: 'You are the UI Forge Architect. Create high-fidelity Allternit dashboards based on user descriptions.',
    });
  }, []);

  const handleMagicBuild = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setGenerativeStream('');
    
    // Simulation of AI Stream for the pilot
    const demoResponse = `[v:stack spacing=6
  [v:card title="Architectural Overview"
    [v:grid cols=3
      [v:metric label="Node Health" val="Optimal" trend="up"]
      [v:metric label="Latency" val="12ms" trend="down"]
      [v:metric label="Active Agents" val="4" trend="none"]
    ]
  ]
  [v:card title="Active Protocols"
    [v:stack spacing=2
      [v:button label="Sync Allternit-OS" variant="primary"]
      [v:button label="Purge Cache" variant="outline"]
    ]
  ]
]`;

    // Simulate streaming tokens
    let current = '';
    const tokens = demoResponse.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      current += tokens[i] + ' ';
      setGenerativeStream(current);
      await new Promise(r => setTimeout(r, 60));
    }
    
    setIsGenerating(false);
  };

  const addComponent = (type: string) => {
    const newComponent: ComponentSpec = {
      component_id: `${type}_${Date.now()}`,
      component_type: type,
      properties: {},
    };
    setSpec(prev => ({
      ...prev,
      components: [...prev.components, newComponent],
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MagicWand size={24} className="text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">UI Forge</h1>
          </div>
          <p className="text-muted-foreground">
            Generative Interface Studio for Allternit Platform
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/5">
            <ContextWindowCard>
              <TabsTrigger value="generative" className="flex items-center gap-2">
                <Sparkle size={14} /> AI Architect
              </TabsTrigger>
            </ContextWindowCard>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Palette size={14} /> Manual Spec
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          {activeTab === 'generative' ? (
            <Card className="bg-black/40 border-white/5 overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Robot size={18} className="text-purple-400" />
                  GENERATIVE PROMPT
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase font-bold">Describe your interface</Label>
                  <Textarea 
                    placeholder="e.g. Create a deployment dashboard with a progress metric and a cancel button..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[120px] bg-black/60 border-white/10"
                  />
                </div>
                <Button 
                  onClick={handleMagicBuild} 
                  disabled={isGenerating || !prompt}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {isGenerating ? (
                    <><SpinnerGap size={16} className="animate-spin mr-2" /> Architecting...</>
                  ) : (
                    <><MagicWand size={16} className="mr-2" /> Build UI</>
                  )}
                </Button>
                <div className="pt-4 border-t border-white/5">
                  <Label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block text-center">Engine Instructions</Label>
                  <div className="p-3 bg-black/60 rounded-lg border border-white/5 text-[10px] font-mono text-gray-500 h-32 overflow-auto">
                    {systemInstructions}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-black/40 border-white/5">
              <CardHeader className="bg-white/5 border-b border-white/5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Palette size={18} />
                  MANUAL PALETTE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {COMPONENT_TYPES.map(comp => (
                    <Button
                      key={comp.value}
                      variant="outline"
                      onClick={() => addComponent(comp.value)}
                      className="flex flex-col h-auto py-3 border-white/5 bg-white/5 hover:bg-white/10"
                    >
                      <span className="text-xl mb-1">{comp.icon}</span>
                      <span className="text-[10px] uppercase font-bold">{comp.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Preview Pane */}
        <div className="lg:col-span-8">
          <Card className="h-full bg-black/40 border-white/5 flex flex-col overflow-hidden">
            <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Eye size={18} className="text-green-400" />
                LIVE WORKSPACE PREVIEW
              </CardTitle>
              {isGenerating && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-green-500 uppercase">Streaming OpenUI Lang</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-8 bg-black/20 overflow-auto">
              {activeTab === 'generative' ? (
                generativeStream ? (
                  <div className="max-w-2xl mx-auto">
                    <AllternitOpenUIRenderer stream={generativeStream} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-2xl">
                    <Sparkle size={48} className="opacity-10 mb-4" />
                    <p className="text-sm">Describe an interface to begin generation</p>
                  </div>
                )
              ) : (
                <div className="border rounded-lg p-8 min-h-32 bg-muted/50">
                  {spec.components.length === 0 ? (
                    <div className="text-center text-muted-foreground">Add components manually</div>
                  ) : (
                    <div className="grid gap-4">
                      {spec.components.map(comp => (
                        <div key={comp.component_id} className="p-4 border rounded bg-card">
                          <Badge>{comp.component_type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-between items-center">
               <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Terminal size={14} />
                  <span>Output: <strong>@openuidev/react-lang</strong></span>
               </div>
               <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-8"><Copy size={14} className="mr-2"/> Copy Code</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-8"><DownloadSimple size={14} className="mr-2"/> Export</Button>
               </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const SpinnerGap = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
);

const COMPONENT_TYPES = [
  { value: 'button', label: 'Button', icon: '🔘' },
  { value: 'input', label: 'Input', icon: '⌨️' },
  { value: 'card', label: 'Card', icon: '📇' },
  { value: 'container', label: 'Container', icon: '📦' },
];

export default UIForge;
