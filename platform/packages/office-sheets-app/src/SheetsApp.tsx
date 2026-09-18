import { useRef } from 'react'
import { App } from './renderer/App'
import { LocaleProvider, setModuleLang } from './renderer/i18n/locale'
import { htmlLang, type Lang } from './renderer/i18n/i18n-core'
import { installDesktopBridge, type SheetsBridgeOptions } from './platform-bridge'
import '@univerjs/preset-sheets-core/lib/index.css'
import './renderer/styles.css'

export interface SheetsAppProps extends SheetsBridgeOptions {
  /** UI language; this build ships English by default */
  language?: Lang
}

/**
 * Allternit Sheets — the full spreadsheet application (Univer grid, charts,
 * pivots, server-side IronCalc recalculation) mounted as a single component.
 * Installs the browser `window.desktopApi` bridge the vendored renderer
 * expects; workbook sessions run through the office-engine gateway.
 */
export function SheetsApp({ language = 'en', document: initialDocument, onSave }: SheetsAppProps) {
  // install synchronously (once) so App's mount effects always see the bridge
  const installed = useRef(false)
  if (!installed.current) {
    installed.current = true
    setModuleLang(language)
    document.documentElement.lang = htmlLang(language)
    installDesktopBridge({
      ...(initialDocument ? { document: initialDocument } : {}),
      ...(onSave ? { onSave } : {}),
    })
  }
  return (
    <LocaleProvider initial={language}>
      <App />
    </LocaleProvider>
  )
}
