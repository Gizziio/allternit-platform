import { EventEmitter } from 'events';
import { RunState } from '../ai-runtime/harness/run-state.js';
export class AgentRun extends EventEmitter {
    id;
    agent;
    status = 'queued';
    messages = [];
    runState;
    currentRequest;
    constructor(id, agent, initialRequest) {
        super();
        this.id = id;
        this.agent = agent;
        this.messages = [...initialRequest.messages];
        this.currentRequest = { ...initialRequest };
        this.runState = new RunState();
        // Wire up tool registry events to the run emitter
        this.runState.toolRegistry.on('event', (e) => this.emit('tool_lifecycle', e));
    }
    async execute() {
        if (this.status === 'completed' || this.status === 'failed')
            return;
        this.updateStatus('thinking');
        this.agent.saveRunState(this);
        try {
            // Use active tools from the registry instead of prompt injection
            const activeTools = this.runState.getActiveToolSchemas();
            const stream = this.agent.getHarness().stream({
                ...this.currentRequest,
                tools: [...(this.currentRequest.tools || []), ...activeTools],
                messages: this.messages
            });
            let assistantMessageContent = [];
            let pendingToolCalls = [];
            for await (const chunk of stream) {
                switch (chunk.type) {
                    case 'text':
                        assistantMessageContent.push({ type: 'text', text: chunk.text });
                        this.emit('text', chunk.text);
                        break;
                    case 'thinking':
                        this.emit('thought', chunk.thinking);
                        break;
                    case 'tool_call':
                        this.updateStatus('executing_tools');
                        pendingToolCalls.push(chunk);
                        this.emit('tool_call', chunk);
                        break;
                    case 'usage':
                        this.emit('usage', chunk);
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
        }
        catch (error) {
            this.updateStatus('failed');
            this.agent.saveRunState(this);
            this.emit('error', error);
        }
    }
    async handleToolCalls(toolCalls, assistantContent) {
        this.messages.push({
            role: 'assistant',
            content: [
                ...assistantContent,
                ...toolCalls.map(tc => ({
                    type: 'tool_use',
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
                const replyRequest = {
                    id: tc.id,
                    type: 'permission',
                    payload: { title: tc.name, description: `Execute ${tc.name}?` },
                    submit: async (outcome) => {
                        if (outcome.type === 'permission' && outcome.approved) {
                            const result = await this.agent.executeTool(tc.name, tc.arguments);
                            this.addToolResult(tc.id, result);
                            this.execute();
                        }
                        else {
                            this.addToolResult(tc.id, outcome.type === 'permission' ? outcome.reason || 'Rejected' : 'Error', true);
                            this.execute();
                        }
                    }
                };
                this.emit('reply_requested', replyRequest);
                return;
            }
            else {
                const result = await this.agent.executeTool(tc.name, tc.arguments);
                this.addToolResult(tc.id, result);
            }
        }
        this.execute();
    }
    addToolResult(toolUseId, content, isError = false) {
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
    updateStatus(status) {
        this.status = status;
        this.emit('status_change', status);
    }
    hydrate(status, messages, toolSnapshot) {
        this.status = status;
        this.messages = messages;
        if (toolSnapshot) {
            this.runState.toolRegistry.rehydrate(toolSnapshot);
        }
    }
}
//# sourceMappingURL=run.js.map