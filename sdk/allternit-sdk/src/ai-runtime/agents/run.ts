import { EventEmitter } from 'events';
import type { 
  StreamRequest, 
  Message
} from '../harness/types.js';
import type { 
  AgentRunStatus, 
  ReplyRequest, 
  ReplyOutcome 
} from './types.js';
import type { AllternitAgent } from './controller.js';
import { RunState } from '../harness/run-state.js';

export class AgentRun extends EventEmitter {
  public status: AgentRunStatus = 'queued';
  public messages: RuntimeMessage[] = [];
  public runState: RunState;
  private currentRequest: StreamRequest;
  private pendingReplyHandler?: (outcome: ReplyOutcome) => Promise<void>;
  
  constructor(
    public readonly id: string,
    private readonly agent: AllternitAgent,
    initialRequest: StreamRequest
  ) {
    super();
    this.messages = [...initialRequest.messages];
    this.currentRequest = { ...initialRequest };
    this.runState = new RunState();

    // Wire up tool registry events to the run emitter
    this.runState.toolRegistry.on('event', (e) => this.emit('tool_lifecycle', e));
  }

  /**
   * Store the pending reply handler so it can be invoked later via submitReply().
   */
  public setPendingReplyHandler(handler: (outcome: ReplyOutcome) => Promise<void>): void {
    this.pendingReplyHandler = handler;
  }

  /**
   * Submit a reply outcome to resume a paused run.
   * @throws Error if no pending reply is awaiting submission.
   */
  public async submitReply(outcome: ReplyOutcome): Promise<void> {
    if (!this.pendingReplyHandler) {
      throw new Error(`Run ${this.id} has no pending reply to submit`);
    }
    const handler = this.pendingReplyHandler;
    this.pendingReplyHandler = undefined;
    await handler(outcome);
  }

  public async execute(): Promise<void> {
    if (this.status === 'completed' || this.status === 'failed') return;
    
    this.updateStatus('thinking');
    this.agent.saveRunState(this);
    
    try {
      // Use active tools from the registry instead of prompt injection
      const activeTools = this.runState.getActiveToolSchemas();
      
      const stream = this.agent.getHarness().stream({
        ...this.currentRequest,
        tools: [...(this.currentRequest.tools || []), ...activeTools],
        messages: this.serializeMessagesForHarness()
      });

      let assistantMessageContent: RuntimeContentBlock[] = [];
      let pendingToolCalls: any[] = [];

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'text':
            assistantMessageContent.push({ type: 'text', text: chunk.text });
            this.emit('text', chunk.text);
            break;
          
          case 'tool_call':
          case 'tool_call_complete':
            this.updateStatus('executing_tools');
            pendingToolCalls.push(chunk);
            this.emit('tool_call', chunk);
            break;
          
          case 'error':
            throw chunk.error;
          
          case 'done':
            if (pendingToolCalls.length > 0) {
              await this.handleToolCalls(pendingToolCalls, assistantMessageContent);
              return;
            }
            
            this.messages.push({ role: 'assistant', content: assistantMessageContent });
            this.updateStatus('completed');
            this.agent.saveRunState(this);
            this.emit('completed', this.messages);
            break;
        }
      }
    } catch (error) {
      this.updateStatus('failed');
      this.agent.saveRunState(this);
      this.emit('error', error);
    }
  }

  private serializeMessagesForHarness(): Message[] {
    return this.messages.map((message) => ({
      role: message.role,
      name: message.name,
      tool_calls: message.tool_calls,
      tool_call_id: message.tool_call_id,
      content: Array.isArray(message.content)
        ? message.content
            .map((block) => {
              if (block.type === 'text') {
                return block.text;
              }
              if (block.type === 'tool_use') {
                return `[tool_use:${block.name}] ${JSON.stringify(block.input)}`;
              }
              return `[tool_result:${block.tool_use_id}] ${block.content}`;
            })
            .join('\n')
        : message.content,
    }));
  }

  private async handleToolCalls(toolCalls: any[], assistantContent: RuntimeContentBlock[]) {
    this.messages.push({
      role: 'assistant',
      content: [
        ...assistantContent,
        ...toolCalls.map(tc => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.name,
          input: tc.arguments
        }))
      ]
    });

    for (const tc of toolCalls) {
      // 1. Check if it's an internal tool (search/activate)
      const internalResult = await this.runState.handleToolCall(tc.name, tc.arguments, { callId: tc.id, sessionID: this.id });
      if (internalResult !== null) {
        this.addToolResult(tc.id, JSON.stringify(internalResult));
        continue;
      }

      // 2. Otherwise route to agent capability
      const needsPermission = this.agent.checkToolPermission(tc.name);
      
      if (needsPermission) {
        this.updateStatus('requires_reply');
        this.agent.saveRunState(this);
        const handler = async (outcome: ReplyOutcome) => {
          if (outcome.type === 'permission' && outcome.approved) {
            const result = await this.agent.executeTool(tc.name, tc.arguments);
            this.addToolResult(tc.id, result);
            this.execute(); 
          } else {
            this.addToolResult(tc.id, outcome.type === 'permission' ? outcome.reason || 'Rejected' : 'Error', true);
            this.execute();
          }
        };
        this.setPendingReplyHandler(handler);
        const replyRequest: ReplyRequest = {
          id: tc.id,
          type: 'permission',
          payload: { title: tc.name, description: `Execute ${tc.name}?` },
          submit: handler,
        };
        this.emit('reply_requested', replyRequest);
        return; 
      } else {
        const result = await this.agent.executeTool(tc.name, tc.arguments);
        this.addToolResult(tc.id, result);
      }
    }

    this.execute();
  }

  private addToolResult(toolUseId: string, content: string, isError = false) {
    this.messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: isError
      }]
    });
  }

  private updateStatus(status: AgentRunStatus) {
    this.status = status;
    this.emit('status_change', status);
  }

  public hydrate(status: AgentRunStatus, messages: RuntimeMessage[], toolSnapshot?: any) {
    this.status = status;
    this.messages = messages;
    if (toolSnapshot) {
      this.runState.toolRegistry.rehydrate(toolSnapshot);
    }
  }
}

type RuntimeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

type RuntimeMessage = Omit<Message, 'content'> & {
  content: string | RuntimeContentBlock[];
};
