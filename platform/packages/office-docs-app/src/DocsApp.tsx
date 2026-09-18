import { useRef } from 'react'
import type { ReactNode } from 'react'
import { App } from './renderer/App'
import { LocaleProvider, setModuleLang } from './renderer/i18n/locale'
import { htmlLang, type Lang } from './renderer/i18n/i18n-core'
import { installDesktopBridge, type DesktopBridgeOptions } from './platform-bridge'
import './renderer/styles.css'
import './renderer/fonts/fonts.css'

export interface DocsAppProps extends DesktopBridgeOptions {
  /** UI language; this build ships English by default */
  language?: Lang
  /** extra content rendered above the editor (dev harness hooks) */
  children?: ReactNode
}

/**
 * Allternit Docs — the full editor application (ribbon, pagination, comments,
 * styles, find panel) mounted as a single component. Installs the browser
 * `window.desktop` bridge and the locale context the vendored renderer
 * expects.
 */
export function DocsApp({ language = 'en', document: initialDocument, onSave, children }: DocsAppProps) {
  // install synchronously (once) so App's mount effects always see the bridge
  const installed = useRef(false)
  if (!installed.current) {
    installed.current = true
    setModuleLang(language)
    document.documentElement.lang = htmlLang(language)
    installDesktopBridge({ document: initialDocument, onSave })
  }
  return (
    <LocaleProvider initial={language}>
      {children}
      <App />
    </LocaleProvider>
  )
}
