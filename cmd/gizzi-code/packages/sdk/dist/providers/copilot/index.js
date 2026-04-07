/**
 * Allternit GitHub Copilot Provider
 *
 * GitHub Copilot API client for Allternit SDK
 * Uses GitHub's Copilot API or Copilot Chat API
 * Docs: https://docs.github.com/en/copilot
 *
 * Note: GitHub Copilot API access requires special authorization
 * This implementation supports both the Copilot API and Copilot Chat integration
 */
import { HarnessError } from '../../harness/types.js';
export const COPILOT_MODELS = {
    GPT_4: 'gpt-4',
    GPT_4_TURBO: 'gpt-4-turbo',
    COPILOT_CHAT: 'copilot-chat',
};
export class AllternitCopilot {
    token;
    baseURL;
    githubApiURL;
    constructor(options) {
        this.token = options.token;
        this.baseURL = options.baseURL || 'https://api.github.com';
        this.githubApiURL = options.githubApiURL || 'https://api.github.com';
    }
    /**
     * Get Copilot token from GitHub
     * This exchanges a GitHub token for a Copilot-specific token
     */
    async getCopilotToken() {
        const response = await fetch(`${this.githubApiURL}/copilot_internal/token`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            throw new HarnessError(`Failed to get Copilot token: ${response.status}`, HarnessErrorCode.AUTH_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data.token;
    }
    async chat(options) {
        // Try to get a Copilot-specific token, fallback to provided token
        let copilotToken;
        try {
            copilotToken = await this.getCopilotToken();
        }
        catch {
            copilotToken = this.token;
        }
        // Use GitHub's Copilot Chat API endpoint
        const response = await fetch(`${this.baseURL}/copilot/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${copilotToken}`,
                'Accept': 'application/json',
                'Github-Version': '2023-07-07',
            },
            body: JSON.stringify({
                model: options.model || COPILOT_MODELS.COPILOT_CHAT,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                stream: false,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Copilot API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        // Try to get a Copilot-specific token, fallback to provided token
        let copilotToken;
        try {
            copilotToken = await this.getCopilotToken();
        }
        catch {
            copilotToken = this.token;
        }
        const response = await fetch(`${this.baseURL}/copilot/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${copilotToken}`,
                'Accept': 'text/event-stream',
                'Github-Version': '2023-07-07',
            },
            body: JSON.stringify({
                model: options.model || COPILOT_MODELS.COPILOT_CHAT,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                stream: true,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Copilot API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.trim() === '' || line.trim() === 'data: [DONE]')
                        continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const chunk = JSON.parse(line.slice(6));
                            yield chunk;
                        }
                        catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async listModels() {
        return [
            { id: COPILOT_MODELS.COPILOT_CHAT, name: 'GitHub Copilot Chat' },
            { id: COPILOT_MODELS.GPT_4, name: 'GPT-4 (via Copilot)' },
            { id: COPILOT_MODELS.GPT_4_TURBO, name: 'GPT-4 Turbo (via Copilot)' },
        ];
    }
    /**
     * Check if Copilot is available for the authenticated user
     */
    async checkAccess() {
        try {
            const response = await fetch(`${this.githubApiURL}/user/copilot`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/json',
                },
            });
            if (!response.ok) {
                return { hasAccess: false };
            }
            const data = await response.json();
            return { hasAccess: true, seatType: data.seat_type };
        }
        catch {
            return { hasAccess: false };
        }
    }
}
export { AllternitCopilot as AllternitGitHubCopilot };
export default AllternitCopilot;
//# sourceMappingURL=index.js.map