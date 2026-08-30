import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { loadDuctorOfficeAssets } from './ductor/ductorOfficeAssets.js';
import { isBrowserRuntime } from './runtime';
import { RuntimeRoot } from './RuntimeRoot.js';

async function main() {
  if (isBrowserRuntime) {
    if (import.meta.env.DEV) {
      // browserMock is for Vite dev mode only (UI prototyping without a server).
      const { initBrowserMock } = await import('./browserMock.js');
      await initBrowserMock();
    } else {
      // The standalone Ductor route bypasses App/useExtensionMessages, so it
      // must initialize the canonical OfficeCanvas assets before mounting.
      await loadDuctorOfficeAssets();
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RuntimeRoot />
    </StrictMode>,
  );
}

main().catch(console.error);
