import './install-globals'
import { useRef } from 'react'
import App from './renderer/App'
import { LocaleProvider } from './renderer/i18n/locale'
import { htmlLang, type Lang } from './renderer/i18n/i18n-core'
import { installPdfBridge, type PdfBridgeOptions } from './platform-bridge'
import './renderer/styles.css'

// Registers window.pdfApi onto the in-process handlers.
import './preload/index'

export interface PdfAppProps extends PdfBridgeOptions {
  /** UI language; this build ships English by default */
  language?: Lang
}

/**
 * Allternit PDF — the full PDF viewer/editor (pdf.js rendering, annotations,
 * forms, stamps, signatures, page operations) mounted as a single component.
 * The vendored Electron main runs in-page via the IPC shim.
 */
export function PdfApp({ language = 'en', document: initialDocument, onSave, readOnly }: PdfAppProps) {
  const installed = useRef(false)
  if (!installed.current) {
    installed.current = true
    document.documentElement.lang = htmlLang(language)
    installPdfBridge({
      ...(initialDocument ? { document: initialDocument } : {}),
      ...(onSave ? { onSave } : {}),
      readOnly,
    })
  }
  return (
    <LocaleProvider initial={language}>
      <App />
    </LocaleProvider>
  )
}
