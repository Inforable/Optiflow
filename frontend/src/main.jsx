import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { firebaseReady } from './lib/firebase';
import { startQueueWorker } from './lib/offlineQueue';
import './index.css';

// Firebase starts only when configured (anonymous sign-in); no-op in local and fixture mode.
firebaseReady().catch((err) => console.warn('Firebase init failed', err));
startQueueWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
