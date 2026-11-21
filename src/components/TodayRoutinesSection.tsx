import { memo, useRef, useState } from 'react';
import {
  Check,
  Flame,
  Plus,
  RotateCcw,
  SkipForward,
  Clock,
} from 'lucide-react';
import type { TodayRoutineItem } from '../hooks/useRoutines';

type TodayRoutinesSectionProps = {
  items: TodayRoutineItem[];
  doneCount: number;
  totalPlanned: number;
  totalRoutinesCount: number;
  onToggle: (routineId: string) => void;
  onIncrement: (routineId: string) => void;
  onSkip: (routineId: string) => void;
  onOpenManager: (routineId?: string) => void;
};

const SPARKLE_BURSTS = [
  { tx: '10px', ty: '-10px', color: '#10B981', size: 3.5 },
  { tx: '-10px', ty: '-10px', color: '#34D399', size: 3 },
  { tx: '13px', ty: '2px', color: '#FBBF24', size: 3 },
  { tx: '-13px', ty: '2px', color: '#6EE7B7', size: 3 },
  { tx: '9px', ty: '10px', color: '#34D399', size: 3 },
  { tx: '-9px', ty: '10px', color: '#10B981', size: 3 },
];

type RoutineRowCardProps = {
  item: TodayRoutineItem;
  onToggle: (routineId: string) => void;
  onIncrement: (routineId: string) => void;
  onSkip: (routineId: string) => void;
  onOpenDetail: (routineId: string) => void;
};

