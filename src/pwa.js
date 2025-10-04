// src/pwa.js
import { registerSW } from 'virtual:pwa-register';

// Call this once on app load. It will tell you when a new version is ready.
export function initPWA(onNeedRefresh) {
  const updateSW = registerSW({
    immediate: true, // check on startup
    onNeedRefresh() {
      // hand back a function that will activate+reload when you’re ready
      onNeedRefresh(() => updateSW(true));
    },
    onOfflineReady() {
      // optional: show "Ready to work offline" toast if you want
    }
  });
}
