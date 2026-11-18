import { Flame } from 'lucide-react';

type ProgressWidgetProps = {
  activeCount: number;
  completedCount: number;
  streak?: number;
};

export function ProgressWidget({
  activeCount,
  completedCount,
  streak = 1,
}: ProgressWidgetProps) {
  const total = activeCount + completedCount;
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isAllDone = total > 0 && percentage === 100;

  // Motivasyon mesajı yalnızca anlamlı anlarda (ilk görev bittiğinde veya %100 olduğunda) gösterilir
  const milestoneMessage = (() => {
    if (isAllDone) return 'Tümü tamamlandı!';
    if (completedCount === 1 && activeCount > 0) return 'Harika başlangıç!';
    return null;
  })();

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="rounded-2xl px-3.5 py-2.5 border transition-colors duration-200 flex items-center gap-3 min-h-[56px]"
      style={{
        background: 'var(--surface)',
        borderColor: isAllDone ? 'rgba(16, 185, 129, 0.35)' : 'var(--border)',
      }}
    >
      {/* Sol: Küçük İlerleme Halkası (%0) */}
      <div
        className={`relative w-10 h-10 flex items-center justify-center flex-shrink-0 ${
          isAllDone ? 'animate-ring-celebrate' : ''
        }`}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 38 38">
          <circle
            cx="19"
            cy="19"
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="3.5"
          />
          <circle
            cx="19"
            cy="19"
            r={radius}
            fill="none"
            stroke={isAllDone ? '#10B981' : '#6366F1'}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <span
          className={`absolute text-xs font-bold tabular-nums tracking-tight ${
            isAllDone ? 'text-emerald-400' : 'text-app-primary'
          }`}
        >
          %{percentage}
        </span>
      </div>

      {/* Orta: "X/Y tamamlandı" + İnce İlerleme Çubuğu (+ anlamlıysa kısa mesaj) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-app-primary text-xs font-semibold tracking-tight flex-shrink-0">
            {total > 0 ? `${completedCount}/${total} tamamlandı` : 'Henüz görev yok'}
          </p>
          {milestoneMessage && (
            <span className="text-emerald-400 text-xs font-medium truncate">
              {milestoneMessage}
            </span>
          )}
        </div>

        <div
          className="w-full h-1 rounded-full overflow-hidden mt-1.5"
          style={{ background: 'var(--surface-2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${percentage}%`,
              background: isAllDone ? '#10B981' : '#6366F1',
            }}
          />
        </div>
      </div>

      {/* Sağ: Seri Bilgisi (🔥 6) */}
      <div
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold flex-shrink-0"
        style={{
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#FBBF24',
        }}
        title={`${streak} günlük seri`}
      >
        <Flame size={13} className="fill-amber-400 text-amber-400" aria-hidden="true" />
        <span className="tabular-nums">{streak}</span>
      </div>
    </div>
  );
}
