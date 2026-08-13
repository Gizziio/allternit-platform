import * as vscode from "vscode";

/**
 * Chat message structure for the Allternit API.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Options for chat completions.
 */
export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Response from the chat completions endpoint.
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Client for communicating with the Allternit API backend.
 */
export class AllternitClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  /**
   * Creates a new AllternitClient instance.
   * @param apiUrl - The base URL of the Allternit API
   * @param apiKey - The API key for authentication
   */
  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  /**
   * Sends a chat completion request to the Allternit API.
   * @param messages - Array of chat messages
   * @param options - Optional configuration for the request
   * @returns The assistant's response text
   */
  public async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const config = vscode.workspace.getConfiguration("gizzi");
    const model = options?.model ?? config.get<string>("model", "default");

    const body = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Allternit API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error("Allternit API returned an empty response");
    }

    return choice.message.content;
  }

  /**
   * Extracts surrounding code context from the current editor.
   * Includes the full file content and metadata about the selection.
   * @param editor - The active VS Code text editor
   * @returns A context string containing file information and code
   */
  public getCodeContext(editor: vscode.TextEditor): string {
    const document = editor.document;
    const selection = editor.selection;
    const languageId = document.languageId;
    const fileName = document.fileName;
    const fullText = document.getText();

    const selectedText = document.getText(selection);

    let context = `File: ${fileName}\n`;
    context += `Language: ${languageId}\n`;
    context += `Total lines: ${document.lineCount}\n`;
    context += `\n--- Full file content ---\n\`\`\`${languageId}\n${fullText}\n\`\`\`\n`;

    if (selectedText) {
      context += `\n--- Selected code (lines ${selection.start.line + 1}-${selection.end.line + 1}) ---\n`;
      context += `\`\`\`${languageId}\n${selectedText}\n\`\`\`\n`;
    }

    return context;
  }

  /**
   * Applies a unified diff to a text document.
   * Parses the diff format and applies changes line by line.
   * @param original - The original document text
   * @param diff - The unified diff string to apply
   * @returns The modified text after applying the diff
   */
  public applyDiff(original: string, diff: string): string {
    const originalLines = original.split("\n");
    const diffLines = diff.split("\n");
    const result: string[] = [];
    let originalIndex = 0;

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

      if (line.startsWith("@@")) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          const oldStart = parseInt(match[1], 10) - 1;
          // Copy unchanged lines before this hunk
          while (originalIndex < oldStart && originalIndex < originalLines.length) {
            result.push(originalLines[originalIndex]);
            originalIndex++;
          }
        }
        continue;
      }

      if (line.startsWith("---") || line.startsWith("+++")) {
        continue;
      }

      if (line.startsWith("-")) {
        // Line removed from original — skip it
        originalIndex++;
      } else if (line.startsWith("+")) {
        // Line added
        result.push(line.substring(1));
      } else if (line.startsWith(" ")) {
        // Context line — keep from original
        if (originalIndex < originalLines.length) {
          result.push(originalLines[originalIndex]);
          originalIndex++;
        }
      }
    }

    // Append any remaining original lines
    while (originalIndex < originalLines.length) {
      result.push(originalLines[originalIndex]);
      originalIndex++;
    }

    return result.join("\n");
  }
}
