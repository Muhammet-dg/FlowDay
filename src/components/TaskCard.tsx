import { useState, useRef } from 'react';
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

export function TaskCard({
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

  // ── Swipe Gesture State ────────────────────────────────────────────────────
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const categoryKey = task.category ?? (task.priority === 'high' ? 'urgent' : 'personal');
  const categoryCfg = CATEGORY_CONFIG[categoryKey];

  const isVisuallyCompleted = task.completed || justCompleted;
  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

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
    if (justCompleted || deleting) return;

    if (!task.completed) {
      // 1. Dairesel kutu dolsun, tik çizilsin, başlık üstü çizilsin, konfeti/parıltı + titreşim
      setJustCompleted(true);
      triggerVibrate([15, 30]);

      // 2. 220ms sonra kart yumuşakça küçülüp listeden çıkmaya başlasın
      setTimeout(() => {
        setExitingComplete(true);
      }, 220);

      // 3. 360ms sonunda state güncellensin
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
    triggerVibrate(20);
    setOffsetX(-90);
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 260);
  };

  const handleSnooze = (mode: '1h' | 'tomorrow') => {
    setOffsetX(0);
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

  // ── Touch / Pointer Handlers (Swipe) ───────────────────────────────────────
  const handlePointerStart = (clientX: number, clientY: number) => {
    if (deleting || justCompleted) return;
    startXRef.current = clientX - offsetX;
    startYRef.current = clientY;
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging || startXRef.current === null || startYRef.current === null) return;

    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      const clamped = Math.max(-135, Math.min(115, deltaX));
      setOffsetX(clamped);
    }
  };

  const handlePointerEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Sağa kaydırma -> Tamamla / Geri Al (yeşil arka plan)
    if (offsetX > 64) {
      setOffsetX(0);
      handleToggleAction();
    }
    // Sola kaydırma -> Kırmızı çöp ikonu ile doğrudan sil
    else if (offsetX < -72) {
      handleDelete();
    } else {
      setOffsetX(0);
    }

    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  const formattedTime = new Date(task.created_at).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const reminderLabel = task.reminder_time
    ? new Date(task.reminder_time).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`
        relative rounded-2xl select-none transition-all duration-280 ease-out animate-task-in group overflow-hidden
        ${
          deleting
            ? 'opacity-0 scale-90 -translate-x-5 max-h-0 !mb-0 !py-0 pointer-events-none'
            : exitingComplete
              ? 'opacity-0 scale-95 translate-x-4 max-h-0 !mb-0 !py-0 pointer-events-none'
              : 'opacity-100 scale-100 max-h-[520px]'
        }
      `}
    >
      {/* ─── Arka Plan Kaydırma Katmanı (Swipe Backgrounds) ─── */}
      <div className="absolute inset-0 flex items-center justify-between rounded-2xl overflow-hidden pointer-events-none">
        {/* Sağa Kaydırınca Beliren Yeşil Tamamlama Şeridi */}
        <div
          className="h-full flex items-center pl-4 pr-6 transition-opacity duration-150"
          style={{
            background: 'linear-gradient(90deg, #10B981, #059669)',
            opacity: offsetX > 6 ? Math.min(1, offsetX / 56) : 0,
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
          className="h-full flex items-center justify-end pr-4 pl-6 ml-auto transition-opacity duration-150"
          style={{
            background: 'linear-gradient(270deg, #EF4444, #DC2626)',
            opacity: offsetX < -6 ? Math.min(1, Math.abs(offsetX) / 56) : 0,
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

      {/* ─── Ön Plan Görev Kartı (Glassmorphic & Editorial Tasarım) ─── */}
      <div
        onTouchStart={(e) => handlePointerStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handlePointerEnd}
        onMouseDown={(e) => handlePointerStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={handlePointerEnd}
        onMouseLeave={() => {
          if (isDragging) handlePointerEnd();
        }}
        className={`
          relative rounded-2xl border transition-all overflow-hidden active:scale-[0.99]
          ${isDragging ? '' : 'duration-250 ease-out'}
          ${isVisuallyCompleted ? 'opacity-75 bg-surface/75' : 'bg-surface/90 hover:bg-surface-hover/90'}
          shadow-sm hover:shadow-md
        `}
        style={{
          borderColor: isVisuallyCompleted ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-strong)',
          transform: `translateX(${offsetX}px)`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
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
          className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full transition-colors duration-300"
          style={{
            background: isVisuallyCompleted
              ? '#10B981'
              : project?.color ?? priorityCfg.hex,
            boxShadow: isVisuallyCompleted
              ? '0 0 8px rgba(16, 185, 129, 0.45)'
              : `0 0 8px ${(project?.color ?? priorityCfg.hex)}40`,
          }}
        />

        <div className="p-3.5 pl-4 sm:p-4 sm:pl-4.5">
          <div className="flex items-start gap-3">
            {/* ─── Dairesel Mikro-Etkileşimli Checkbox ─── */}
            <div className="relative mt-0.5 flex-shrink-0">
              {/* Mikro-parçacık patlaması (Sparkle burst) */}
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
                          boxShadow: `0 0 6px ${sb.color}`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              )}

              {/* Dışarı genişleyen başarı halkası (Ripple) */}
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
                  w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer
                  active:scale-85
                  ${justCompleted ? 'animate-check-elastic' : ''}
                `}
                style={
                  isVisuallyCompleted
                    ? {
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        border: '1.5px solid #10B981',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.40)',
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
                if (offsetX !== 0) {
                  setOffsetX(0);
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

                  {/* Soldan Sağa Dinamik Strikethrough Çizgi Animasyonu */}
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
                {/* Proje Rozeti (varsa) */}
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

                {/* Kategori Etiketi */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryCfg.badgeBg} ${categoryCfg.badgeText}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: categoryCfg.dotColor }}
                  />
                  <span>{categoryCfg.shortLabel}</span>
                </span>

                {/* Öncelik Etiketi */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dotColor}`} />
                  <span>{priorityCfg.label}</span>
                </span>

                {/* Alt Görev Sayacı */}
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

                {/* Saat */}
                <span className="text-app-muted text-[10px] font-medium px-0.5">
                  {formattedTime}
                </span>

                {/* Hatırlatıcı */}
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

                {/* Erteleme Geri Bildirimi */}
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

              {/* Alt Görevler (Subtasks Checklist) */}
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
  );
}
