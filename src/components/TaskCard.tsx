import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trash2,
  FileText,
  Bell,
  Clock,
  Timer,
  RotateCcw,
  Check,
  ListChecks,
  Plus,
  MoreHorizontal,
  Pencil,
  X,
  ArrowUpToLine,
  GripVertical,
} from 'lucide-react';
import type { Project, Subtask, Task } from '../types';
import { PRIORITY_CONFIG, CATEGORY_CONFIG } from '../types';

type TaskCardProps = {
  task: Task;
  project?: Project | null;
  isDragging?: boolean;
  canReorder?: boolean;
  isFirst?: boolean;
  onStartDrag?: (taskId: string, clientY: number) => void;
  onMoveToTop?: (taskId: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, title: string, note?: string) => void;
  onSnooze?: (id: string, mode: '1h' | 'tomorrow') => void;
  onFocus?: (task: Task) => void;
  onUpdateSubtasks?: (taskId: string, subtasks: Subtask[]) => void;
};

const SPARKLE_BURSTS = [
  { tx: '12px', ty: '-12px', color: '#10B981', size: 3.5 },
  { tx: '-12px', ty: '-12px', color: '#34D399', size: 3 },
  { tx: '15px', ty: '2px', color: '#FBBF24', size: 3 },
  { tx: '-15px', ty: '2px', color: '#6EE7B7', size: 3.5 },
  { tx: '10px', ty: '12px', color: '#34D399', size: 3 },
  { tx: '-10px', ty: '12px', color: '#10B981', size: 3 },
];

