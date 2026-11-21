import React, { useEffect, useState } from 'react';

type NetworkInfo = {
  saveData?: boolean;
};

/**
 * Düşük güçlü veya veri tasarrufu modundaki cihazları tespit eder;
 * bu cihazlarda arka plan sade ve tamamen statik moda düşer.
 */
function detectLowPowerMode(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return true;

  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (conn?.saveData) return true;

  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) {
    return true;
  }
  return false;
}

/**
 * BackgroundAnimation ("Horizon Flow")
 * ─────────────────────────────────────────────────────────────────────────────
 * FlowDay kimliğine özel, gece (Obsidian Twilight) ve gündüz (Warm Daylight Paper)
 * atmosferlerini tek bir tasarım dilinde birleştiren katmanlı arka plan.
 *
 * - Tüm renkler CSS değişkenlerinden (--bg-*) gelir; sabit renk kodu içermez.
 * - Saf CSS gradient + 1 KB altı satır içi SVG ile 60 fps ve sıfır harici ağ yükü.
 * - Sekme arka plandayken (visibilitychange) ve prefers-reduced-motion durumunda
 *   tüm hareket otomatik olarak durur.
 */
export const BackgroundAnimation: React.FC = () => {
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLowPower] = useState<boolean>(() => detectLowPowerMode());

  useEffect(() => {
    const handleVisibility = () => {
      setIsPaused(document.visibilityState === 'hidden');
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const staticClass = isPaused || isLowPower ? 'flowday-bg-static' : '';

  return (
    <div
      className={`flowday-bg-root fixed inset-0 pointer-events-none z-0 overflow-hidden select-none ${staticClass}`}
      aria-hidden="true"
    >
      {/* 1. Yönlü Atmosferik Temel Katman */}
      <div className="flowday-bg-canvas" />

      {/* 2. Yumuşak Ortam Işık Havuzları (GPU translate3d, düşük güçte statik) */}
      <div className="flowday-bg-orb flowday-bg-orb-primary" />
      <div className="flowday-bg-orb flowday-bg-orb-secondary" />

      {/* 3. Planlayıcı Defteri İnce Nokta Izgarası (Kenarlara Doğru Yumuşak Maskeli) */}
      <div className="flowday-bg-grid" />

      {/* 4. Minimal FlowDay Akış Konturu (Hafif Satır İçi SVG) */}
      {!isLowPower && (
        <svg
          className="flowday-bg-contour"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-120 260 C 240 140, 560 390, 920 250 C 1180 150, 1360 210, 1560 150"
            stroke="var(--bg-contour-stroke)"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-120 315 C 270 200, 580 445, 950 305 C 1200 210, 1380 265, 1560 215"
            stroke="var(--bg-contour-stroke-2)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-100 710 C 310 590, 660 800, 1060 660 C 1270 590, 1410 640, 1560 600"
            stroke="var(--bg-contour-stroke-2)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
};
