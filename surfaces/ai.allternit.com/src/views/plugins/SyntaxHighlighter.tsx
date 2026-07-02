/**
 * Syntax Highlighter
 * 
 * Lightweight syntax highlighting without external dependencies.
 * Supports common languages: markdown, json, typescript, javascript, python, etc.
 */

import React from 'react';
import { cn } from '@/lib/utils';

const THEME = {
  bg: '#0c0a09',
  text: '#e7e5e4',
  comment: 'var(--ui-text-muted)',
  keyword: '#c084fc',
  string: 'var(--status-success)',
  number: 'var(--status-warning)',
  function: 'var(--status-info)',
  operator: 'var(--status-error)',
  punctuation: '#9ca3af',
  tag: '#f472b6',
  attr: '#a78bfa',
  lineNumber: '#4b5563',
  border: 'rgba(212, 176, 140, 0.1)',
};

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
}

export function SyntaxHighlighter({
  code,
  language = 'text',
  showLineNumbers = true,
  wrapLines = true,
}: SyntaxHighlighterProps) {
  const lines = code.split('\n');
  const highlightedLines = lines.map((line, i) => ({
    lineNumber: i + 1,
    tokens: tokenize(line, language),
  }));

  return (
    <pre
      className={cn(
        "m-0 py-4 bg-[#0c0a09] font-mono text-[13px] leading-[1.6] overflow-auto",
        wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
      )}
    >
      <code>
        {highlightedLines.map(({ lineNumber, tokens }) => (
          <div key={lineNumber} className="flex">
            {showLineNumbers && (
              <span className="w-12 pr-4 text-right text-[#4b5563] select-none shrink-0">
                {lineNumber}
              </span>
            )}
            <span className="flex-1">
              {tokens.map((token, i) => (
                <span key={`syntax-line-${i}`} style={{ color: token.color }}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}

interface Token {
  text: string;
  color: string;
}

function tokenize(line: string, language: string): Token[] {
  switch (language.toLowerCase()) {
    case 'json':
      return tokenizeJson(line);
    case 'typescript':
    case 'ts':
    case 'javascript':
    case 'js':
      return tokenizeTypeScript(line);
    case 'python':
    case 'py':
      return tokenizePython(line);
    case 'markdown':
    case 'md':
      return tokenizeMarkdown(line);
    case 'yaml':
    case 'yml':
      return tokenizeYaml(line);
    case 'html':
      return tokenizeHtml(line);
    case 'css':
      return tokenizeCss(line);
    case 'rust':
    case 'rs':
      return tokenizeRust(line);
    case 'go':
      return tokenizeGo(line);
    case 'shell':
    case 'bash':
    case 'sh':
      return tokenizeShell(line);
    default:
      return [{ text: line, color: THEME.text }];
  }
}

// ============================================================================
// Language Tokenizers
// ============================================================================

function tokenizeJson(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // String
    const stringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: THEME.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Boolean/Null
    const keywordMatch = remaining.match(/^(true|false|null)/);
    if (keywordMatch) {
      tokens.push({ text: keywordMatch[0], color: THEME.keyword });
      remaining = remaining.slice(keywordMatch[0].length);
      continue;
    }

    // Punctuation
    const punctMatch = remaining.match(/^[{}[\],:]/);
    if (punctMatch) {
      tokens.push({ text: punctMatch[0], color: THEME.punctuation });
      remaining = remaining.slice(punctMatch[0].length);
      continue;
    }

    // Whitespace/Other
    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeTypeScript(line: string): Token[] {
  const keywords = /^(?:const|let|var|function|class|interface|type|import|export|from|return|if|else|for|while|switch|case|break|continue|new|this|async|await|try|catch|finally|throw|typeof|instanceof|in|of|as|extends|implements|public|private|protected|static|readonly|abstract|namespace|module|declare|default)$/;
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comments
    if (remaining.startsWith('//')) {
      tokens.push({ text: remaining, color: THEME.comment });
      break;
    }

    // String
    const stringMatch = remaining.match(/^['"`](?:[^'"`\\]|\\.)*['"`]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Template literal
    if (remaining.startsWith('`')) {
      const endIndex = remaining.indexOf('`', 1);
      if (endIndex > 0) {
        const str = remaining.slice(0, endIndex + 1);
        tokens.push({ text: str, color: THEME.string });
        remaining = remaining.slice(str.length);
        continue;
      }
    }

    // Number
    const numberMatch = remaining.match(/^-?(?:0[xX][0-9a-fA-F]+|0[oO]?[0-7]*|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: THEME.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Keyword or identifier
    const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const color = keywords.test(word) ? THEME.keyword : 
                    remaining[word.length] === '(' ? THEME.function : THEME.text;
      tokens.push({ text: word, color });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Operators
    const opMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+/);
    if (opMatch) {
      tokens.push({ text: opMatch[0], color: THEME.operator });
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }

    // Other
    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizePython(line: string): Token[] {
  const keywords = /^(?:and|as|assert|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None)$/;
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comment
    if (remaining.startsWith('#')) {
      tokens.push({ text: remaining, color: THEME.comment });
      break;
    }

    // String (single, double, triple)
    const stringMatch = remaining.match(/^['"]{3}(?:[^'"]|['"](?!['"])|['"]{2}(?!['"]))*['"]{3}/) ||
                        remaining.match(/^['"](?:[^'"\\]|\\.)*['"]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: THEME.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Keyword or identifier
    const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const color = keywords.test(word) ? THEME.keyword :
                    remaining[word.length] === '(' ? THEME.function : THEME.text;
      tokens.push({ text: word, color });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Decorator
    if (remaining.startsWith('@')) {
      const decoMatch = remaining.match(/^@[a-zA-Z_][a-zA-Z0-9_]*/);
      if (decoMatch) {
        tokens.push({ text: decoMatch[0], color: THEME.function });
        remaining = remaining.slice(decoMatch[0].length);
        continue;
      }
    }

    // Other
    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeMarkdown(line: string): Token[] {
  const tokens: Token[] = [];

  // Headers
  if (line.match(/^#{1,6}\s/)) {
    return [{ text: line, color: 'var(--accent-primary)' }];
  }

  // Code block
  if (line.startsWith('```')) {
    return [{ text: line, color: THEME.keyword }];
  }

  // Inline code
  let remaining = line;
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`[^`]+`/);
    if (codeMatch) {
      tokens.push({ text: codeMatch[0], color: THEME.string });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold/Italic markers
    if (remaining.match(/^[*_]{1,2}/)) {
      const match = remaining.match(/^[*_]+/);
      tokens.push({ text: match![0], color: THEME.keyword });
      remaining = remaining.slice(match![0].length);
      continue;
    }

    // Links
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({ text: '[', color: THEME.punctuation });
      tokens.push({ text: linkMatch[1], color: THEME.string });
      tokens.push({ text: '](', color: THEME.punctuation });
      tokens.push({ text: linkMatch[2], color: THEME.function });
      tokens.push({ text: ')', color: THEME.punctuation });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeYaml(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  // Comment
  if (remaining.trimStart().startsWith('#')) {
    return [{ text: line, color: THEME.comment }];
  }

  while (remaining.length > 0) {
    // Key
    const keyMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*(?=\s*:)/);
    if (keyMatch) {
      tokens.push({ text: keyMatch[0], color: THEME.attr });
      remaining = remaining.slice(keyMatch[0].length);
      continue;
    }

    // String
    const stringMatch = remaining.match(/^['"](?:[^'"\\]|\\.)*['"]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^-?\d+\.?\d*/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: THEME.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Boolean
    const boolMatch = remaining.match(/^(?:true|false|yes|no|on|off|null|~)/);
    if (boolMatch) {
      tokens.push({ text: boolMatch[0], color: THEME.keyword });
      remaining = remaining.slice(boolMatch[0].length);
      continue;
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeHtml(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comment
    const commentMatch = remaining.match(/^<!--[\s\S]*?-->/);
    if (commentMatch) {
      tokens.push({ text: commentMatch[0], color: THEME.comment });
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // Tag
    const tagMatch = remaining.match(/^<\/?[a-zA-Z][a-zA-Z0-9]*/);
    if (tagMatch) {
      tokens.push({ text: tagMatch[0], color: THEME.tag });
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }

    // Attribute
    const attrMatch = remaining.match(/^[a-zA-Z-]+(?=\s*=)/);
    if (attrMatch) {
      tokens.push({ text: attrMatch[0], color: THEME.attr });
      remaining = remaining.slice(attrMatch[0].length);
      continue;
    }

    // String
    const stringMatch = remaining.match(/^['"](?:[^'"\\]|\\.)*['"]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeCss(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  // Comment
  if (remaining.startsWith('/*')) {
    return [{ text: line, color: THEME.comment }];
  }

  while (remaining.length > 0) {
    // Selector/Property
    const selectorMatch = remaining.match(/^[.#]?[a-zA-Z-][a-zA-Z0-9-]*/);
    if (selectorMatch) {
      tokens.push({ text: selectorMatch[0], color: remaining.includes(':') ? THEME.attr : THEME.tag });
      remaining = remaining.slice(selectorMatch[0].length);
      continue;
    }

    // Value
    const valueMatch = remaining.match(/^[a-zA-Z-]+(?=\s*[:;])/);
    if (valueMatch) {
      tokens.push({ text: valueMatch[0], color: THEME.keyword });
      remaining = remaining.slice(valueMatch[0].length);
      continue;
    }

    // Number with unit
    const numMatch = remaining.match(/^-?\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms|deg|rad)?/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], color: THEME.number });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Color
    const colorMatch = remaining.match(/^#[0-9a-fA-F]{3,8}/);
    if (colorMatch) {
      tokens.push({ text: colorMatch[0], color: THEME.number });
      remaining = remaining.slice(colorMatch[0].length);
      continue;
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeRust(line: string): Token[] {
  const keywords = /^(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while|abstract|become|box|do|final|macro|override|priv|try|typeof|unsized|virtual|yield)$/;
  return tokenizeWithKeywords(line, keywords);
}

function tokenizeGo(line: string): Token[] {
  const keywords = /^(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)$/;
  return tokenizeWithKeywords(line, keywords);
}

function tokenizeShell(line: string): Token[] {
  const keywords = /^(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|break|continue|shift|exit|export|source|alias|trap)$/;
  const tokens: Token[] = [];
  let remaining = line;

  // Shebang
  if (remaining.startsWith('#!')) {
    return [{ text: line, color: THEME.keyword }];
  }

  // Comment
  if (remaining.trimStart().startsWith('#')) {
    return [{ text: line, color: THEME.comment }];
  }

  while (remaining.length > 0) {
    // Variable
    const varMatch = remaining.match(/^\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z0-9_]*/);
    if (varMatch) {
      tokens.push({ text: varMatch[0], color: THEME.attr });
      remaining = remaining.slice(varMatch[0].length);
      continue;
    }

    // String
    const stringMatch = remaining.match(/^['"](?:[^'"\\]|\\.)*['"]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Keyword
    const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      tokens.push({ 
        text: word, 
        color: keywords.test(word) ? THEME.keyword : 
               remaining[word.length] === '(' ? THEME.function : THEME.text 
      });
      remaining = remaining.slice(word.length);
      continue;
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function tokenizeWithKeywords(line: string, keywords: RegExp): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comment
    if (remaining.startsWith('//')) {
      tokens.push({ text: remaining, color: THEME.comment });
      break;
    }

    // String
    const stringMatch = remaining.match(/^['"](?:[^'"\\]|\\.)*['"]/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: THEME.string });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Raw string (Rust)
    const rawStringMatch = remaining.match(/^r#*"(?:[^"]|"(?!#))*"#*/);
    if (rawStringMatch) {
      tokens.push({ text: rawStringMatch[0], color: THEME.string });
      remaining = remaining.slice(rawStringMatch[0].length);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^-?(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: THEME.number });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Keyword or identifier
    const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const color = keywords.test(word) ? THEME.keyword :
                    remaining[word.length] === '(' ? THEME.function : THEME.text;
      tokens.push({ text: word, color });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Lifetime (Rust)
    if (remaining.startsWith("'")) {
      const lifetimeMatch = remaining.match(/^'[a-zA-Z_][a-zA-Z0-9_]*/);
      if (lifetimeMatch) {
        tokens.push({ text: lifetimeMatch[0], color: THEME.attr });
        remaining = remaining.slice(lifetimeMatch[0].length);
        continue;
      }
    }

    tokens.push({ text: remaining[0], color: THEME.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

// ============================================================================
// Simple Markdown Renderer (Human View)
// ============================================================================

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split('\n');
  
  return (
    <div className="text-[14px] text-[#e7e5e4] leading-[1.7]">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('# ')) {
          return (
            <h1 key={`syntax-line-${i}`} className="text-[28px] text-[var(--accent-primary)] my-6 mt-6 mb-4 font-semibold">
              {parseInlineMarkdown(line.slice(2))}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={`syntax-line-${i}`} className="text-[22px] text-[var(--accent-primary)] my-5 mt-5 mb-3 font-semibold">
              {parseInlineMarkdown(line.slice(3))}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={`syntax-line-${i}`} className="text-[18px] text-[var(--accent-primary)] my-4 mt-4 mb-2.5 font-semibold">
              {parseInlineMarkdown(line.slice(4))}
            </h3>
          );
        }

        // Code block start/end
        if (line.startsWith('```')) {
          return (
            <div key={`syntax-line-${i}`} className="bg-[var(--surface-panel)] px-3 py-2 rounded-md font-mono text-[12px] text-[#78716c] my-2">
              {line}
            </div>
          );
        }

        // Blockquote
        if (line.startsWith('> ')) {
          return (
            <blockquote key={`syntax-line-${i}`} className="relative pl-4 my-3 text-[#a8a29e] italic overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d4b08c]" />
              {parseInlineMarkdown(line.slice(2))}
            </blockquote>
          );
        }

        // Horizontal rule
        if (line.match(/^-{3,}$/)) {
          return <hr key={`syntax-line-${i}`} className="border-none border-t border-[var(--ui-border-default)] my-6" />;
        }

        // Unordered list
        if (line.match(/^[-*]\s/)) {
          return (
            <li key={`syntax-line-${i}`} className="ml-5 mb-1 list-disc">
              {parseInlineMarkdown(line.replace(/^[-*]\s/, ''))}
            </li>
          );
        }

        // Ordered list
        const orderedMatch = line.match(/^(\d+)\.\s/);
        if (orderedMatch) {
          return (
            <li key={`syntax-line-${i}`} className="ml-5 mb-1 list-decimal">
              {parseInlineMarkdown(line.replace(/^\d+\.\s/, ''))}
            </li>
          );
        }

        // Empty line
        if (line.trim() === '') {
          return <div key={`syntax-line-${i}`} className="h-2" />;
        }

        // Regular paragraph
        return (
          <p key={`syntax-line-${i}`} className="my-2">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineMarkdown(text: string): React.ReactNode {
  // Inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(remaining.slice(0, codeMatch.index));
      parts.push(
        <code key={`part-${parts.length}`} className="bg-[var(--surface-panel)] px-1.5 py-0.5 rounded font-mono text-[12px] text-[var(--accent-primary)]">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice((codeMatch.index || 0) + codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*|^__([^_]+)__/);
    if (boldMatch) {
      parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={`part-${parts.length}`} className="font-semibold text-[#e7e5e4]">{boldMatch[1] || boldMatch[2]}</strong>);
      remaining = remaining.slice((boldMatch.index || 0) + boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*|^_([^_]+)_/);
    if (italicMatch) {
      parts.push(remaining.slice(0, italicMatch.index));
      parts.push(<em key={`part-${parts.length}`} className="italic text-[#a8a29e]">{italicMatch[1] || italicMatch[2]}</em>);
      remaining = remaining.slice((italicMatch.index || 0) + italicMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(remaining.slice(0, linkMatch.index));
      parts.push(
        <a 
          key={`part-${parts.length}`} 
          href={linkMatch[2]} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[var(--status-info)] no-underline"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice((linkMatch.index || 0) + linkMatch[0].length);
      continue;
    }

    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}