export const TaskCard = memo(function TaskCard({
  task,
  project,
  isDragging = false,
  canReorder = false,
  isFirst = false,
  onStartDrag,
  onMoveToTop,
  onToggle,
  onDelete,
  onEdit,
  onSnooze,
  onFocus,
  onUpdateSubtasks,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.note ?? '');
  const [deleting, setDeleting] = useState(false);
  const [snoozedFeedback, setSnoozedFeedback] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [exitingComplete, setExitingComplete] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Kart içi canlı kronometre (25 dk varsayılan)
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);

  // ── Zero-rerender Swipe Refs ───────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const leftActionRef = useRef<HTMLDivElement>(null);
  const rightActionRef = useRef<HTMLDivElement>(null);
  const offsetXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const didSwipeRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const categoryKey = task.category ?? (task.priority === 'high' ? 'urgent' : 'personal');
  const categoryCfg = CATEGORY_CONFIG[categoryKey];

  const isVisuallyCompleted = task.completed || justCompleted;
  const isExiting = deleting || exitingComplete;
  const isHighOrUrgent = task.priority === 'high' || categoryKey === 'urgent';
  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  // Dışarı tıklanınca "⋯" menüsünü kapat
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Kart içi kronometre sayacı
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const applySwipeVisuals = (x: number, dragging: boolean) => {
    offsetXRef.current = x;
    if (cardRef.current) {
      cardRef.current.style.transition = dragging
        ? 'none'
        : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)';
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
      setTimerActive(false);
      triggerVibrate([15, 30]);

      setTimeout(() => {
        setExitingComplete(true);
      }, 180);

      setTimeout(() => {
        onToggle(task.id);
      }, 360);
    } else {
      triggerVibrate(12);
      onToggle(task.id);
    }
  };

  const handleDelete = () => {
    if (deleting) return;
    setMenuOpen(false);
    triggerVibrate(20);
    applySwipeVisuals(-90, false);
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 220);
  };

  const handleSnooze = (mode: '1h' | 'tomorrow') => {
    setMenuOpen(false);
    applySwipeVisuals(0, false);
    if (onSnooze) {
      onSnooze(task.id, mode);
      setSnoozedFeedback(mode === '1h' ? '+1s ertelendi' : 'Yarına ertelendi');
      setTimeout(() => setSnoozedFeedback(null), 2000);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    if (onEdit) {
      onEdit(task.id, editTitle.trim(), editNote.trim() || undefined);
    }
    setIsEditing(false);
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

  // ── Pointer Handlers (60fps DOM Ref Swipe + Long-Press Reorder + Native Scroll) ──
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (deleting || justCompleted || exitingComplete || menuOpen || isEditing || isDragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea')) return;

    startXRef.current = e.clientX - offsetXRef.current;
    startYRef.current = e.clientY;
    isHorizontalSwipeRef.current = null;
    isDraggingRef.current = true;
    didSwipeRef.current = false;

    clearLongPressTimer();
    if (canReorder && onStartDrag && !task.completed) {
      const initialY = e.clientY;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        isDraggingRef.current = false;
        didSwipeRef.current = true;
        applySwipeVisuals(0, false);
        triggerVibrate(22);
        onStartDrag(task.id, initialY);
      }, 280);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || startXRef.current === null || startYRef.current === null) {
      return;
    }

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (Math.abs(deltaX) > 7 || Math.abs(deltaY) > 7) {
      clearLongPressTimer();
    }

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
    clearLongPressTimer();
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
        ? new Date(task.reminder_time).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    [task.reminder_time]
  );

  const formattedTimer = useMemo(() => {
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [timerSeconds]);

  const leftBarColor = isVisuallyCompleted
    ? '#10B981'
    : project?.color ?? (isHighOrUrgent ? '#EF4444' : categoryCfg.dotColor);

  return (
    <div
      data-task-id={task.id}
      className={`
        grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out select-none group
        ${!isExiting ? 'animate-task-in grid-rows-[1fr] opacity-100 scale-100' : ''}
        ${isDragging ? 'z-30 scale-[1.02]' : ''}
        ${deleting ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-x-4 !mt-0 !mb-0 pointer-events-none' : ''}
        ${exitingComplete && !deleting ? 'grid-rows-[0fr] opacity-0 scale-95 translate-x-4 !mt-0 !mb-0 pointer-events-none' : ''}
      `}
    >
      <div className="overflow-visible min-h-0 relative rounded-2xl">
        {/* ─── Arka Plan Kaydırma Katmanı (Swipe Backgrounds) ─── */}
        <div className="absolute inset-0 flex items-center justify-between rounded-2xl overflow-hidden pointer-events-none">
          {/* Sağa Kaydır = Tamamla (Yeşil) */}
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

          {/* Sola Kaydır = Sil (Kırmızı) */}
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

        {/* ─── Ön Plan Görev Kartı (p-3.5 = 14px, rounded-2xl = 16px) ─── */}
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
            relative rounded-2xl border transition-colors
            ${isVisuallyCompleted ? 'opacity-70 bg-surface/80' : 'bg-surface hover:bg-surface-hover'}
            ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500/50' : ''}
          `}
          style={{
            borderColor: isDragging
              ? 'var(--primary)'
              : isVisuallyCompleted
                ? 'rgba(16, 185, 129, 0.30)'
                : 'var(--border)',
            touchAction: isDragging ? 'none' : 'pan-y',
            willChange: 'transform',
          }}
        >
          {/* Sol Renkli Kenar Şeridi (İnce) */}
          <div
            className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full transition-colors duration-200"
            style={{ background: leftBarColor }}
          />

          <div className="p-3.5 pl-3.5">
            <div className="flex items-center gap-2">
              {/* ─── Sürükle-Bırak Tutamacı (Aktif görevlerde sıra değiştirmek için) ─── */}
              {canReorder && onStartDrag && !task.completed && (
                <button
                  type="button"
                  aria-label="Sıralamak için sürükle"
                  title="Sürükleyerek sırala"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    triggerVibrate(15);
                    onStartDrag(task.id, e.clientY);
                  }}
                  style={{ touchAction: 'none' }}
                  className="-ml-2 -mr-1.5 py-2 px-0.5 text-app-muted/50 hover:text-app-secondary active:text-indigo-400 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors"
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
              )}

              {/* ─── Sol: Yuvarlak Onay Kutusu (44x44px Dokunma Alanı) ─── */}
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
                    handleToggleAction();
                  }}
                  aria-label={isVisuallyCompleted ? 'Görevi geri al' : 'Görevi tamamla'}
                  className="w-11 h-11 -my-2 flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`
                      w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-150
                      ${justCompleted ? 'animate-check-elastic' : ''}
                    `}
                    style={
                      isVisuallyCompleted
                        ? {
                            background: '#10B981',
                            border: '1.5px solid #10B981',
                          }
                        : {
                            background: 'transparent',
                            border: `1.5px solid ${priorityCfg.hex}`,
                          }
                    }
                  >
                    {isVisuallyCompleted && (
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

              {/* ─── Orta: Başlık + Tek Satır Meta Bilgi (Dokununca Detay/Alt Görev Açılır) ─── */}
              <div
                className="flex-1 min-w-0 cursor-pointer py-0.5"
                onClick={() => {
                  if (didSwipeRef.current) {
                    didSwipeRef.current = false;
                    return;
                  }
                  if (offsetXRef.current !== 0) {
                    applySwipeVisuals(0, false);
                    return;
                  }
                  if (!isEditing) {
                    setExpanded((v) => !v);
                  }
                }}
              >
                <div className="relative min-w-0 inline-block max-w-full">
                  <p
                    className={`text-sm font-semibold leading-snug tracking-tight truncate ${
                      isVisuallyCompleted ? 'text-app-muted' : 'text-app-primary'
                    }`}
                  >
                    {task.title}
                  </p>
                  {isVisuallyCompleted && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-emerald-500/85 rounded-full animate-strike-draw pointer-events-none"
                      style={{ width: '100%' }}
                    />
                  )}
                </div>

                {/* Tek Satır Meta Bilgi: Saat + Kategori Noktası + (Yalnızca Yüksek/Acil ise Etiket) + Kronometre */}
                <div className="flex items-center gap-2 mt-1 text-xs text-app-secondary">
                  {/* Saat veya Hatırlatıcı */}
                  {reminderLabel ? (
                    <span className="inline-flex items-center gap-1 text-indigo-300 font-medium tabular-nums">
                      <Bell size={11} aria-hidden="true" />
                      <span>{reminderLabel}</span>
                    </span>
                  ) : (
                    <span className="text-app-secondary tabular-nums">{formattedTime}</span>
                  )}

                  {/* Kategori Küçük Renkli Nokta (veya Proje Noktası + Kısa Ad) */}
                  <span
                    className="inline-flex items-center gap-1 min-w-0"
                    title={project ? project.name : categoryCfg.label}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: project ? project.color : categoryCfg.dotColor }}
                    />
                    {project && (
                      <span className="text-xs text-app-secondary truncate max-w-[90px]">
                        {project.name}
                      </span>
                    )}
                  </span>

                  {/* Yalnızca Yüksek / Acil Öncelik Etiketi (Orta/Düşük Gizli) */}
                  {isHighOrUrgent && (
                    <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-red-500/15 text-red-300">
                      Acil
                    </span>
                  )}

                  {/* Alt Görev Sayacı (Varsa) */}
                  {subtasks.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-app-secondary tabular-nums">
                      <ListChecks size={11} aria-hidden="true" />
                      <span>
                        {completedSubtasks}/{subtasks.length}
                      </span>
                    </span>
                  )}

                  {/* Kronometre Çalışıyorsa Küçük Süre Göstergesi */}
                  {timerActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onFocus) onFocus(task);
                      }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-xs font-semibold bg-indigo-500/18 text-indigo-300 tabular-nums"
                      title="Odaklanma ekranını aç"
                    >
                      <Timer size={11} aria-hidden="true" />
                      <span>{formattedTimer}</span>
                    </button>
                  )}

                  {/* Erteleme Geri Bildirimi */}
                  {snoozedFeedback && (
                    <span className="text-xs font-medium text-amber-300">
                      {snoozedFeedback}
                    </span>
                  )}
                </div>
              </div>

              {/* ─── Sağ: Yalnızca Tek "⋯" Menüsü (44x44px Dokunma Alanı) ─── */}
              <div
                ref={menuRef}
                className="relative flex-shrink-0 -mr-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Görev seçenekleri"
                  aria-expanded={menuOpen}
                  className="w-11 h-11 -my-2 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={18} />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-1 top-10 z-40 w-48 rounded-2xl border p-1.5 shadow-2xl animate-scale-in"
                    style={{
                      background: 'var(--sheet-bg)',
                      borderColor: 'var(--border-strong)',
                      boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55)',
                    }}
                  >
                    {!task.completed && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            setTimerActive((v) => !v);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-xs font-medium text-app-primary hover:bg-surface flex items-center gap-2.5 text-left"
                        >
                          <Timer size={14} className="text-indigo-400" aria-hidden="true" />
                          <span>
                            {timerActive ? 'Kronometreyi Durdur' : 'Kronometre Başlat'}
                          </span>
                        </button>

                        {onFocus && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              onFocus(task);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-xs font-medium text-app-primary hover:bg-surface flex items-center gap-2.5 text-left"
                          >
                            <Clock size={14} className="text-indigo-300" aria-hidden="true" />
                            <span>Tam Ekran Odaklan</span>
                          </button>
                        )}

                        {onSnooze && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleSnooze('tomorrow')}
                            className="w-full px-3 py-2 rounded-xl text-xs font-medium text-app-primary hover:bg-surface flex items-center gap-2.5 text-left"
                          >
                            <Bell size={14} className="text-amber-400" aria-hidden="true" />
                            <span>Yarın 09:00’a Ertele</span>
                          </button>
                        )}

                        {canReorder && !isFirst && onMoveToTop && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              triggerVibrate(12);
                              onMoveToTop(task.id);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-xs font-medium text-app-primary hover:bg-surface flex items-center gap-2.5 text-left"
                          >
                            <ArrowUpToLine size={14} className="text-emerald-400" aria-hidden="true" />
                            <span>En Üste Taşı</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditTitle(task.title);
                        setEditNote(task.note ?? '');
                        setIsEditing(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-app-primary hover:bg-surface flex items-center gap-2.5 text-left"
                    >
                      <Pencil size={14} className="text-app-secondary" aria-hidden="true" />
                      <span>Düzenle</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDelete}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 text-left"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Sil</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Satır İçi Düzenleme Modu (Menüden "Düzenle" Seçilince) ─── */}
            {isEditing && (
              <form
                onSubmit={handleSaveEdit}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 pt-2.5 border-t border-app space-y-2 animate-fade-in"
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Görev başlığı"
                  maxLength={120}
                  autoFocus
                  className="select-text w-full px-3 py-2 rounded-xl text-xs text-app-primary border outline-none"
                  style={{ background: 'var(--bg-2)', borderColor: 'var(--border-focus)' }}
                />
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Not ekle (isteğe bağlı)"
                  maxLength={300}
                  className="select-text w-full px-3 py-1.5 rounded-xl text-xs text-app-secondary border outline-none"
                  style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-app-secondary"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <X size={12} />
                    <span>İptal</span>
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    <Check size={12} />
                    <span>Kaydet</span>
                  </button>
                </div>
              </form>
            )}

            {/* ─── Karta Dokununca Açılan Detay & Alt Görevler (Checklist) ─── */}
            {expanded && !isEditing && (
              <div
                className="mt-3 ml-8 pt-2.5 border-t border-app space-y-2 animate-fade-in"
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
                          className="text-app-muted hover:text-red-400 p-1"
                          aria-label="Alt görevi sil"
                        >
                          <Trash2 size={12} />
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
                          className="select-text flex-1 bg-transparent text-xs text-app-primary placeholder-app-muted outline-none px-2.5 py-1.5 rounded-lg border"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--bg-2)',
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!newSubtaskTitle.trim()}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all active:scale-95"
                          style={{ background: 'var(--primary)' }}
                          aria-label="Alt adım ekle"
                        >
                          <Plus size={13} />
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
