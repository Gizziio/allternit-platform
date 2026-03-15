/**
 * Thin Client Renderer Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThinClientApp } from './components/ThinClientApp';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThinClientApp />
  </React.StrictMode>
);
