"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

import type { ExtensionSidepanelComposerProps } from "./extension-sidepanel/ExtensionSidepanelShell.types";
import { useMention, MENTION_OPTIONS, type MentionOption } from "./allternit-extension/html-to-figma/ui/MentionAutocomplete";
import { CaptureCard } from "./allternit-extension/html-to-figma/ui/CaptureCard";
import type { CaptureResult } from "./allternit-extension/html-to-figma/types";

interface CaptureEntry {
  id: string;
  url: string;
  result?: CaptureResult;
}

// Match the Extension's CaptureComposer style exactly
export function BrowserNativeComposer({
  isRunning,
  value,
  placeholder,
  onValueChange,
  onSubmit,
  onStop,
}: ExtensionSidepanelComposerProps) {
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [captureEntries, setCaptureEntries] = useState<CaptureEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Detect URL in input
  const detectURL = useCallback((text: string): string | null => {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlPattern);
    return match ? match[1] : null;
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onValueChange(newValue);
    setCursorPosition(cursor);

    // Check for @mention
    const mention = useMention(newValue, cursor);
    setShowMention(mention.isActive);

    // Check for URL
    const url = detectURL(newValue);
    if (url && url !== detectedUrl) {
      setDetectedUrl(url);
      setShowQuickAction(true);
    } else if (!url) {
      setDetectedUrl(null);
      setShowQuickAction(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (option: MentionOption) => {
    const mention = useMention(value, cursorPosition);
    
    // Replace the @mention with the command
    const beforeMention = value.slice(0, mention.startIndex);
    const afterMention = value.slice(cursorPosition);
    const newValue = `${beforeMention}@${option.name} ${afterMention}`;
    
    onValueChange(newValue);
    setShowMention(false);
    
    // Focus back to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = beforeMention.length + option.name.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle quick action selection
  const handleQuickAction = (mode: 'quick' | 'deep' | 'chat') => {
    if (!detectedUrl) return;

    if (mode === 'chat') {
      // Send URL as regular chat message
      onSubmit(detectedUrl);
      setShowQuickAction(false);
      setDetectedUrl(null);
      return;
    }

    // Create capture entry for inline display
    const entry: CaptureEntry = {
      id: Date.now().toString(),
      url: detectedUrl
    };
    setCaptureEntries(prev => [...prev, entry]);
    
    // Clear input but keep it focused
    onValueChange('');
    setShowQuickAction(false);
    setDetectedUrl(null);
  };

  // Handle capture completion
  const handleCaptureComplete = (id: string) => (result: CaptureResult) => {
    setCaptureEntries(prev => 
      prev.map(entry => 
        entry.id === id ? { ...entry, result } : entry
      )
    );
  };

  // Handle key down for submit
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      
      // Check if input is a @command with URL
      const mentionMatch = value.match(/^@(capture|quick|deep)\s+(https?:\/\/[^\s]+)/i);
      if (mentionMatch) {
        const [, command, url] = mentionMatch;
        const entry: CaptureEntry = {
          id: Date.now().toString(),
          url
        };
        setCaptureEntries(prev => [...prev, entry]);
        onValueChange('');
        return;
      }
      
      onSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  // Close overlays on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const composer = textareaRef.current?.parentElement;
      if (composer && !composer.contains(event.target as Node)) {
        setShowQuickAction(false);
        setShowMention(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayUrl = detectedUrl 
    ? detectedUrl.replace(/^https?:\/\//, '').slice(0, 40) + (detectedUrl.length > 40 ? '...' : '')
    : '';

  return (
    <div className="relative">
      {/* Inline Capture Cards */}
      {captureEntries.length > 0 && (
        <div className="mb-3 space-y-2">
          {captureEntries.map(entry => (
            <CaptureCard
              key={entry.id}
              url={entry.url}
              onComplete={handleCaptureComplete(entry.id)}
              onClose={() => setCaptureEntries(prev => prev.filter(e => e.id !== entry.id))}
            />
          ))}
        </div>
      )}

      {/* Quick Action Overlay */}
      {showQuickAction && detectedUrl && (
        <div 
          className="absolute bottom-full left-4 right-4 mb-2 p-3.5 rounded-xl z-50"
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <span className="text-sm font-semibold text-white">
                Capture to Figma?
              </span>
            </div>
            <button 
              onClick={() => setShowQuickAction(false)}
              className="w-5 h-5 flex items-center justify-center bg-white/20 rounded-full text-white text-sm hover:bg-white/30"
            >
              ×
            </button>
          </div>
          
          <div className="text-xs text-white/80 mb-2.5 px-2 py-1.5 bg-black/20 rounded truncate">
            {displayUrl}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickAction('quick')}
              className="flex-1 py-2 px-2 rounded-lg text-xs text-white flex items-center justify-center gap-1 transition-all"
              style={{ background: 'rgba(76, 175, 80, 0.4)', border: '1px solid rgba(76, 175, 80, 0.5)' }}
            >
              <span>⚡</span>
              <span>Quick</span>
            </button>
            <button
              onClick={() => handleQuickAction('deep')}
              className="flex-1 py-2 px-2 rounded-lg text-xs text-white flex items-center justify-center gap-1 transition-all"
              style={{ background: 'rgba(156, 39, 176, 0.4)', border: '1px solid rgba(156, 39, 176, 0.5)' }}
            >
              <span>🔍</span>
              <span>Deep</span>
            </button>
            <button
              onClick={() => handleQuickAction('chat')}
              className="flex-1 py-2 px-2 rounded-lg text-xs text-white flex items-center justify-center gap-1 transition-all"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <span>💬</span>
              <span>Chat</span>
            </button>
          </div>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMention && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#252542] border border-[rgba(102,126,234,0.3)] rounded-xl overflow-hidden shadow-2xl z-50">
          {MENTION_OPTIONS.map((option, index) => (
            <div
              key={option.id}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors ${
                index === 0 ? 'bg-[rgba(102,126,234,0.2)]' : 'hover:bg-[rgba(102,126,234,0.2)]'
              }`}
              onClick={() => handleMentionSelect(option)}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs"
                style={{
                  background: option.id === 'quick' 
                    ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                    : option.id === 'deep'
                    ? 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{option.name}</div>
                <div className="text-xs text-gray-400">{option.description}</div>
              </div>
              <code className="text-xs text-[#667eea] bg-[rgba(102,126,234,0.15)] px-1.5 py-0.5 rounded">
                {option.shortcut}
              </code>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input - Same style as Extension */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="relative rounded-[14px] border border-input bg-background/80 shadow-sm"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={isRunning}
          placeholder={placeholder || "Describe your task... (Enter to send)"}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="min-h-12 w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        <button
          type={isRunning ? 'button' : 'submit'}
          onClick={isRunning ? onStop : undefined}
          disabled={!isRunning && value.trim().length === 0}
          aria-label={isRunning ? 'Stop task' : 'Send task'}
          className={`absolute bottom-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-xl transition-colors ${
            isRunning
              ? 'bg-destructive text-white hover:opacity-90'
              : value.trim().length > 0
                ? 'bg-zinc-300 text-zinc-950 hover:bg-zinc-200'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {isRunning ? (
            <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          ) : (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          )}
        </button>
      </form>

      {/* Help hint */}
      <div className="mt-1.5 text-[10px] text-muted-foreground text-center">
        Tip: Paste a URL to capture, or use{' '}
        <code className="bg-primary/10 text-primary px-1 rounded">@capture</code> for quick access
      </div>
    </div>
  );
}

export default BrowserNativeComposer;
