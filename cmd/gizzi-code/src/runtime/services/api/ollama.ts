/**
 * Ollama API Provider
 * 
 * Implements the same streaming interface as claude.ts but routes to a local
 * Ollama instance. Translates internal message types to Ollama/OpenAI format.
 */

import axios from 'axios';
import { logForDebugging } from '../../../utils/debug.js';
import type { 
    Message, 
    AssistantMessage, 
    StreamEvent,
    SystemAPIErrorMessage
} from '@/types/message.js';
import { getSessionId } from '@/bootstrap/state.js';
import type { ThinkingConfig } from '../../../utils/thinking.js';

export interface OllamaOptions {
    model: string;
    baseUrl?: string;
    temperature?: number;
    stream?: boolean;
}

/**
 * Main entry point for local AI reasoning via Ollama.
 */
export async function* queryOllamaWithStreaming({
    messages,
    systemPrompt,
    thinkingConfig,
    signal,
    options,
}: {
    messages: Message[];
    systemPrompt: string[];
    thinkingConfig: ThinkingConfig;
    signal: AbortSignal;
    options: any;
}): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = options.model.replace('ollama/', '');
    
    logForDebugging(`[Ollama] Querying local model: ${model} at ${baseUrl}`);

    // Map messages to Ollama format
    const ollamaMessages = [
        { role: 'system', content: systemPrompt.join('\n\n') },
        ...messages.map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: typeof m.message.content === 'string' 
                ? m.message.content 
                : JSON.stringify(m.message.content)
        }))
    ];

    try {
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: ollamaMessages,
                stream: true,
                options: {
                    temperature: options.temperatureOverride ?? 0.7,
                }
            }),
            signal
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to get response reader');

        let fullContent = '';
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        const text = json.message.content;
                        fullContent += text;
                        
                        yield {
                            type: 'text',
                            text,
                            index: 0
                        } as StreamEvent;
                    }
                } catch (e) {
                    // Ignore partial JSON
                }
            }
        }

        // Final assistant message
        yield {
            type: 'assistant',
            message: {
                role: 'assistant',
                content: fullContent
            },
            model,
            usage: { input_tokens: 0, output_tokens: 0 },
            requestId: `ollama-${Date.now()}`
        } as AssistantMessage;

    } catch (error) {
        logForDebugging(`[Ollama] Error: ${error}`, { level: 'error' });
        yield {
            type: 'error',
            error: {
                message: error instanceof Error ? error.message : 'Unknown Ollama error',
            }
        } as any;
    }
}
