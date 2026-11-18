import { memo, useRef, useState } from 'react';
import {
  Check,
  Flame,
  Plus,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
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
        className="rounded-xl px-3 py-1.5 border flex items-center justify-between gap-2 opacity-60 transition-opacity"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs" aria-hidden="true">
            {routine.icon}
          </span>
          <span className="text-xs text-app-muted line-through truncate">
            {routine.title}
          </span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface text-app-muted">
            Bugün atlandı
          </span>
        </div>
        <button
          type="button"
          onClick={() => onSkip(routine.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg cursor-pointer"
          aria-label="Atlamayı geri al"
        >
          <RotateCcw size={11} />
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
          <div className="flex items-center gap-1.5 text-white font-bold text-xs">
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
          <div className="flex items-center gap-1.5 text-white font-bold text-xs">
            <span>Bugün Atla</span>
            <SkipForward size={13} />
          </div>
        </div>
      </div>

      {/* ─── Tek Satırlık Kompakt Rutin Kartı ─── */}
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
        className={`relative rounded-2xl border px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer ${
          isDone ? 'opacity-75 bg-surface/80' : 'bg-surface hover:bg-surface-hover'
        }`}
        style={{
          borderColor: isDone ? 'rgba(16, 185, 129, 0.30)' : 'var(--border)',
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
      >
        {/* Sol İnce Renk Şeridi */}
        <div
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
          style={{ background: isDone ? '#10B981' : routine.color }}
        />

        {/* Sol: Onay Kutusu (44x44px Dokunma Alanı) */}
        <div className="relative flex-shrink-0 -ml-1">
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
                      background: '#10B981',
                      border: '1.5px solid #10B981',
                    }
                  : {
                      background: 'transparent',
                      border: `1.5px solid ${routine.color}`,
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

        {/* Orta: İkon + Ad + "Rutin" Rozeti + Saat / İlerleme */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm flex-shrink-0" aria-hidden="true">
              {routine.icon}
            </span>
            <span className="relative min-w-0 inline-block max-w-full">
              <span
                className={`text-sm font-semibold truncate block ${
                  isDone ? 'text-app-muted' : 'text-app-primary'
                }`}
              >
                {routine.title}
              </span>
              {isDone && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-emerald-500/85 rounded-full animate-strike-draw pointer-events-none"
                  style={{ width: '100%' }}
                />
              )}
            </span>

            <span
              className="px-1.5 py-0.2 rounded text-xs font-semibold flex-shrink-0"
              style={{
                background: `${routine.color}18`,
                color: routine.color,
              }}
            >
              Rutin
            </span>

            {routine.time && (
              <span className="inline-flex items-center gap-0.5 text-xs text-app-secondary tabular-nums flex-shrink-0">
                <Clock size={11} aria-hidden="true" />
                <span>{routine.time}</span>
              </span>
            )}
          </div>

          {/* Sayaçlı Rutinse İnce İlerleme Çubuğu */}
          {isCounterRoutine && (
            <div className="flex items-center gap-2 mt-1">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden max-w-[110px]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${progressPct}%`,
                    background: isDone ? '#10B981' : routine.color,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-app-secondary tabular-nums">
                {currentCount}/{targetCount}
              </span>
            </div>
          )}
        </div>

        {/* Sağ: Sayaçlıysa +1 Butonu ve Küçük Seri (🔥 5) Göstergesi */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isCounterRoutine && !isDone && (
            <button
              type="button"
              onClick={handleIncrement}
              aria-label={`${routine.title} sayacını 1 artır`}
              className="min-w-[36px] h-8 px-2 rounded-xl text-xs font-bold text-white transition-transform active:scale-90 cursor-pointer"
              style={{ background: routine.color }}
            >
              +1
            </button>
          )}

          <div
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold tabular-nums"
            style={{
              background:
                streak > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-2)',
              color: streak > 0 ? '#FBBF24' : 'var(--text-muted)',
            }}
            title={`${streak} günlük rutin serisi`}
          >
            <Flame
              size={11}
              className={streak > 0 ? 'fill-amber-400 text-amber-400' : 'text-app-muted'}
              aria-hidden="true"
            />
            <span>{streak}</span>
          </div>
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

  // Hiç rutin tanımlanmamışsa tek satırlık sade davet çipi göster
  if (totalRoutinesCount === 0) {
    return (
      <div className="px-4 mb-3">
        <button
          type="button"
          onClick={() => onOpenManager()}
          className="w-full rounded-2xl px-3.5 py-2.5 border border-dashed flex items-center justify-between gap-2 text-left transition-colors hover:bg-surface/60 cursor-pointer"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm" aria-hidden="true">
              🔁
            </span>
            <span className="text-xs font-medium text-app-secondary truncate">
              Günlük rutin ekle (Su iç, Kitap oku, Spor…)
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary-light)' }}
          >
            <Plus size={12} />
            <span>Oluştur</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 mb-3 select-none">
      {/* Başlık Satırı: "Rutinler 3/5" + Yönet / Ekle */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="text-app-muted text-xs font-medium uppercase tracking-wider">
            Rutinler
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
            style={{
              background:
                totalPlanned > 0 && doneCount === totalPlanned
                  ? 'rgba(16, 185, 129, 0.14)'
                  : 'var(--surface)',
              color:
                totalPlanned > 0 && doneCount === totalPlanned
                  ? '#34D399'
                  : 'var(--text-secondary)',
            }}
          >
            {doneCount}/{totalPlanned}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenManager()}
          className="inline-flex items-center gap-1 text-xs font-medium text-app-secondary hover:text-app-primary px-2 py-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Rutinleri yönet"
        >
          <SlidersHorizontal size={12} />
          <span>Yönet</span>
        </button>
      </div>

      {/* Bugünün Planlı Rutin Kartları */}
      {!collapsed &&
        (items.length > 0 ? (
          <div className="space-y-1.5">
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
          <div
            className="rounded-xl px-3 py-2 border flex items-center justify-between text-xs text-app-secondary"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span>Bugün için planlı rutin yok.</span>
            <button
              type="button"
              onClick={() => onOpenManager()}
              className="text-indigo-300 font-semibold hover:underline cursor-pointer"
            >
              Rutinleri Gör
            </button>
          </div>
        ))}
    </div>
  );
});
