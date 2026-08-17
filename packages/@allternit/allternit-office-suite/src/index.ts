// Host contract and context
export {
  OfficeHostProvider,
  useOfficeHost,
  useOfficeHostRequired,
  localStorageProvider,
} from './bridge/OfficeHostContext';
export type {
  OfficeHost,
  OpenedFile,
  OpenOptions,
  RecentFile,
  SaveOptions,
  OfficeAiClient,
  OfficeMessage,
  OfficeModelInfo,
  OfficeStorageProvider,
  XlsxEngineHost,
  XlsxSessionHandle,
} from './bridge/types';

// AI configuration
export type { OfficeAiConfig } from './ai/types';

// Office app adapters (host-aware wrappers around the vendored apps)
export { DocsApp, type DocsAppProps } from './apps/DocsApp';
export { SheetsApp, type SheetsAppProps } from './apps/SheetsApp';
export { SlidesApp, type SlidesAppProps } from './apps/SlidesApp';
export { PdfApp, type PdfAppProps } from './apps/PdfApp';

// Allternit Sign
export { SignApp, type SignAppProps } from './sign/SignApp';
export {
  buildSignedPdf,
  canvasToPngBytes,
  initPdfWorker,
  loadPdfDocument,
  pngBytesToDataUrl,
  renderPageToCanvas,
  type Signer,
  type SignatureField,
} from './sign/pdf-signing';

// Browser host helper for standalone surfaces
export { createBrowserHost, type BrowserHostOptions } from './hosts/browser';

// Default theme for standalone surfaces
import './theme/allternit-office-suite.css';
