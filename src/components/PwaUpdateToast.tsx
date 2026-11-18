import { useEffect, useState, useRef } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function PwaUpdateToast() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const initialControllerRef = useRef<ServiceWorker | null>(
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker.controller
      : null
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isMounted = true;

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        waitingWorkerRef.current = reg.waiting;
        if (isMounted) setUpdateAvailable(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            waitingWorkerRef.current = newWorker;
            if (isMounted) setUpdateAvailable(true);
          }
        });
      });
    };

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        if (reg) {
          watchRegistration(reg);
          await reg.update();
        }
      } catch {
        // Çevrimdışı veya geliştirme ortamında sessizce geç
      }
    };

    void checkForUpdates();

    // Yeni Service Worker skipWaiting + clientsClaim ile kontrolü devraldığında bildir
    const handleControllerChange = () => {
      if (initialControllerRef.current && isMounted) {
        setUpdateAvailable(true);
      } else {
        initialControllerRef.current = navigator.serviceWorker.controller;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = setInterval(() => void checkForUpdates(), 30 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!updateAvailable) return null;

  const handleReload = () => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mt-2.5 mb-1 z-40 rounded-2xl px-3.5 py-2 border flex items-center justify-between gap-2.5 shadow-lg animate-fade-in"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--border-focus)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw size={13} className="text-indigo-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium text-app-primary truncate">
          Yeni sürüm hazır
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={handleReload}
          className="px-2.5 py-1 rounded-xl text-xs font-semibold text-white transition-transform active:scale-95 cursor-pointer"
          style={{ background: 'var(--primary)' }}
        >
          Yenile
        </button>
        <button
          type="button"
          onClick={() => setUpdateAvailable(false)}
          aria-label="Güncelleme bildirimini kapat"
          className="p-1 rounded-lg text-app-muted hover:text-app-secondary cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
