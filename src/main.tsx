import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { WindowProvider } from './windows/WindowManager';
import { registerServiceWorker } from './registerServiceWorker';
import './style.css';

// Register PWA service worker
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WindowProvider>
      <App />
    </WindowProvider>
  </React.StrictMode>
);
