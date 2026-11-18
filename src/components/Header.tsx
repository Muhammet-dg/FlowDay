import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import { ProgressWidget } from './ProgressWidget';

type HeaderProps = {
  activeCount: number;
  completedCount: number;
  streak: number;
  theme: Theme;
  onToggleTheme: () => void;
  userEmail: string;
  onOpenSettings: () => void;
};

export function Header({
  activeCount,
  completedCount,
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
        paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Kompakt Başlık Satırı (~64-72px) */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="text-app-primary text-xl font-bold tracking-tight leading-snug truncate">
            {greeting()}
          </h1>
          <p className="text-app-secondary text-xs font-medium capitalize mt-0.5 truncate">
            {today}
          </p>
        </div>

        {/* Sağ Kontroller: Tema & Profil/Ayarlar (44x44px dokunma alanı) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={handleToggle}
            aria-label={isDark ? 'Gündüz moduna geç' : 'Gece moduna geç'}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-150 active:scale-95 text-app-secondary hover:text-app-primary cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
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
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm transition-transform duration-150 active:scale-95 relative cursor-pointer"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <span>{avatarLetter}</span>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: '#10B981',
                borderColor: 'var(--bg)',
              }}
            />
          </button>
        </div>
      </div>

      {/* İnce Özet Şeridi (~56-64px) */}
      <ProgressWidget
        activeCount={activeCount}
        completedCount={completedCount}
        streak={streak}
      />
    </header>
  );
}
