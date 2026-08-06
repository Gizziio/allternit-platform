import './install-globals'
import { useRef } from 'react'
import { App } from './renderer/App'
import { LocaleProvider, setModuleLang } from './renderer/i18n/locale'
import { htmlLang, type Lang } from './renderer/i18n/i18n-core'
import { installSlidesBridge, type SlidesBridgeOptions } from './platform-bridge'
import './renderer/styles.css'

// Registers window.slidesApi onto the in-process engine handlers.
import './preload/index'

export interface SlidesAppProps extends SlidesBridgeOptions {
  /** UI language; this build ships English by default */
  language?: Lang
}

/**
 * Allternit Slides — the full presentation editor (canvas, masters, charts,
 * animations) mounted as a single component. The vendored Electron main
 * process runs in-page via the IPC shim; window.slidesApi resolves against
 * the office engines directly.
 */
export function SlidesApp({ language = 'en', document: initialDocument, onSave }: SlidesAppProps) {
  const installed = useRef(false)
  if (!installed.current) {
    installed.current = true
    setModuleLang(language)
    document.documentElement.lang = htmlLang(language)
    installSlidesBridge({
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
