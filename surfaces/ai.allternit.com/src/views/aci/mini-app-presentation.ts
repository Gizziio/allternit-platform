import type {
  InstalledMiniApp,
  MiniAppManifest,
  MiniAppPresentationContract,
} from "./mini-app.types";

type PresentableMiniApp = Pick<
  InstalledMiniApp | MiniAppManifest,
  "id" | "presentation" | "surface" | "harness"
>;

/**
 * Resolves new presentation metadata and keeps older surface-only manifests
 * working. Explicit publisher metadata always wins.
 */
export function resolveMiniAppPresentation(
  app: PresentableMiniApp,
): MiniAppPresentationContract {
  if (app.presentation) return app.presentation;

  if (app.surface?.kind === "allternit-native") {
    return {
      mode: "native",
      nativeRenderer: app.surface.viewType,
      fallback: "native-tools",
    };
  }

  if (
    app.surface?.kind === "embedded-web" &&
    (app.surface.url || app.harness?.baseURL)
  ) {
    return {
      mode: app.surface.viewType ? "hybrid" : "embedded",
      uiUrl: app.surface.url || app.harness?.baseURL,
      nativeRenderer: app.surface.viewType,
      electronPartition: `persist:allternit-${app.id.replace(/[^a-z0-9-]/gi, "-")}`,
      fallback: "external-browser",
    };
  }

  return {
    mode: "native",
    nativeRenderer: app.surface?.viewType,
    fallback: "native-tools",
  };
}
