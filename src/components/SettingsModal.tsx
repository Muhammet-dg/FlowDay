import {
  X,
  LogOut,
  Sun,
  Moon,
  Bell,
  BellOff,
  Flame,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import type { SubscriptionStatus } from '../hooks/useNotifications';

type SettingsModalProps = {
  userEmail: string;
  theme: Theme;
  onToggleTheme: () => void;
  streak: number;
  notifPermission: NotificationPermission;
  notifStatus: SubscriptionStatus;
  onSubscribeNotif: () => void;
  onUnsubscribeNotif: () => void;
  onSignOut: () => void;
  onClose: () => void;
};

export function SettingsModal({
  userEmail,
  theme,
  onToggleTheme,
  streak,
  notifPermission,
  notifStatus,
  onSubscribeNotif,
  onUnsubscribeNotif,
  onSignOut,
  onClose,
}: SettingsModalProps) {
  const avatarLetter = userEmail[0]?.toUpperCase() ?? 'K';
  const isDark = theme === 'dark';
  const isNotifActive = notifStatus === 'subscribed';
  const isNotifLoading = notifStatus === 'subscribing' || notifStatus === 'checking';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm transition-opacity"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
      />

      {/* Modal Sheet */}
      <div
        className="relative w-full max-w-md border-t sm:border rounded-t-3xl sm:rounded-3xl pt-5 px-5 animate-slide-up shadow-2xl select-none"
        style={{
          background: 'var(--sheet-bg)',
          borderColor: 'var(--border-strong)',
          paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Handle bar (mobile) */}
        <div
          className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full"
          style={{ background: 'var(--border-strong)' }}
        />

        {/* Başlık */}
        <div className="flex items-center justify-between mt-1 mb-5">
          <div>
            <p className="text-app-muted text-[10px] font-bold uppercase tracking-widest">
              Hesap & Tercihler
            </p>
            <h2 className="text-app-primary text-lg font-bold tracking-tight mt-0.5">
              Profil ve Ayarlar
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-colors active:scale-90"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Kullanıcı Kartı */}
          <div
            className="rounded-2xl p-4 flex items-center justify-between border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base text-white flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                }}
              >
                {avatarLetter}
              </div>
              <div className="min-w-0">
                <p className="text-app-primary text-sm font-semibold truncate">{userEmail}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span className="text-app-muted text-xs">Bulut senkronizasyonu aktif</span>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#FBBF24',
                border: '1px solid rgba(245, 158, 11, 0.22)',
              }}
            >
              <Flame size={12} className="fill-amber-400 text-amber-400" />
              <span>{streak}g</span>
            </div>
          </div>

          {/* Görünüm / Tema Seçimi */}
          <div
            className="rounded-2xl p-3.5 flex items-center justify-between border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface-2)' }}
              >
                {isDark ? (
                  <Moon size={16} className="text-indigo-400" />
                ) : (
                  <Sun size={16} className="text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-app-primary text-xs font-semibold">Görünüm Teması</p>
                <p className="text-app-muted text-[11px]">
                  {isDark ? 'Obsidyen Koyu Tema' : 'Sıcak Editorial Açık Tema'}
                </p>
              </div>
            </div>

            <button
              onClick={onToggleTheme}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              {isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
            </button>
          </div>

          {/* Bildirim Durumu (Aç / Kapat) */}
          <div
            className="rounded-2xl p-3.5 flex items-center justify-between gap-3 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-2)' }}
              >
                {isNotifActive ? (
                  <Bell size={16} className="text-emerald-400" />
                ) : (
                  <BellOff size={16} className="text-app-muted" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-app-primary text-xs font-semibold">Anlık Bildirimler</p>
                <p className="text-app-muted text-[11px] truncate">
                  {isNotifActive
                    ? 'Hatırlatıcı bildirimleri açık'
                    : notifStatus === 'unsupported'
                      ? 'Tarayıcı desteklemiyor'
                      : notifPermission === 'denied'
                        ? 'Tarayıcı ayarlarından izin verin'
                        : 'Hatırlatıcı bildirimleri kapalı'}
                </p>
              </div>
            </div>

            {notifStatus === 'unsupported' ? (
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                Desteklenmiyor
              </span>
            ) : isNotifActive ? (
              <button
                type="button"
                onClick={onUnsubscribeNotif}
                disabled={isNotifLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.30)',
                  color: '#34D399',
                }}
              >
                Açık · Kapat
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubscribeNotif}
                disabled={isNotifLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 flex-shrink-0 cursor-pointer disabled:opacity-60"
                style={{ background: 'var(--primary)' }}
              >
                {isNotifLoading && <Loader2 size={12} className="animate-spin" />}
                <span>Etkinleştir</span>
              </button>
            )}
          </div>

          {/* Oturumu Kapat */}
          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="w-full mt-2 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98]"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.18)',
              color: '#F87171',
            }}
          >
            <LogOut size={14} />
            <span>Oturumu Kapat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
