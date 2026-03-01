# T2-A4: Chat Interface

## Agent Role
Chat UI Specialist

## Task
Create a polished, production-ready chat interface with streaming, code blocks, and rich content.

## Deliverables

### 1. Chat View Layout

Polish/Create: `6-ui/a2r-platform/src/views/chat/ChatView.tsx`

```typescript
interface ChatViewProps {
  view: ViewInstance;
  isActive: boolean;
}

export function ChatView({ view }: ChatViewProps) {
  const { messages, isStreaming, sendMessage, stopGeneration } = useChat(view.state.chatId);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useStickToBottom(scrollRef, { enabled: isStreaming });
  
  return (
    <div className="chat-view flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
        {isStreaming && <StreamingIndicator />}
      </div>
      
      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={() => {
          sendMessage(inputValue);
          setInputValue('');
        }}
        onStop={stopGeneration}
        isStreaming={isStreaming}
      />
    </div>
  );
}
```

### 2. Message List

Create: `6-ui/a2r-platform/src/views/chat/MessageList.tsx`

```typescript
interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const { ref, inView } = useInView({ threshold: 0 });
  
  return (
    <div className="message-list p-4 space-y-6">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
          showAvatar={shouldShowAvatar(messages, index)}
        />
      ))}
      <div ref={ref} /> {/* Sentinel for infinite scroll */}
    </div>
  );
}

function shouldShowAvatar(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  return messages[index].role !== messages[index - 1].role;
}
```

### 3. Message Item

Create: `6-ui/a2r-platform/src/views/chat/MessageItem.tsx`

```typescript
interface MessageItemProps {
  message: ChatMessage;
  isLast: boolean;
  showAvatar: boolean;
}

export function MessageItem({ message, isLast, showAvatar }: MessageItemProps) {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'message-item flex gap-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {showAvatar && (
        <Avatar
          src={isUser ? '/user-avatar.png' : '/agent-avatar.png'}
          fallback={isUser ? 'U' : 'AI'}
          className={cn(
            'w-8 h-8 rounded-full',
            isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
          )}
        />
      )}
      
      {/* Content */}
      <div className={cn(
        'flex-1 space-y-2',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{isUser ? 'You' : message.agentName || 'Assistant'}</span>
          <span>•</span>
          <TimeAgo date={message.timestamp} />
        </div>
        
        {/* Message content */}
        <div className={cn(
          'message-content max-w-3xl',
          isUser && 'bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-3'
        )}>
          <MessageContent content={message.content} />
        </div>
        
        {/* Actions */}
        {!isUser && (
          <MessageActions
            message={message}
            onCopy={() => copyToClipboard(message.content)}
            onRegenerate={() => regenerateMessage(message.id)}
          />
        )}
      </div>
    </motion.div>
  );
}
```

### 4. Message Content Renderer

Create: `6-ui/a2r-platform/src/views/chat/MessageContent.tsx`

```typescript
interface MessageContentProps {
  content: string | MessagePart[];
}

export function MessageContent({ content }: MessageContentProps) {
  // Handle structured content
  if (Array.isArray(content)) {
    return (
      <div className="space-y-4">
        {content.map((part, i) => (
          <MessagePart key={i} part={part} />
        ))}
      </div>
    );
  }
  
  // Handle markdown text
  return (
    <Markdown
      components={{
        code: CodeBlock,
        pre: PreBlock,
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
        // ... other components
      }}
    >
      {content}
    </Markdown>
  );
}

function MessagePart({ part }: { part: MessagePart }) {
  switch (part.type) {
    case 'text':
      return <Markdown>{part.text}</Markdown>;
    case 'code':
      return <CodeBlock language={part.language} code={part.code} />;
    case 'image':
      return <ImagePreview src={part.url} alt={part.alt} />;
    case 'file':
      return <FileAttachment name={part.name} size={part.size} />;
    case 'tool_call':
      return <ToolCallBadge name={part.name} status={part.status} />;
    case 'tool_result':
      return <ToolResult result={part.result} />;
    default:
      return null;
  }
}
```

### 5. Code Block

Create: `6-ui/a2r-platform/src/views/chat/CodeBlock.tsx`

