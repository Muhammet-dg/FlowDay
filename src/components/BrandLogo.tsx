import { useId } from 'react';

type BrandLogoProps = {
  size?: number;
  className?: string;
};

/**
 * FlowDay Marka Logosu
 * - Üst lavanta akış dalgası (Flow)
 * - Sıcak gün doğumu noktası (Day)
 * - Akıcı krem-nane onay tiki (Görev tamamlama)
 * PWA ikonları (icon-192, icon-512, maskable, apple-touch-icon, favicon) ile birebir aynı vektör geometri.
 */
export function BrandLogo({ size = 64, className = '' }: BrandLogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="FlowDay logosu"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="40" y1="24" x2="472" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#282147" />
          <stop offset="52%" stopColor="#1E1A33" />
          <stop offset="100%" stopColor="#151324" />
        </linearGradient>
        <radialGradient
          id={`${uid}-iris`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(132 118) rotate(42) scale(330 310)"
        >
          <stop offset="0%" stopColor="#8B7CF6" stopOpacity="0.52" />
          <stop offset="55%" stopColor="#6D62E8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#6D62E8" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={`${uid}-warm`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(392 396) rotate(-135) scale(280 260)"
        >
          <stop offset="0%" stopColor="#FB923C" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#FBBF24" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#FB923C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-wave`} x1="145" y1="194" x2="302" y2="162" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A9A1FF" />
          <stop offset="100%" stopColor="#F6F3FF" />
        </linearGradient>
        <linearGradient id={`${uid}-check`} x1="148" y1="292" x2="364" y2="224" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFDF9" />
          <stop offset="68%" stopColor="#F7F5FF" />
          <stop offset="100%" stopColor="#6EE7B7" />
        </linearGradient>
        <linearGradient id={`${uid}-sun`} x1="334" y1="132" x2="380" y2="182" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="52%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#FB923C" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill={`url(#${uid}-bg)`} />
      <rect width="512" height="512" rx="116" fill={`url(#${uid}-iris)`} />
      <rect width="512" height="512" rx="116" fill={`url(#${uid}-warm)`} />
      <rect x="6" y="6" width="500" height="500" rx="110" stroke="white" strokeOpacity="0.11" strokeWidth="4" />

      <path
        d="M 52 414 C 164 378, 294 446, 460 392"
        stroke="white"
        strokeOpacity="0.09"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 146 196 C 194 146, 250 146, 298 178"
        stroke={`url(#${uid}-wave)`}
        strokeWidth="34"
        strokeLinecap="round"
      />
      <circle cx="356" cy="158" r="25" fill={`url(#${uid}-sun)`} />
      <path
        d="M 150 288 C 178 318, 204 346, 222 354 C 234 359, 245 354, 256 340 L 360 228"
        stroke={`url(#${uid}-check)`}
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
