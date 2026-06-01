import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

const OFFICE_READY_TIMEOUT_MS = 1500

function renderApp() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element not found')

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

let rendered = false

function renderOnce() {
  if (rendered) return
  rendered = true
  renderApp()
}

if (typeof Office !== 'undefined' && typeof Office.onReady === 'function') {
  const fallback = window.setTimeout(() => {
    console.warn('[OfficeTaskpane] Office.onReady timeout; rendering companion-only mode')
    renderOnce()
  }, OFFICE_READY_TIMEOUT_MS)

  Office.onReady(() => {
    window.clearTimeout(fallback)
    renderOnce()
  })
} else {
  renderOnce()
}