```typescript
interface CodeBlockProps {
  language?: string;
  code: string;
}

export function CodeBlock({ language = 'text', code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  
  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="code-block my-4 rounded-lg overflow-hidden glass">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/20">
        <div className="flex items-center gap-2">
          <Icon name="code" size="sm" />
          <span className="text-xs font-mono uppercase">{language}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleCopy}>
            <Icon name={copied ? 'check' : 'copy'} size="sm" />
          </Button>
        </div>
      </div>
      
      {/* Code */}
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={theme === 'dark' ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
```

### 6. Streaming Text

Create: `6-ui/a2r-platform/src/views/chat/StreamingText.tsx`

```typescript
interface StreamingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function StreamingText({ text, speed = 30, onComplete }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  
  useEffect(() => {
    if (indexRef.current >= text.length) {
      onComplete?.();
      return;
    }
    
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        // Word-by-word streaming for smoother effect
        const nextSpace = text.indexOf(' ', indexRef.current + 1);
        const endIndex = nextSpace === -1 ? text.length : nextSpace + 1;
        
        setDisplayedText(text.slice(0, endIndex));
        indexRef.current = endIndex;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);
  
  return (
    <span>
      {displayedText}
      {displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
      )}
    </span>
  );
}
```

### 7. Chat Input

Create: `6-ui/a2r-platform/src/views/chat/ChatInput.tsx`

```typescript
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);
  
  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };
  
  // File drop handling
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    // Handle file upload
  };
  
  return (
    <div
      className={cn(
        'chat-input p-4 border-t border-white/10',
        isDragging && 'bg-primary/10'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="glass rounded-2xl p-2 flex items-end gap-2">
        {/* Attach button */}
        <Button variant="ghost" size="icon" className="shrink-0">
          <Icon name="add" size="sm" />
        </Button>
        
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-h-[44px] max-h-[200px] bg-transparent border-0 resize-none focus-visible:ring-0"
          rows={1}
        />
        
        {/* Send/Stop button */}
        {isStreaming ? (
          <Button variant="destructive" size="icon" onClick={onStop} className="shrink-0">
            <Icon name="square" size="sm" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="shrink-0"
          >
            <Icon name="arrow-up" size="sm" />
          </Button>
        )}
      </div>
      
      {/* Footer hint */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>{value.length} characters</span>
      </div>
    </div>
  );
}
```

### 8. Tool Call Display

Create: `6-ui/a2r-platform/src/views/chat/ToolCall.tsx`

```typescript
interface ToolCallProps {
  name: string;
  args?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  duration?: number;
}

export function ToolCall({ name, args, status, result, duration }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  
  const statusConfig = {
    pending: { icon: 'clock', color: 'text-muted' },
    running: { icon: 'loader', color: 'text-primary', spin: true },
    success: { icon: 'check', color: 'text-success' },
    error: { icon: 'x', color: 'text-danger' },
  };
  
  const config = statusConfig[status];
  
  return (
    <div className="tool-call my-2 rounded-lg border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
      >
        <Icon name={config.icon} size="sm" className={cn(config.color, config.spin && 'animate-spin')} />
        <span className="font-mono text-sm">{name}</span>
        {duration && <span className="text-xs text-muted">({duration}ms)</span>}
        <div className="flex-1" />
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size="xs" />
      </button>
      
      {expanded && (
        <div className="px-3 py-2 bg-black/20 text-sm">
          {args && (
            <div className="mb-2">
              <div className="text-xs text-muted mb-1">Arguments:</div>
              <pre className="text-xs overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {result && (
            <div>
              <div className="text-xs text-muted mb-1">Result:</div>
              <pre className="text-xs overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Integration

- Use T1-A3 (Glass) for message bubbles
- Use T1-A4 (Animation) for streaming
- Use T1-A5 (Icons) for message actions
- Integrate with T2-A3 (View) as a registered view

## Requirements

- Auto-scroll to bottom on new messages
- Syntax highlighting for code blocks
- Copy button for code blocks
- File drag-and-drop support
- Markdown rendering
- Streaming text animation
- Tool call visualization

## Success Criteria
- [ ] ChatView complete
- [ ] MessageList with virtualization
- [ ] MessageItem with avatar
- [ ] CodeBlock with syntax highlighting
- [ ] StreamingText animation
- [ ] ChatInput with auto-resize
- [ ] ToolCall display
- [ ] File drop support
- [ ] No SYSTEM_LAW violations
