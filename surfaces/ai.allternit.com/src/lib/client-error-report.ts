/**
 * Client-side error reporting for the Allternit platform shell.
 *
 * Wires `window.onerror` / `unhandledrejection` (and explicit calls from the
 * root ErrorBoundary) to a fire-and-forget POST of `/api/v1/client-errors`.
 * The endpoint is best-effort: if it is unreachable or errors, reporting
 * silently stops for the session instead of retrying forever or surfacing UI.
 */

export interface ClientErrorReport {
  message: string;
  stack?: string;
  source?: string;
  location: string;
  userAgent: string;
  kind: 'window.onerror' | 'unhandledrejection' | 'react-error-boundary';
  timestamp: string;
}

const REPORT_PATH = '/api/v1/client-errors';
const MAX_CONSECUTIVE_FAILURES = 3;

let consecutiveFailures = 0;
let reportingDisabled = false;

function buildReport(
  kind: ClientErrorReport['kind'],
  message: string,
  stack?: string,
  source?: string,
): ClientErrorReport {
  return {
    kind,
    message,
    stack,
    source,
    location:
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
  };
}

/** Fire-and-forget POST of an error report. Never throws, never loops. */
export function reportClientError(report: ClientErrorReport): void {
  if (reportingDisabled || typeof window === 'undefined') return;
  try {
    const pending = fetch(REPORT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      // Don't block navigations or retries on the report.
      keepalive: true,
    });
    void pending
      .then((res) => {
        if (!res.ok) consecutiveFailures += 1;
        else consecutiveFailures = 0;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          reportingDisabled = true;
          console.warn(
            '[client-errors] reporting disabled after repeated failures',
          );
        }
      })
      .catch(() => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          reportingDisabled = true;
        }
      });
  } catch {
    // Reporting must never break the app.
  }
}

let installed = false;

/**
 * Install global window.onerror / unhandledrejection handlers that log to the
 * console and forward to the client-errors endpoint. Idempotent.
 */
export function initClientErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const err = event.error instanceof Error ? event.error : undefined;
    console.error('[APP ERROR]', event.message, 'at', event.filename, err);
    reportClientError(
      buildReport(
        'window.onerror',
        event.message || String(event.error ?? 'unknown error'),
        err?.stack,
        event.filename
          ? `${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}`
          : undefined,
      ),
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : undefined;
    console.error('[UNHANDLED REJECTION]', reason);
    reportClientError(
      buildReport(
        'unhandledrejection',
        err?.message ?? String(reason ?? 'unknown rejection'),
        err?.stack,
      ),
    );
  });
}

/** Bridge used by the root ErrorBoundary's onError callback. */
export function reportReactError(error: Error): void {
  console.error('[REACT ERROR BOUNDARY]', error);
  reportClientError(
    buildReport('react-error-boundary', error.message, error.stack),
  );
}
