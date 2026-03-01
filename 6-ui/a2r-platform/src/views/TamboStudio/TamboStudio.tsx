/**
 * Tambo Studio Component
 * 
 * UI Generation Studio:
 * - Spec editor
 * - Component palette
 * - Preview pane
 * - Code output with export
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Palette,
  Code,
  Eye,
  Download,
  Plus,
  Trash,
  Save,
  Copy,
  Check
} from 'lucide-react';

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

const API_BASE = '/api/v1/tambo';

const COMPONENT_TYPES = [
  { value: 'button', label: 'Button', icon: '🔘' },
  { value: 'input', label: 'Input', icon: '⌨️' },
  { value: 'card', label: 'Card', icon: '📇' },
  { value: 'container', label: 'Container', icon: '📦' },
];

const UI_TYPES = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'html', label: 'HTML' },
];

export function TamboStudio() {
  // Spec state
  const [spec, setSpec] = useState<UISpec>({
    spec_id: '',
    title: '',
    description: '',
    components: [],
    layout_type: 'flex',
    style_theme: 'light',
  });

  // Generation state
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedUiType, setSelectedUiType] = useState('react');

  // Add component
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

  // Remove component
  const removeComponent = (index: number) => {
    setSpec(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  // Update component property
  const updateComponentProperty = (
    index: number,
    key: string,
    value: string
  ) => {
    setSpec(prev => ({
      ...prev,
      components: prev.components.map((comp, i) => {
        if (i === index) {
          return {
            ...comp,
            properties: { ...comp.properties, [key]: value },
          };
        }
        return comp;
      }),
    }));
  };

  // Generate UI
  const handleGenerate = async () => {
    try {
      setGenerating(true);

      // First create the spec
      const specRes = await fetch(`${API_BASE}/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...spec,
          spec_id: spec.spec_id || `spec_${Date.now()}`,
          created_at: new Date().toISOString(),
        }),
      });

      if (!specRes.ok) {
        throw new Error('Failed to create spec');
      }

      const specData = await specRes.json();

      // Generate UI
      const genRes = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec_id: specData.spec_id,
          ui_type: selectedUiType,
        }),
      });

      if (!genRes.ok) {
        throw new Error('Generation failed');
      }

      const result = await genRes.json();
      setGeneratedCode(result.code);
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Copy code
  const copyCode = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download code
  const downloadCode = () => {
    if (generatedCode) {
      const extension = selectedUiType === 'react' ? 'tsx' :
                       selectedUiType === 'vue' ? 'vue' :
                       selectedUiType === 'svelte' ? 'svelte' : 'html';
      
      const blob = new Blob([generatedCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-component.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tambo Studio</h1>
          <p className="text-muted-foreground">
            AI-Powered UI Generation
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedUiType} onValueChange={setSelectedUiType}>
            <SelectTrigger className="w-32" aria-label="UI Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UI_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating || spec.components.length === 0}>
            {generating ? 'Generating...' : 'Generate UI'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Component Palette */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Components
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {COMPONENT_TYPES.map(comp => (
                <Button
                  key={comp.value}
                  variant="outline"
                  onClick={() => addComponent(comp.value)}
                  className="flex flex-col h-auto py-4"
                >
                  <span className="text-2xl mb-1">{comp.icon}</span>
                  <span className="text-xs">{comp.label}</span>
                </Button>
              ))}
            </div>

            {/* Added Components */}
            {spec.components.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Added Components ({spec.components.length})</Label>
                {spec.components.map((comp, idx) => (
                  <div
                    key={comp.component_id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{comp.component_id}</span>
                      <Badge variant="outline">{comp.component_type}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComponent(idx)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spec Editor */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Specification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={spec.title}
                onChange={(e) => setSpec(prev => ({ ...prev, title: e.target.value }))}
                placeholder="My Generated UI"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={spec.description}
                onChange={(e) => setSpec(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what you want to build..."
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="layout-type">Layout Type</Label>
              <Select
                value={spec.layout_type}
                onValueChange={(value) => setSpec(prev => ({ ...prev, layout_type: value }))}
              >
                <SelectTrigger id="layout-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flex">Flex</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="stack">Stack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={spec.style_theme}
                onValueChange={(value) => setSpec(prev => ({ ...prev, style_theme: value }))}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preview/Output */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Generated Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedCode ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadCode}>
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
                <Textarea
                  value={generatedCode}
                  readOnly
                  className="font-mono text-sm min-h-64"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Code className="h-12 w-12 mb-4" />
                <p>Generate UI to see code output</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Tab */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-8 min-h-32 bg-muted/50">
            {spec.components.length === 0 ? (
              <div className="text-center text-muted-foreground">
                Add components to see preview
              </div>
            ) : (
              <div className={`grid gap-4 ${
                spec.layout_type === 'grid' ? 'grid-cols-3' :
                spec.layout_type === 'stack' ? 'grid-cols-1' :
                'grid-cols-2'
              }`}>
                {spec.components.map(comp => (
                  <div
                    key={comp.component_id}
                    className="p-4 border rounded bg-card"
                  >
                    <Badge className="mb-2">{comp.component_type}</Badge>
                    <div className="text-sm font-mono text-muted-foreground">
                      {comp.component_id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TamboStudio;
