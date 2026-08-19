import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initPdfWorker } from '@allternit/allternit-office-suite'
import { App } from './App'
import { ThemeProvider } from './ThemeProvider'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import './fonts.css'
import './theme.css'

initPdfWorker(pdfjsWorkerUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
