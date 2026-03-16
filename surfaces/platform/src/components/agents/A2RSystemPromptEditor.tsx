/**
 * A2RSystemPromptEditor.tsx
 * 
 * Professional system prompt editor with:
 * - Monospace font
 * - Line numbers
 * - Variable highlighting (simulated)
 * - Testing integration
 * - Character count and validation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Eye, Copy, Check, AlertCircle, Sparkles, HelpCircle, Code } from 'lucide-react';
import { TEXT, GLASS, SAND } from '@/design/a2r.tokens';
import { api } from '@/integration/api-client';

interface A2RSystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  modeColors: any;
  placeholder?: string;
  variables?: Array<{ name: string; description: string }>;
}

export function A2RSystemPromptEditor({
  value,
  onChange,
  modeColors,
  placeholder = "Enter system prompt instructions...",
  variables = [],
}: A2RSystemPromptEditorProps) {
  const [testOutput, setTestTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(Math.max(lines, 1));
  }, [value]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    if (!value.trim()) return;
    
    setIsTesting(true);
    setTestTestOutput(null);
    
    try {
      const response = await api.post<{output?: string}>('/api/v1/prompts/test', {
        prompt: value,
        test_input: "How should you respond to a complex technical request?",
      });
      
      setTestTestOutput(response.output || "Test completed successfully.");
    } catch (err) {
      setTestTestOutput("Error testing prompt: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-white/10 bg-black/40">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-blue-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/60">System Prompt Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 font-mono">
            {value.length} chars | {lineCount} lines
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/60"
            title="Copy Prompt"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-[300px] relative">
        {/* Line Numbers */}
        <div 
          className="w-10 bg-black/20 border-r border-white/5 text-right pr-2 pt-3 select-none flex flex-col font-mono text-[11px] text-white/20"
          style={{ lineHeight: '1.5rem' }}
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent p-3 outline-none resize-none font-mono text-sm text-white/80 leading-relaxed placeholder:text-white/10"
          style={{ lineHeight: '1.5rem' }}
          spellCheck={false}
        />
      </div>

      {/* Editor Footer / Actions */}
      <div className="p-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {variables.length > 0 && (
            <div className="flex items-center gap-2">
              <HelpCircle size={12} className="text-white/40" />
              <span className="text-[10px] text-white/40">
                Variables: {variables.map(v => `{{${v.name}}}`).join(', ')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting || !value.trim()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-blue-500/20 text-blue-400 disabled:opacity-30 border border-blue-500/30"
          >
            {isTesting ? (
              <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Test Prompt
          </button>
        </div>
      </div>

      {/* Test Output Overlay */}
      {testOutput && (
        <div className="p-4 bg-blue-500/5 border-t border-blue-500/20 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
              <Sparkles size={12} />
              Simulated Agent Response
            </div>
            <button 
              onClick={() => setTestTestOutput(null)}
              className="text-white/40 hover:text-white"
            >
              <AlertCircle size={14} rotate={45} />
            </button>
          </div>
          <div className="text-xs text-white/70 italic leading-relaxed font-serif p-3 bg-black/40 rounded-lg border border-white/5">
            "{testOutput}"
          </div>
        </div>
      )}
    </div>
  );
}
