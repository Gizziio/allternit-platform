import React, { useState, useRef, useEffect } from 'react';

interface TerminalPaneProps {
  buffer: string;
  onSend: (input: string) => void;
  maxHeight?: number;
}

const MAX_LINES = 2000;
const MAX_CHARS = 200000;

export const TerminalPane: React.FC<TerminalPaneProps> = ({ buffer, onSend, maxHeight = 300 }) => {
  const [input, setInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const truncatedBuffer = buffer.slice(-MAX_CHARS);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [truncatedBuffer]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="gizzi-terminal-pane">
      <div
        className="gizzi-terminal-output"
        ref={containerRef}
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <pre className="gizzi-terminal-content">{truncatedBuffer}</pre>
      </div>
      <div className="gizzi-terminal-input-line">
        <span className="gizzi-terminal-prompt">❯</span>
        <input
          className="gizzi-terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command..."
          autoFocus
        />
      </div>
    </div>
  );
};
