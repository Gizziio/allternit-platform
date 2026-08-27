import { EventEmitter } from 'events';
import { RunState } from '../harness/run-state.js';
export class AgentRun extends EventEmitter {
    id;
    agent;
    status = 'queued';
    messages = [];
    runState;
    currentRequest;
    pendingReplyHandler;
    constructor(id, agent, initialRequest) {
        super();
        this.id = id;
        this.agent = agent;
        this.messages = initialRequest.messages.map((m) => ({ ...m, content: m.content }));
        this.currentRequest = { ...initialRequest };
        this.runState = new RunState();
        // Wire up tool registry events to the run emitter
        this.runState.toolRegistry.on('event', (e) => this.emit('tool_lifecycle', e));
    }
    /**
     * Store the pending reply handler so it can be invoked later via submitReply().
     */
    setPendingReplyHandler(handler) {
        this.pendingReplyHandler = handler;
    }
    /**
     * Submit a reply outcome to resume a paused run.
     * @throws Error if no pending reply is awaiting submission.
     */
    async submitReply(outcome) {
        if (!this.pendingReplyHandler) {
            throw new Error(`Run ${this.id} has no pending reply to submit`);
        }
        const handler = this.pendingReplyHandler;
        this.pendingReplyHandler = undefined;
        await handler(outcome);
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
                messages: this.serializeMessagesForHarness()
            });
            let assistantMessageContent = [];
            let pendingToolCalls = [];
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
        }
        catch (error) {
            this.updateStatus('failed');
            this.agent.saveRunState(this);
            this.emit('error', error);
        }
    }
    serializeMessagesForHarness() {
        return this.messages.map((message) => ({
            role: message.role,
            name: message.name,
            tool_calls: message.tool_calls,
            tool_call_id: message.tool_call_id,
            content: this.serializeContentForHarness(message.content),
        }));
    }
    serializeContentForHarness(content) {
        if (typeof content === 'string')
            return content;
        const hasVision = content.some((block) => block.type === 'vision' || block.type === 'vision_coordinates');
        if (!hasVision) {
            return content
                .map((block) => {
                if (block.type === 'text')
                    return block.text;
                if (block.type === 'tool_use') {
                    return `[tool_use:${block.name}] ${JSON.stringify(block.input)}`;
                }
                if (block.type === 'tool_result') {
                    return `[tool_result:${block.tool_use_id}] ${block.content}`;
                }
                return '';
            })
                .join('\n');
        }
        return content.flatMap((block) => {
            if (block.type === 'text')
                return [{ type: 'text', text: block.text }];
            if (block.type === 'vision')
                return [{ type: 'vision', source: block.source }];
            if (block.type === 'vision_coordinates')
                return [{ type: 'vision_coordinates', x: block.x, y: block.y }];
            if (block.type === 'tool_use') {
                return [{ type: 'text', text: `[tool_use:${block.name}] ${JSON.stringify(block.input)}` }];
            }
            if (block.type === 'tool_result') {
                return [{ type: 'text', text: `[tool_result:${block.tool_use_id}] ${block.content}` }];
            }
            return [];
        });
    }
    async executeSingleToolCall(tc) {
        // 1. Check if it's an internal tool (search/activate)
        const internalResult = await this.runState.handleToolCall(tc.name, tc.arguments, { callId: tc.id, sessionID: this.id });
        if (internalResult !== null) {
            return { id: tc.id, result: JSON.stringify(internalResult), isError: false };
        }
        // 2. Otherwise route to agent capability
        const result = await this.agent.executeTool(tc.name, tc.arguments);
        return { id: tc.id, result, isError: false };
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
        const permissionCalls = [];
        const nonPermissionCalls = [];
        for (const [index, tc] of toolCalls.entries()) {
            if (this.agent.checkToolPermission(tc.name)) {
                permissionCalls.push(tc);
            }
            else {
                nonPermissionCalls.push({ index, tc });
            }
        }
        // Execute non-permission tool calls concurrently with a bounded concurrency limit.
        const PARALLEL_TOOL_LIMIT = 5;
        const results = [];
        let callIndex = 0;
        async function worker(execute) {
            while (callIndex < nonPermissionCalls.length) {
                const { index, tc } = nonPermissionCalls[callIndex++];
                const res = await execute(tc);
                results.push({ index, ...res });
            }
        }
        await Promise.all(Array.from({ length: Math.min(PARALLEL_TOOL_LIMIT, nonPermissionCalls.length) }, () => worker(this.executeSingleToolCall.bind(this))));
        // Add results in original call order.
        results.sort((a, b) => a.index - b.index);
        for (const res of results) {
            this.addToolResult(res.id, res.result, res.isError);
        }
        // Handle the first permission-required tool sequentially.
        const firstPermission = permissionCalls[0];
        if (firstPermission) {
            this.updateStatus('requires_reply');
            this.agent.saveRunState(this);
            const tc = firstPermission;
            const handler = async (outcome) => {
                if (outcome.type === 'permission' && outcome.approved) {
                    const result = await this.agent.executeTool(tc.name, tc.arguments);
                    this.addToolResult(tc.id, result);
                }
                else {
                    this.addToolResult(tc.id, outcome.type === 'permission' ? outcome.reason || 'Rejected' : 'Error', true);
                }
                this.execute();
            };
            this.setPendingReplyHandler(handler);
            const replyRequest = {
                id: tc.id,
                type: 'permission',
                payload: { title: tc.name, description: `Execute ${tc.name}?` },
                submit: handler,
            };
            this.emit('reply_requested', replyRequest);
            return;
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
