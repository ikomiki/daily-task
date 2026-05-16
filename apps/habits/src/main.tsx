import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { registerPwa } from './lib/pwa-register.js';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root が index.html に見つかりません');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA Service Worker 登録（vitest 環境では握り潰される）
void registerPwa();