const RoutineRowCard = memo(function RoutineRowCard({
  item,
  onToggle,
  onIncrement,
  onSkip,
  onOpenDetail,
}: RoutineRowCardProps) {
  const { routine, log, streak } = item;
  const [justCompleted, setJustCompleted] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const leftActionRef = useRef<HTMLDivElement>(null);
  const rightActionRef = useRef<HTMLDivElement>(null);
  const offsetXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const didSwipeRef = useRef(false);

  const isDone = log.status === 'done' || justCompleted;
  const isSkipped = log.status === 'skipped';
  const targetCount = Math.max(1, log.target_count || routine.target_count);
  const currentCount = isDone ? targetCount : log.count;
  const isCounterRoutine = targetCount > 1;
  const progressPct = Math.min(100, Math.round((currentCount / targetCount) * 100));

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  };

  const applySwipeVisuals = (x: number, dragging: boolean) => {
    offsetXRef.current = x;
    if (cardRef.current) {
      cardRef.current.style.transition = dragging
        ? 'none'
        : 'transform 190ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    if (leftActionRef.current) {
      leftActionRef.current.style.opacity = x > 6 ? String(Math.min(1, x / 54)) : '0';
    }
    if (rightActionRef.current) {
      rightActionRef.current.style.opacity = x < -6 ? String(Math.min(1, Math.abs(x) / 54)) : '0';
    }
  };

  const handleToggle = () => {
    if (!isDone) {
      setJustCompleted(true);
      triggerVibrate([15, 25]);
      setTimeout(() => setJustCompleted(false), 380);
    } else {
      triggerVibrate(10);
    }
    onToggle(routine.id);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willFinish = currentCount + 1 >= targetCount && !isDone;
    if (willFinish) {
      setJustCompleted(true);
      triggerVibrate([15, 25]);
      setTimeout(() => setJustCompleted(false), 380);
    } else {
      triggerVibrate(12);
    }
    onIncrement(routine.id);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;

    startXRef.current = e.clientX - offsetXRef.current;
    startYRef.current = e.clientY;
    isHorizontalSwipeRef.current = null;
    isDraggingRef.current = true;
    didSwipeRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || startXRef.current === null || startYRef.current === null) {
      return;
    }

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX)) {
        isHorizontalSwipeRef.current = false;
        isDraggingRef.current = false;
        return;
      }
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isHorizontalSwipeRef.current = true;
        didSwipeRef.current = true;
      }
    }

    if (isHorizontalSwipeRef.current === true) {
      const clamped = Math.max(-120, Math.min(115, deltaX));
      applySwipeVisuals(clamped, true);
    }
  };

  const finishPointerDrag = (cancelled: boolean) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const finalX = offsetXRef.current;
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;

    if (!cancelled && finalX > 60) {
      applySwipeVisuals(0, false);
      handleToggle();
    } else if (!cancelled && finalX < -64) {
      applySwipeVisuals(0, false);
      triggerVibrate(16);
      onSkip(routine.id);
    } else {
      applySwipeVisuals(0, false);
    }
  };

  if (isSkipped) {
    return (
      <div
        className="rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 opacity-65 transition-opacity"
        style={{ background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <span className="text-xs text-app-muted line-through truncate">
            {routine.title}
          </span>
          <span className="text-xs text-app-muted flex-shrink-0">· Atlandı</span>
        </div>
        <button
          type="button"
          onClick={() => onSkip(routine.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 px-2 min-h-[36px] rounded-lg cursor-pointer"
          aria-label="Atlamayı geri al"
        >
          <RotateCcw size={12} />
          <span>Geri Al</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden select-none">
      {/* ─── Kaydırma Arka Planı (Sağ = Tamamla, Sol = Bugün Atla) ─── */}
      <div className="absolute inset-0 flex items-center justify-between rounded-2xl overflow-hidden pointer-events-none">
        <div
          ref={leftActionRef}
          className="h-full flex items-center pl-3.5 pr-5"
          style={{
            background: 'linear-gradient(90deg, #10B981, #059669)',
            opacity: 0,
            width: '55%',
          }}
        >
          <div className="flex items-center gap-1.5 text-white font-semibold text-xs">
            <Check size={14} strokeWidth={2.8} />
            <span>{isDone ? 'Geri Al' : 'Tamamla'}</span>
          </div>
        </div>

        <div
          ref={rightActionRef}
          className="h-full flex items-center justify-end pr-3.5 pl-5 ml-auto"
          style={{
            background: 'linear-gradient(270deg, #64748B, #475569)',
            opacity: 0,
            width: '55%',
          }}
        >
          <div className="flex items-center gap-1.5 text-white font-semibold text-xs">
            <span>Bugün Atla</span>
            <SkipForward size={13} />
          </div>
        </div>
      </div>

      {/* ─── Sakin, Tek Tip Kompakt Rutin Satırı ─── */}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => finishPointerDrag(false)}
        onPointerCancel={() => finishPointerDrag(true)}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && isDraggingRef.current) {
            finishPointerDrag(false);
          }
        }}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          onOpenDetail(routine.id);
        }}
        className={`relative rounded-2xl px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer ${
          isDone ? 'opacity-70 bg-surface/75' : 'bg-surface hover:bg-surface-hover'
        }`}
        style={{
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
      >
        {/* Sol: Onay Kutusu (44x44px Dokunma Alanı) */}
        <div className="relative flex-shrink-0 -ml-1.5">
          {justCompleted && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
              {SPARKLE_BURSTS.map((sb, idx) => (
                <span
                  key={idx}
                  className="absolute rounded-full animate-sparkle-burst"
                  style={
                    {
                      '--tx': sb.tx,
                      '--ty': sb.ty,
                      width: `${sb.size}px`,
                      height: `${sb.size}px`,
                      backgroundColor: sb.color,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            aria-label={isDone ? `${routine.title} rutinini geri al` : `${routine.title} rutinini tamamla`}
            className="w-11 h-11 -my-2 flex items-center justify-center cursor-pointer"
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-150 ${
                justCompleted ? 'animate-check-elastic' : ''
              }`}
              style={
                isDone
                  ? {
                      background: 'var(--success)',
                      border: '1.5px solid var(--success)',
                    }
                  : {
                      background: 'transparent',
                      border: '1.5px solid var(--primary-light)',
                    }
              }
            >
              {isDone && (
                <svg
                  className="w-3 h-3 text-white animate-checkmark-draw"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
          </button>
        </div>

        {/* Orta: Sade Başlık + İsteğe Bağlı Saat / Sayaç İlerlemesi */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative min-w-0 inline-block max-w-full">
              <span
                className={`text-sm font-medium truncate block ${
                  isDone ? 'text-app-muted' : 'text-app-primary'
                }`}
              >
                {routine.title}
              </span>
              {isDone && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-emerald-500/80 rounded-full animate-strike-draw pointer-events-none"
                  style={{ width: '100%' }}
                />
              )}
            </span>

            {routine.time && (
              <span className="inline-flex items-center gap-1 text-xs text-app-muted tabular-nums flex-shrink-0">
                <Clock size={11} aria-hidden="true" />
                <span>{routine.time}</span>
              </span>
            )}
          </div>

          {isCounterRoutine && (
            <div className="flex items-center gap-2 mt-1">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden max-w-[100px]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${progressPct}%`,
                    background: isDone ? 'var(--success)' : 'var(--primary)',
                  }}
                />
              </div>
              <span className="text-xs font-medium text-app-secondary tabular-nums">
                {currentCount}/{targetCount}
              </span>
            </div>
          )}
        </div>

        {/* Sağ: Sayaçlıysa +1 Butonu + Sessiz Seri Göstergesi */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCounterRoutine && !isDone && (
            <button
              type="button"
              onClick={handleIncrement}
              aria-label={`${routine.title} sayacını 1 artır`}
              className="min-w-[36px] h-8 px-2.5 rounded-xl text-xs font-semibold text-white transition-transform active:scale-90 cursor-pointer"
              style={{ background: 'var(--primary)' }}
            >
              +1
            </button>
          )}

          {streak > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-xs font-medium text-app-secondary tabular-nums"
              title={`${streak} günlük rutin serisi`}
            >
              <Flame size={12} className="text-amber-400" aria-hidden="true" />
              <span>{streak}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export const TodayRoutinesSection = memo(function TodayRoutinesSection({
  items,
  doneCount,
  totalPlanned,
  totalRoutinesCount,
  onToggle,
  onIncrement,
  onSkip,
  onOpenManager,
}: TodayRoutinesSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (totalRoutinesCount === 0) {
    return (
      <div className="px-4 mb-4">
        <button
          type="button"
          onClick={() => onOpenManager()}
          className="w-full min-h-[44px] rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors hover:bg-surface-hover cursor-pointer"
          style={{ background: 'var(--surface)' }}
        >
          <span className="text-xs font-medium text-app-secondary truncate">
            Günlük rutin ekle (Su iç, Kitap oku, Spor…)
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 flex-shrink-0">
            <Plus size={13} />
            <span>Ekle</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <section className="px-4 mb-4 select-none" aria-label="Bugünün rutinleri">
      {/* Başlık Satırı: "RUTİNLER · 1/3" + Yönet */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex items-center gap-2 min-h-[32px] text-left cursor-pointer"
        >
          <span className="text-app-muted text-xs font-medium uppercase">
            Rutinler
          </span>
          <span className="text-xs font-semibold text-app-secondary tabular-nums">
            {doneCount}/{totalPlanned}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenManager()}
          className="text-xs font-medium text-app-muted hover:text-app-primary px-2 min-h-[32px] inline-flex items-center rounded-lg transition-colors cursor-pointer"
          aria-label="Rutinleri yönet"
        >
          Yönet
        </button>
      </div>

      {/* Bugünün Planlı Rutin Satırları */}
      {!collapsed &&
        (items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <RoutineRowCard
                key={item.routine.id}
                item={item}
                onToggle={onToggle}
                onIncrement={onIncrement}
                onSkip={onSkip}
                onOpenDetail={(routineId) => onOpenManager(routineId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-app-muted py-1">
            Bugün için planlı rutin yok.
          </p>
        ))}
    </section>
  );
});
