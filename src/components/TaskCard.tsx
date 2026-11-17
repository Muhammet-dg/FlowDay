import { memo, useMemo, useRef, useState } from 'react';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Bell,
  Clock,
  Timer,
  RotateCcw,
  Check,
  FolderKanban,
  ListChecks,
  Plus,
} from 'lucide-react';
import type { Project, Subtask, Task } from '../types';
import { PRIORITY_CONFIG, CATEGORY_CONFIG } from '../types';

type TaskCardProps = {
  task: Task;
  project?: Project | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze?: (id: string, mode: '1h' | 'tomorrow') => void;
  onFocus?: (task: Task) => void;
  onUpdateSubtasks?: (taskId: string, subtasks: Subtask[]) => void;
};

// Mikro-parçacık yön ve renkleri (Checkbox patlama efekti)
const SPARKLE_BURSTS = [
  { tx: '14px', ty: '-14px', color: '#10B981', size: 4 },
  { tx: '-14px', ty: '-14px', color: '#34D399', size: 3.5 },
  { tx: '18px', ty: '2px', color: '#FBBF24', size: 3 },
  { tx: '-18px', ty: '2px', color: '#6EE7B7', size: 4 },
  { tx: '12px', ty: '14px', color: '#34D399', size: 3.5 },
  { tx: '-12px', ty: '14px', color: '#10B981', size: 3 },
  { tx: '0px', ty: '-18px', color: '#A7F3D0', size: 3 },
  { tx: '0px', ty: '18px', color: '#059669', size: 3 },
];

