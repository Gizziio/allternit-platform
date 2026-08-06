import { createRoot } from 'react-dom/client';
import AuthApp from './AuthApp.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(<AuthApp />);
