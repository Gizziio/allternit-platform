import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Office.js must be initialized before rendering
Office.onReady(() => {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element not found')

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
