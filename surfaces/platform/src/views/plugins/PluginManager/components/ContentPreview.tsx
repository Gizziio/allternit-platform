import React from 'react';
import { THEME } from '../constants';
import type { Capability, FileNode } from '../types';
import { SyntaxHighlighter, MarkdownRenderer } from '../../SyntaxHighlighter';

export function GenericContent({ item, viewMode }: { item: Capability; viewMode: 'human' | 'code' }) {
  const content = item.content || 'No content available.';
  const language = item.language || 'text';

  if (viewMode === 'code' || language === 'json') {
    return (
      <SyntaxHighlighter
        code={content}
        language={language}
      />
    );
  }

  return (
    <div style={{ padding: 24, fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  );
}

export function FileContent({ file, viewMode }: { file: FileNode; viewMode: 'human' | 'code' }) {
  const content = file.content || `// ${file.name}\n// No content available`;
  const language = file.language || (file.name.endsWith('.json') ? 'json' : 
                    file.name.endsWith('.md') ? 'markdown' : 
                    file.name.endsWith('.ts') ? 'typescript' :
                    file.name.endsWith('.js') ? 'javascript' : 'text');
  const isHtml = language === 'html' || file.name.endsWith('.html') || file.name.endsWith('.htm');

  if (viewMode === 'code' || language === 'json') {
    return (
      <SyntaxHighlighter
        code={content}
        language={language}
      />
    );
  }

  if (language === 'markdown' || file.name.endsWith('.md')) {
    return (
      <div style={{ padding: 24 }}>
        <MarkdownRenderer content={content} />
      </div>
    );
  }

  if (viewMode === 'human' && isHtml) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 420, backgroundColor: '#fff' }}>
        <iframe
          title={`Preview ${file.name}`}
          srcDoc={content}
          sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#fff',
          }}
        />
      </div>
    );
  }

  return (
    <SyntaxHighlighter
      code={content}
      language={language}
    />
  );
}
