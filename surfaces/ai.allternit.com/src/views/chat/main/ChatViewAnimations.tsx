import React from "react";
import { THEME } from "./ChatView.constants";

export const TypingText = ({ 
  text, 
  delay = 0, 
  speed = 0.05, 
  className = "", 
  style = {} 
}: { 
  text: string, 
  delay?: number, 
  speed?: number, 
  className?: string, 
  style?: React.CSSProperties 
}) => {
  return (
    <span className={className} style={style}>
      {text.split('').map((char, i) => (
        <span key={`${i}-${char}`} style={char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {}}>
          {char}
        </span>
      ))}
    </span>
  );
};

export const StaggeredReveal = ({ 
  text, 
  delay = 0, 
  className = "", 
  style = {} 
}: { 
  text: string, 
  delay?: number, 
  className?: string, 
  style?: React.CSSProperties 
}) => {
  const words = text.split(" ");
  return (
    <span className={className} style={{ ...style, display: 'inline-block' }}>
      {words.map((word, i) => (
        <span key={`${i}-${word}`} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          {word.split("").map((char, j) => (
            <span
              key={`${j}-${char}`}
              style={{
                display: 'inline-block',
                ...(char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {})
              }}
            >
              {char}
            </span>
          ))}
          {i < words.length - 1 && <span> </span>}
        </span>
      ))}
    </span>
  );
};
