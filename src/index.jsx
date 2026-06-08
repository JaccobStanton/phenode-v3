import { createRoot } from 'react-dom/client';

// style.scss
import 'assets/style.css';

// scroll bar
import 'simplebar-react/dist/simplebar.min.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

// project imports
import App from './App';
import { ConfigProvider } from 'contexts/ConfigContext';

const container = document.getElementById('root');
const root = createRoot(container);

// Recover from stale lazy-loaded chunks after a new deploy. When a dynamic
// import fails because its old hashed file is no longer on the server, Vite
// fires 'vite:preloadError'. Force a one-time reload to fetch the current
// build. The time guard prevents a reload loop if a chunk is truly missing.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'vite-preload-reload-at';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

// ==============================|| MAIN - REACT DOM RENDER ||============================== //

root.render(
  <ConfigProvider>
    <App />
  </ConfigProvider>
);
