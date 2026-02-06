// Minimal service worker so the app is installable as a PWA.
// Network is always used; this file mostly exists to satisfy PWA requirements.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

