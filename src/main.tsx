import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize OneSignal
(window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
(window as any).OneSignalDeferred.push(async function(OneSignal: any) {
  await OneSignal.init({
    appId: "c3387e75-7457-4db6-bbe1-541307fc5bea",
    safari_web_id: "web.onesignal.auto.c3387e75-7457-4db6-bbe1-541307fc5bea",
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  });
  console.log('[OneSignal] Initialized');
});

// Register Service Worker for PWA caching/auto-update (separate from OneSignal)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
        setInterval(() => { registration.update(); }, 30000);
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version available, refreshing...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((error) => { console.log('SW registration failed:', error); });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
