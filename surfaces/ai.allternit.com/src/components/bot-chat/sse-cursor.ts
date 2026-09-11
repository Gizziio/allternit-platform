/**
 * Cursor-based SSE reconnect client (Phase 1A).
 *
 * fetch-based SSE (repo idiom — see `sdk/allternit-sdk/src/ai-runtime/runtime/index.ts`
 * `proxySse`: never raw EventSource, which would reconnect against the wrong
 * origin and mint leases). Parses `id:` fields of the form `<streamId>:<seq>`
 * into a reconnect cursor, replays with `Last-Event-ID` after dropped
 * connections, and backs off exponentially up to 15s. An intentional abort
 * (`close()` or `signal`) never retries.
 *
 * @module bot-chat/sse-cursor
 */

export interface CursorSseEvent {
  /** SSE `event:` field; "message" when the field is absent. */
  event: string;
  /** Decoded `data:` payload (multi-line data joined with \n). */
  data: string;
  /** SSE `id:` field of the frame that produced this event, if any. */
  id?: string;
}

export interface OpenCursorSseOptions {
  onEvent: (event: CursorSseEvent) => void;
  /** Called with the full `<streamId>:<seq>` cursor whenever a frame carries an id. */
  onCursor?: (cursor: string) => void;
  /** Aborting stops the stream and suppresses all retries. */
  signal?: AbortSignal;
  /**
   * Injectable fetch for tests; defaults to the global. Must return a
   * streaming Response (body is read via getReader()).
   */
  fetchImpl?: typeof fetch;
}

export interface CursorSseHandle {
  close: () => void;
}

const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 15_000;
const READ_BUF_LIMIT = 256 * 1024;

export function openCursorSse(
  url: string,
  { onEvent, onCursor, signal, fetchImpl }: OpenCursorSseOptions,
): CursorSseHandle {
  const fetchFn = fetchImpl ?? fetch;
  let cursor: string | null = null;
  let attempt = 0;
  let closed = false;
  let abortCurrent: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    abortCurrent?.abort();
  };

  signal?.addEventListener(
    "abort",
    () => {
      stop();
    },
    { once: true },
  );

  const scheduleRetry = () => {
    if (closed || signal?.aborted) return;
    const delay = Math.min(BACKOFF_INITIAL_MS * 2 ** attempt, BACKOFF_MAX_MS);
    attempt += 1;
    retryTimer = setTimeout(connect, delay);
  };

  const connect = async () => {
    if (closed || signal?.aborted) return;
    abortCurrent = new AbortController();
    // A caller abort must both stop the read loop and suppress the retry the
    // read loop would otherwise schedule on fetch rejection.
    const onCallerAbort = () => abortCurrent?.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };
      if (cursor) headers["Last-Event-ID"] = cursor;

      const response = await fetchFn(url, {
        headers,
        signal: abortCurrent.signal,
      });

      if (!response.ok || !response.body) {
        scheduleRetry();
        return;
      }

      // A successful connection resets the backoff.
      attempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Per-frame accumulators, dispatched on the blank line.
      let frameEvent = "message";
      let frameData: string[] = [];
      let frameId: string | null = null;

      const dispatch = () => {
        if (frameData.length === 0 && frameId === null) {
          frameEvent = "message";
          return;
        }
        if (frameId !== null) {
          cursor = frameId;
          onCursor?.(frameId);
        }
        if (frameData.length > 0) {
          onEvent({
            event: frameEvent,
            data: frameData.join("\n"),
            id: frameId ?? undefined,
          });
        }
        frameEvent = "message";
        frameData = [];
        frameId = null;
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (buf.length > READ_BUF_LIMIT) buf = buf.slice(-READ_BUF_LIMIT);

        let sep: number;
        let frame: string;
        // SSE frames are separated by a blank line (\n\n, \r\n\r\n, or \r\r).
        const splitRe = /\r\n\r\n|\n\n|\r\r/;
        while ((sep = buf.search(splitRe)) !== -1) {
          const match = buf.match(splitRe)!;
          frame = buf.slice(0, sep);
          buf = buf.slice(sep + match[0].length);
          const lines = frame.split(/\r\n|\r|\n/);
          for (const line of lines) {
            if (line === "" || line.startsWith(":")) continue;
            const colon = line.indexOf(":");
            const field = colon === -1 ? line : line.slice(0, colon);
            // A single leading space after the colon is stripped per the SSE spec.
            let valueText = colon === -1 ? "" : line.slice(colon + 1);
            if (valueText.startsWith(" ")) valueText = valueText.slice(1);
            switch (field) {
              case "event":
                frameEvent = valueText;
                break;
              case "data":
                frameData.push(valueText);
                break;
              case "id":
                if (!valueText.includes("\0")) frameId = valueText;
                break;
              case "retry":
                break;
            }
          }
          dispatch();
        }
      }
      // Flush a trailing frame without its terminating blank line.
      dispatch();
      scheduleRetry();
    } catch {
      // Fetch rejected or read failed (including our own abort): retry only
      // when the close wasn't intentional.
      if (!closed && !signal?.aborted && !abortCurrent.signal.aborted) {
        scheduleRetry();
      }
    } finally {
      signal?.removeEventListener("abort", onCallerAbort);
    }
  };

  // Kick off the first connection; errors route through scheduleRetry.
  void connect();

  return { close: stop };
}
