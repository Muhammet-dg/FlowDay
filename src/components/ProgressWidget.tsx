import { Sparkles, CheckCircle2 } from 'lucide-react';

type ProgressWidgetProps = {
  activeCount: number;
  completedCount: number;
};

const RING_SPARKLES = [
  { tx: '22px', ty: '-18px', color: '#10B981', size: 4 },
  { tx: '-22px', ty: '-16px', color: '#34D399', size: 3.5 },
  { tx: '24px', ty: '14px', color: '#FBBF24', size: 3.5 },
  { tx: '-20px', ty: '18px', color: '#6EE7B7', size: 4 },
];

export function ProgressWidget({ activeCount, completedCount }: ProgressWidgetProps) {
  const total = activeCount + completedCount;
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isAllDone = total > 0 && percentage === 100;

  const getMotivationalQuote = () => {
    if (total === 0) return 'Zihnini boşaltmak için ilk hedefini belirle.';
    if (percentage === 100) return 'Muazzam! Bugünün tüm hedeflerini tamamladın.';
    if (percentage >= 75) return 'Son düzlük, harika bir ritim yakaladın.';
    if (percentage >= 40) return 'İstikrarlı ilerliyorsun, odağını koru.';
    if (completedCount > 0) return 'İlk adım atıldı, devamı kendiliğinden gelecek.';
    return 'Küçük bir görevle başla, ivme kazan.';
  };

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: isAllDone ? 'rgba(16, 185, 129, 0.38)' : 'var(--border)',
        boxShadow: isAllDone ? '0 8px 28px rgba(16, 185, 129, 0.12)' : 'none',
      }}
    >
      {isAllDone && (
        <div
          className="absolute inset-0 pointer-events-none animate-complete-sheen"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.14) 50%, transparent 100%)',
          }}
        />
      )}

      <div className="flex items-center gap-4 relative z-10">
        {/* Dairesel İlerleme Halkası + %100 Kutlama */}
        <div
          className={`relative w-14 h-14 flex items-center justify-center flex-shrink-0 ${
            isAllDone ? 'animate-ring-celebrate' : ''
          }`}
        >
          {isAllDone && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {RING_SPARKLES.map((sp, i) => (
                <span
                  key={i}
                  className="absolute rounded-full animate-sparkle-burst"
                  style={
                    {
                      '--tx': sp.tx,
                      '--ty': sp.ty,
                      width: `${sp.size}px`,
                      height: `${sp.size}px`,
                      backgroundColor: sp.color,
                      boxShadow: `0 0 6px ${sp.color}`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <svg className="w-full h-full -rotate-90" viewBox="0 0 54 54">
            <circle
              cx="27"
              cy="27"
              r={radius}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="4.5"
            />
            <circle
              cx="27"
              cy="27"
              r={radius}
              fill="none"
              stroke={isAllDone ? '#10B981' : '#6366F1'}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <span
            className={`absolute text-xs font-bold tracking-tight ${
              isAllDone ? 'text-emerald-400' : 'text-app-primary'
            }`}
          >
            %{percentage}
          </span>
        </div>

        {/* Metin ve İnce Yatay İlerleme Çubuğu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-app-primary text-sm font-semibold tracking-tight truncate">
              {completedCount} tamamlandı,{' '}
              <span className="text-app-secondary font-medium">{activeCount} bekliyor</span>
            </p>
            {isAllDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 flex-shrink-0 animate-scale-in">
                <CheckCircle2 size={10} />
                <span>Tamam!</span>
              </span>
            )}
          </div>

          {/* Yatay İnce İlerleme Çubuğu */}
          <div
            className="w-full h-1.5 rounded-full overflow-hidden mt-2 mb-2"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${percentage}%`,
                background: isAllDone
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : 'linear-gradient(90deg, #6366F1, #818CF8)',
              }}
            />
          </div>

          {/* Motive Edici Editorial Söz */}
          <p className="text-app-muted text-[11px] font-medium flex items-center gap-1.5 truncate">
            <Sparkles
              size={11}
              className="flex-shrink-0"
              style={{ color: isAllDone ? '#34D399' : '#818CF8' }}
            />
            <span className="truncate">{getMotivationalQuote()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
