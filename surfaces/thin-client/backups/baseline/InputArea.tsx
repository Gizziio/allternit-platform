"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUp, ChevronDown, Check, Bot, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GizziMascot } from './GizziMascot';
import './InputArea.css';

// Rotating placeholders for thin client
const PLACEHOLDER_HINTS = [
  "Connect to VS Code to edit code directly...",
  "Link your browser to capture screenshots...",
  "Use @github to reference repositories...",
  "Ask me to refactor this code...",
  "Connect to Terminal to run commands...",
  "Use Agent mode for autonomous tasks...",
];

// Model options
const MODELS = [
  { id: 'kimi-k2', name: 'Kimi K2.5', color: '#8B5CF6' },
  { id: 'gpt-4o', name: 'GPT-4o', color: '#10a37f' },
  { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet', color: '#d97757' },
];

interface InputAreaProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  isCompact?: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSend, 
  isStreaming, 
  disabled = false,
}) => {
  const [input, setInput] = useState("");
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Rotate hints every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(24, Math.min(textareaRef.current.scrollHeight, 100));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowPlusMenu(false);
      setShowModelMenu(false);
    };
    if (showPlusMenu || showModelMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showPlusMenu, showModelMenu]);
  
  const handleSend = () => {
    if (!input.trim() || isStreaming || disabled) return;
    onSend(input);
    setInput("");
  };

  const canSubmit = input.trim().length > 0 && !isStreaming && !disabled;
  
  return (
    <div className="chat-composer-wrapper">
      {/* Gizzi Mascot - Appears above input when agent enabled */}
      <AnimatePresence>
        {agentEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="gizzi-above-container"
          >
            <GizziMascot size={78} emotion="pleased" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Container with Full Glow */}
      <div 
        className={`input-composer-container ${agentEnabled ? 'agent-active' : ''}`}
      >
        {/* Animated gradient overlay when agent enabled */}
        {agentEnabled && <div className="agent-glow-overlay" />}

        {/* Top Row: Plus + Textarea + Model + Send */}
        <div className="composer-top-row">
          {/* Plus Button with Menu */}
          <div className="plus-menu-container">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowPlusMenu(!showPlusMenu);
              }}
              className="composer-btn plus-btn"
              style={{ transform: showPlusMenu ? 'rotate(45deg)' : 'none' }}
            >
              <Plus size={20} />
            </motion.button>
            
            <AnimatePresence>
              {showPlusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="composer-menu plus-menu"
                >
                  <div className="menu-section">
                    <span className="menu-label">Attach</span>
                    <button className="menu-item">
                      <Folder size={16} />
                      <span>Files</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={PLACEHOLDER_HINTS[hintIndex]}
            disabled={isStreaming || disabled}
            rows={1}
            className="composer-textarea"
          />

          {/* Model Selector */}
          <div className="model-selector-container">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowModelMenu(!showModelMenu);
              }}
              className="model-badge"
            >
              <span 
                className="model-dot" 
                style={{ backgroundColor: selectedModel.color }}
              />
              <span className="model-name-short">{selectedModel.name.split(' ')[0]}</span>
              <ChevronDown 
                size={14} 
                style={{ 
                  transform: showModelMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s'
                }} 
              />
            </motion.button>

            <AnimatePresence>
              {showModelMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="composer-menu model-menu"
                >
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      className={`menu-item ${selectedModel.id === model.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedModel(model);
                        setShowModelMenu(false);
                      }}
                    >
                      <span 
                        className="model-dot" 
                        style={{ backgroundColor: model.color }}
                      />
                      <span>{model.name}</span>
                      {selectedModel.id === model.id && <Check size={14} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={canSubmit ? { scale: 1.05 } : {}}
            whileTap={canSubmit ? { scale: 0.95 } : {}}
            onClick={handleSend}
            disabled={!canSubmit}
            className={`send-btn ${canSubmit ? 'active' : ''}`}
          >
            <ArrowUp size={20} />
          </motion.button>
        </div>

        {/* Bottom Row: Agent Toggle + Context */}
        <div className="composer-bottom-row">
          <div className="composer-tools">
            {/* Agent Toggle */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAgentEnabled(!agentEnabled)}
              className={`agent-toggle-button ${agentEnabled ? 'active' : ''}`}
            >
              <Bot size={14} />
              <span>Agent {agentEnabled ? 'On' : 'Off'}</span>
            </motion.button>
          </div>

          <span className="composer-discretion">
            A2R can make mistakes. Check important info.
          </span>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