export const TaskCard = memo(function TaskCard({
  task,
  project,
  onToggle,
  onDelete,
  onSnooze,
  onFocus,
  onUpdateSubtasks,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snoozedFeedback, setSnoozedFeedback] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [exitingComplete, setExitingComplete] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // ── Zero-rerender Swipe Refs ───────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const leftActionRef = useRef<HTMLDivElement>(null);
  const rightActionRef = useRef<HTMLDivElement>(null);
  const offsetXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const didSwipeRef = useRef(false);

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const categoryKey = task.category ?? (task.priority === 'high' ? 'urgent' : 'personal');
  const categoryCfg = CATEGORY_CONFIG[categoryKey];

  const isVisuallyCompleted = task.completed || justCompleted;
  const isExiting = deleting || exitingComplete;
  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  const applySwipeVisuals = (x: number, dragging: boolean) => {
    offsetXRef.current = x;
    if (cardRef.current) {
      cardRef.current.style.transition = dragging
        ? 'none'
        : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    if (leftActionRef.current) {
      leftActionRef.current.style.opacity = x > 6 ? String(Math.min(1, x / 56)) : '0';
    }
    if (rightActionRef.current) {
      rightActionRef.current.style.opacity = x < -6 ? String(Math.min(1, Math.abs(x) / 56)) : '0';
    }
  };

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  };

  const handleToggleAction = () => {
    if (justCompleted || deleting || exitingComplete) return;

    if (!task.completed) {
      setJustCompleted(true);
      triggerVibrate([15, 30]);

      setTimeout(() => {
        setExitingComplete(true);
      }, 200);

      setTimeout(() => {
        onToggle(task.id);
      }, 400);
    } else {
      triggerVibrate(12);
      onToggle(task.id);
    }
  };

  const handleDelete = () => {
    if (deleting) return;
    triggerVibrate(20);
    applySwipeVisuals(-90, false);
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 240);
  };

  const handleSnooze = (mode: '1h' | 'tomorrow') => {
    applySwipeVisuals(0, false);
    if (onSnooze) {
      onSnooze(task.id, mode);
      setSnoozedFeedback(mode === '1h' ? '1 saat ertelendi' : 'Yarına ertelendi');
      setTimeout(() => setSnoozedFeedback(null), 2000);
    }
  };

  const handleToggleSubtask = (subId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    triggerVibrate(10);
    onUpdateSubtasks(task.id, updated);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !onUpdateSubtasks) return;
    const next: Subtask = {
      id: crypto.randomUUID(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    onUpdateSubtasks(task.id, [...subtasks, next]);
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = (subId: string) => {
    if (!onUpdateSubtasks) return;
    onUpdateSubtasks(
      task.id,
      subtasks.filter((s) => s.id !== subId)
    );
  };

  // ── Pointer Handlers (60fps DOM Ref Swipe + Native Vertical Scroll) ─────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (deleting || justCompleted || exitingComplete) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea')) return;

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
      const clamped = Math.max(-135, Math.min(115, deltaX));
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

    if (!cancelled && finalX > 64) {
      applySwipeVisuals(0, false);
      handleToggleAction();
    } else if (!cancelled && finalX < -72) {
      handleDelete();
    } else {
      applySwipeVisuals(0, false);
    }
  };

  const formattedTime = useMemo(
    () =>
      new Date(task.created_at).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [task.created_at]
  );

  const reminderLabel = useMemo(
    () =>
      task.reminder_time
        ? new Date(task.reminder_time).toLocaleString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    [task.reminder_time]
  );

  return (
    <div
      className={`
        grid transition-[grid-template-rows,opacity,transform,margin] duration-220 ease-out select-none group
        ${!isExiting ? 'animate-task-in grid-rows-[1fr] opacity-100 scale-100' : ''}
        ${deleting ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-x-4 !mt-0 !mb-0 pointer-events-none' : ''}
        ${exitingComplete && !deleting ? 'grid-rows-[0fr] opacity-0 scale-95 translate-x-4 !mt-0 !mb-0 pointer-events-none' : ''}
      `}
    >
      <div className="overflow-hidden min-h-0 relative rounded-2xl">
        {/* ─── Arka Plan Kaydırma Katmanı (Swipe Backgrounds) ─── */}
        <div className="absolute inset-0 flex items-center justify-between rounded-2xl overflow-hidden pointer-events-none">
          {/* Sağa Kaydırınca Beliren Yeşil Tamamlama Şeridi */}
          <div
            ref={leftActionRef}
            className="h-full flex items-center pl-4 pr-6"
            style={{
              background: 'linear-gradient(90deg, #10B981, #059669)',
              opacity: 0,
              width: '55%',
            }}
          >
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                {task.completed ? <RotateCcw size={14} /> : <Check size={15} strokeWidth={2.8} />}
              </div>
              <span>{task.completed ? 'Geri Al' : 'Tamamla'}</span>
            </div>
          </div>

          {/* Sola Kaydırınca Beliren Kırmızı Çöp İkonu Şeridi */}
          <div
            ref={rightActionRef}
            className="h-full flex items-center justify-end pr-4 pl-6 ml-auto"
            style={{
              background: 'linear-gradient(270deg, #EF4444, #DC2626)',
              opacity: 0,
              width: '55%',
            }}
          >
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <span>Sil</span>
              <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                <Trash2 size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Ön Plan Görev Kartı (60fps GPU-Hızlandırmalı) ─── */}
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
          className={`
            relative rounded-2xl border transition-colors overflow-hidden
            ${isVisuallyCompleted ? 'opacity-75 bg-surface/80' : 'bg-surface hover:bg-surface-hover'}
            shadow-sm
          `}
          style={{
            borderColor: isVisuallyCompleted ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-strong)',
            touchAction: 'pan-y',
            willChange: 'transform',
          }}
        >
          {/* Görev tamamlandığında kart üzerinden geçen zümrüt ışığı (Sheen wave) */}
          {justCompleted && (
            <div
              className="absolute inset-0 pointer-events-none z-20 animate-complete-sheen"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.24) 50%, transparent 100%)',
              }}
            />
          )}

          {/* Sol Öncelik / Proje Çizgisi (Minimalist Glow Strip) */}
          <div
            className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full transition-colors duration-200"
            style={{
              background: isVisuallyCompleted
                ? '#10B981'
                : project?.color ?? priorityCfg.hex,
            }}
          />

          <div className="p-3.5 pl-4 sm:p-4 sm:pl-4.5">
            <div className="flex items-start gap-3">
              {/* ─── Dairesel Mikro-Etkileşimli Checkbox ─── */}
              <div className="relative mt-0.5 flex-shrink-0">
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

                {justCompleted && (
                  <div className="absolute inset-0 rounded-full animate-ripple-ring pointer-events-none z-10" />
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAction();
                  }}
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-150 cursor-pointer
                    active:scale-90
                    ${justCompleted ? 'animate-check-elastic' : ''}
                  `}
                  style={
                    isVisuallyCompleted
                      ? {
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          border: '1.5px solid #10B981',
                        }
                      : {
                          background: 'var(--surface-2)',
                          border: `1.5px solid ${priorityCfg.hex}85`,
                        }
                  }
                  aria-label={isVisuallyCompleted ? 'Görevi geri al' : 'Görevi tamamla'}
                >
                  {isVisuallyCompleted && (
                    <svg
                      className="w-3.5 h-3.5 text-white animate-checkmark-draw"
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
                </button>
              </div>

              {/* ─── Görev İçeriği & Başlık ─── */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  if (didSwipeRef.current) {
                    didSwipeRef.current = false;
                    return;
                  }
                  if (offsetXRef.current !== 0) {
                    applySwipeVisuals(0, false);
                    return;
                  }
                  setExpanded((v) => !v);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="relative min-w-0 pr-1 inline-block">
                    <p
                      className={`text-[14px] sm:text-[15px] font-semibold leading-snug tracking-tight transition-colors duration-200 ${
                        isVisuallyCompleted ? 'text-app-muted' : 'text-app-primary'
                      }`}
                    >
                      {task.title}
                    </p>

                    {isVisuallyCompleted && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.75px] bg-emerald-500/85 rounded-full animate-strike-draw pointer-events-none"
                        style={{ width: '100%' }}
                      />
                    )}
                  </div>

                  {/* Sağ Aksiyon İkonları */}
                  <div
                    className="flex items-center gap-0.5 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!task.completed && onSnooze && (
                      <button
                        type="button"
                        onClick={() => handleSnooze('tomorrow')}
                        title="Yarın 09:00'a ertele"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors active:scale-90"
                        aria-label="Yarına ertele"
                      >
                        <Clock size={13} />
                      </button>
                    )}

                    {!task.completed && onFocus && (
                      <button
                        type="button"
                        onClick={() => onFocus(task)}
                        title="Odaklanma Modunu Başlat (25 dk)"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors active:scale-90"
                        aria-label="Göreve odaklan"
                      >
                        <Timer size={14} />
                      </button>
                    )}

                    {(task.note || subtasks.length > 0 || onUpdateSubtasks) && (
                      <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted hover:text-app-primary hover:bg-surface-2 transition-colors active:scale-90"
                        aria-label={expanded ? 'Detayları gizle' : 'Alt görev ve notları göster'}
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-90"
                      aria-label="Görevi sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* ─── Rafine Çip Etiketler ─── */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {project && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{
                        background: `${project.color}18`,
                        color: project.color,
                        border: `1px solid ${project.color}38`,
                      }}
                    >
                      <FolderKanban size={9} />
                      <span className="max-w-[95px] truncate">{project.name}</span>
                    </span>
                  )}

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryCfg.badgeBg} ${categoryCfg.badgeText}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: categoryCfg.dotColor }}
                    />
                    <span>{categoryCfg.shortLabel}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dotColor}`} />
                    <span>{priorityCfg.label}</span>
                  </span>

                  {subtasks.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{
                        background:
                          completedSubtasks === subtasks.length
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'var(--surface-2)',
                        color:
                          completedSubtasks === subtasks.length
                            ? '#34D399'
                            : 'var(--text-secondary)',
                      }}
                    >
                      <ListChecks size={10} />
                      <span>
                        {completedSubtasks}/{subtasks.length}
                      </span>
                    </span>
                  )}

                  <span className="text-app-muted text-[10px] font-medium px-0.5">
                    {formattedTime}
                  </span>

                  {reminderLabel && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{
                        background: 'var(--primary-dim)',
                        color: 'var(--primary-light)',
                        border: '1px solid rgba(99, 102, 241, 0.20)',
                      }}
                    >
                      <Bell size={9} strokeWidth={2.5} />
                      <span>{reminderLabel}</span>
                    </span>
                  )}

                  {snoozedFeedback && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 animate-fade-in">
                      <Clock size={9} />
                      <span>{snoozedFeedback}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Açılır Not & Alt Görevler (Checklist) Bölümü ─── */}
            {expanded && (
              <div
                className="mt-3 ml-9 pt-2.5 border-t border-app space-y-2.5 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                {task.note && (
                  <div className="flex items-start gap-2">
                    <FileText size={12} className="text-app-muted mt-0.5 flex-shrink-0" />
                    <p className="text-app-secondary text-xs leading-relaxed whitespace-pre-wrap">
                      {task.note}
                    </p>
                  </div>
                )}

                {onUpdateSubtasks && (
                  <div className="space-y-1.5">
                    {subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(st.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                            style={
                              st.completed
                                ? { background: '#10B981', color: '#ffffff' }
                                : {
                                    border: '1.5px solid var(--text-muted)',
                                    background: 'transparent',
                                  }
                            }
                          >
                            {st.completed && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span
                            className={`text-xs truncate ${
                              st.completed ? 'line-through text-app-muted' : 'text-app-primary'
                            }`}
                          >
                            {st.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(st.id)}
                          className="text-app-muted hover:text-red-400 p-0.5"
                          aria-label="Alt görevi sil"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}

                    {!task.completed && (
                      <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5 pt-0.5">
                        <input
                          type="text"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          placeholder="Alt adım ekle…"
                          maxLength={80}
                          className="select-text flex-1 bg-transparent text-xs text-app-primary placeholder-app-muted outline-none px-2 py-1 rounded-lg border"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--bg-2)',
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!newSubtaskTitle.trim()}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white disabled:opacity-40 transition-all active:scale-95"
                          style={{ background: 'var(--primary)' }}
                        >
                          <Plus size={12} />
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
