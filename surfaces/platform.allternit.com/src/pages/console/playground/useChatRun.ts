import { useCallback, useEffect, useRef, useState } from "react";
import { AllternitApiError, formatApiError } from "@/lib/api-client";
import {
  ensureConsoleGatewayKey,
  gatewayAuthOptions,
  type ChatCompletionChunk,
  type ChatCompletionMessage,
} from "@/lib/console-gateway";
import { api } from "@/lib/api-client";

export interface ChatRunUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatRunState {
  running: boolean;
  text: string;
  error: string | null;
  usage: ChatRunUsage | null;
  modelUsed: string | null;
  stopped: boolean;
}

const IDLE: ChatRunState = {
  running: false,
  text: "",
  error: null,
  usage: null,
  modelUsed: null,
  stopped: false,
};

export interface ChatRunArgs {
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  maxTokens: number;
}

/**
 * One runnable chat-completion lane. Streams from `POST /v1/chat/completions`
 * with a virtual key (SSE via `api.stream`); `stop()` aborts the stream.
 * Multiple lanes (compare mode) are independent hook instances.
 */
export function useChatRun(): {
  state: ChatRunState;
  run: (args: ChatRunArgs) => Promise<void>;
  stop: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<ChatRunState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  const run = useCallback(async (args: ChatRunArgs) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState({ ...IDLE, running: true });

    try {
      const key = await ensureConsoleGatewayKey();
      let usage: ChatRunUsage | null = null;
      let modelUsed: string | null = null;
      let text = "";

      const events = api.stream<ChatCompletionChunk>(
        "/v1/chat/completions",
        {
          model: args.model,
          messages: args.messages,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          stream: true,
        },
        { ...gatewayAuthOptions(key), signal: abort.signal }
      );

      for await (const chunk of events) {
        if (chunk.model) modelUsed = chunk.model;
        if (chunk.usage) usage = chunk.usage;
        const delta =
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content;
        if (delta) {
          text += delta;
          setState((prev) => ({ ...prev, text }));
        }
      }

      setState((prev) => ({
        ...prev,
        running: false,
        usage,
        modelUsed,
        text,
        stopped: false,
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState((prev) => ({ ...prev, running: false, stopped: true }));
        return;
      }
      setState((prev) => ({
        ...prev,
        running: false,
        error:
          err instanceof AllternitApiError
            ? err.message
            : formatApiError(err, "Request failed"),
      }));
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { state, run, stop, reset };
}
