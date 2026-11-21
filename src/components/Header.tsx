import { useState } from 'react';
import { Sun, Moon, Flame } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

type HeaderProps = {
  streak: number;
  theme: Theme;
  onToggleTheme: () => void;
  userEmail: string;
  onOpenSettings: () => void;
};

/**
 * Günlük seri rozeti — tek noktada tanımlıdır, istendiğinde tek satırda kaldırılabilir.
 */
function HeaderStreakBadge({ streak }: { streak: number }) {
  return (
    <div
      className="inline-flex items-center gap-1 px-2.5 h-8 rounded-full text-xs font-semibold tabular-nums flex-shrink-0"
      style={{
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
      }}
      title={`${streak} günlük seri`}
      aria-label={`${streak} günlük seri`}
    >
      <Flame size={13} className="text-amber-400 fill-amber-400" aria-hidden="true" />
      <span>{streak}</span>
    </div>
  );
}

export function Header({
  streak,
  theme,
  onToggleTheme,
  userEmail,
  onOpenSettings,
}: HeaderProps) {
  const [spinning, setSpinning] = useState(false);

  const avatarLetter = userEmail[0]?.toUpperCase() ?? 'K';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleToggle = () => {
    setSpinning(true);
    onToggleTheme();
    setTimeout(() => setSpinning(false), 420);
  };

  const isDark = theme === 'dark';

  return (
    <header
      className="px-4 pb-3 select-none"
      style={{
        paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Sol: Display Selamlama + Tarih */}
        <div className="min-w-0">
          <h1 className="text-app-primary text-2xl font-bold leading-tight truncate">
            {greeting()}
          </h1>
          <p className="text-app-secondary text-xs font-medium capitalize mt-0.5 truncate">
            {today}
          </p>
        </div>

        {/* Sağ: Sade Seri Rozeti + Tema + Profil (44x44px dokunma hedefi) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <HeaderStreakBadge streak={streak} />

          <button
            id="theme-toggle-btn"
            type="button"
            onClick={handleToggle}
            aria-label={isDark ? 'Gündüz moduna geç' : 'Gece moduna geç'}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-150 active:scale-95 text-app-secondary hover:text-app-primary cursor-pointer"
            style={{ background: 'var(--surface)' }}
          >
            {isDark ? (
              <Sun
                size={18}
                className={`text-amber-400 ${spinning ? 'animate-theme-toggle' : ''}`}
              />
            ) : (
              <Moon
                size={18}
                className={`text-slate-700 ${spinning ? 'animate-theme-toggle' : ''}`}
              />
            )}
          </button>

          <button
            id="user-menu-btn"
            type="button"
            onClick={onOpenSettings}
            aria-label="Profil ve Ayarlar"
            className="w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-sm transition-colors duration-150 active:scale-95 relative cursor-pointer"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
            }}
          >
            <span>{avatarLetter}</span>
            <span
              className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{
                background: 'var(--success)',
                boxShadow: '0 0 0 2px var(--bg)',
              }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
