/**
 * Minimal ambient types for the Office.js Dialog API.
 *
 * OfficeAuthBridgePage loads office.js dynamically from
 * https://appsforoffice.microsoft.com at runtime (it is only available inside
 * an Office host or dialog), so no `@types/office-js` dependency is wired up.
 * Declare just the surface the bridge uses.
 */

declare global {
  interface OfficeContextUi {
    messageParent(message: string): void;
  }

  interface OfficeContext {
    ui?: OfficeContextUi;
  }

  /** Undefined until the dynamically injected office.js script loads. */
  const Office: {
    context: OfficeContext;
  } | undefined;
}

export {};
