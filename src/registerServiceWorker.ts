// src/registerServiceWorker.ts

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Register sw.js at scope '/'
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          registration.onupdatefound = () => {
            const installing = registration.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.info('[VEGA OS] New update available.');
                  } else {
                    console.info('[VEGA OS] Shell cached for offline use.');
                  }
                }
              };
            }
          };
        })
        .catch(err => {
          console.warn('[VEGA OS] Service Worker registration skipped:', err);
        });
    });
  }
}
