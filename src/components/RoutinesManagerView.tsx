import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  Flame,
  Award,
  CheckCircle2,
  TrendingUp,
  Pause,
  Play,
  Archive,
  Pencil,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Bell,
  Calendar,
  FolderKanban,
  RotateCcw,
  Target,
} from 'lucide-react';
import type {
  Category,
  Project,
  Routine,
  RoutineFormData,
  RoutineRepeatType,
  RoutineStatus,
} from '../types';
import {
  CATEGORY_CONFIG,
  PROJECT_COLORS,
  ROUTINE_ICONS,
  ROUTINE_REPEAT_LABELS,
} from '../types';
import type { SingleRoutineStats } from '../lib/routines';
import { getIstanbulDateStr, resolveRepeatDays } from '../lib/routines';

type RoutinesManagerViewProps = {
  routines: Routine[];
  projects: Project[];
  routineStatsMap: Map<string, SingleRoutineStats>;
  initialRoutineId?: string | null;
  onClearInitialRoutine?: () => void;
  onAddRoutine: (form: RoutineFormData) => Promise<Routine | null>;
  onUpdateRoutine: (id: string, updates: Partial<RoutineFormData>) => Promise<void>;
  onSetRoutineStatus: (id: string, status: RoutineStatus) => Promise<void>;
};

const WEEKDAY_CHIPS: Array<{ day: number; short: string; full: string }> = [
  { day: 1, short: 'Pzt', full: 'Pazartesi' },
  { day: 2, short: 'Sal', full: 'Salı' },
  { day: 3, short: 'Çar', full: 'Çarşamba' },
  { day: 4, short: 'Per', full: 'Perşembe' },
  { day: 5, short: 'Cum', full: 'Cuma' },
  { day: 6, short: 'Cmt', full: 'Cumartesi' },
  { day: 0, short: 'Paz', full: 'Pazar' },
];

const CATEGORIES: Category[] = ['personal', 'work', 'urgent'];

export function RoutinesManagerView({
  routines,
  projects,
  routineStatsMap,
  initialRoutineId = null,
  onClearInitialRoutine,
  onAddRoutine,
  onUpdateRoutine,
  onSetRoutineStatus,
}: RoutinesManagerViewProps) {
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(initialRoutineId);
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'archived'>('active');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string>(ROUTINE_ICONS[0]);
  const [color, setColor] = useState<string>(PROJECT_COLORS[0].hex);
  const [category, setCategory] = useState<Category>('personal');
  const [repeatType, setRepeatType] = useState<RoutineRepeatType>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [time, setTime] = useState('');
  const [reminder, setReminder] = useState(false);
  const [targetCount, setTargetCount] = useState(1);
  const [startDate, setStartDate] = useState(() => getIstanbulDateStr());
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoutineId) {
      setSelectedRoutineId(initialRoutineId);
    }
  }, [initialRoutineId]);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setTitle('');
    setIcon(ROUTINE_ICONS[0]);
    setColor(PROJECT_COLORS[0].hex);
    setCategory('personal');
    setRepeatType('daily');
    setRepeatDays([1, 2, 3, 4, 5, 6, 0]);
    setTime('');
    setReminder(false);
    setTargetCount(1);
    setStartDate(getIstanbulDateStr());
    setEndDate('');
    setProjectId(null);
    setShowAdvanced(false);
    setShowFormModal(true);
  };

  const openEditModal = (r: Routine) => {
    setEditingRoutine(r);
    setTitle(r.title);
    setIcon(r.icon);
    setColor(r.color);
    setCategory(r.category);
    setRepeatType(r.repeat_type);
    setRepeatDays(r.repeat_days);
    setTime(r.time ?? '');
    setReminder(r.reminder);
    setTargetCount(r.target_count);
    setStartDate(r.start_date);
    setEndDate(r.end_date ?? '');
    setProjectId(r.project_id ?? null);
    setShowAdvanced(
      r.target_count > 1 || Boolean(r.end_date) || Boolean(r.project_id)
    );
    setShowFormModal(true);
  };

  const handleToggleDayChip = (dayNum: number) => {
    setRepeatType('custom');
    setRepeatDays((prev) => {
      if (prev.includes(dayNum)) {
        const next = prev.filter((d) => d !== dayNum);
        return next.length > 0 ? next : [dayNum];
      }
      return [...prev, dayNum];
    });
  };

  const handleSelectRepeatPreset = (type: RoutineRepeatType) => {
    setRepeatType(type);
    setRepeatDays(resolveRepeatDays(type, repeatDays));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const formData: RoutineFormData = {
      title: title.trim(),
      icon,
      color,
      category,
      project_id: projectId,
      time: time.trim() || null,
      reminder: Boolean(reminder && time.trim()),
      repeat_type: repeatType,
      repeat_days: resolveRepeatDays(repeatType, repeatDays),
      target_count: Math.max(1, Math.min(100, Number(targetCount) || 1)),
      start_date: startDate || getIstanbulDateStr(),
      end_date: endDate || null,
      status: editingRoutine?.status ?? 'active',
    };

    if (editingRoutine) {
      await onUpdateRoutine(editingRoutine.id, formData);
    } else {
      await onAddRoutine(formData);
    }

    setShowFormModal(false);
    setEditingRoutine(null);
  };

  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId]
  );

  const filteredRoutines = useMemo(
    () => routines.filter((r) => r.status === statusFilter),
    [routines, statusFilter]
  );

  const counts = useMemo(
    () => ({
      active: routines.filter((r) => r.status === 'active').length,
      paused: routines.filter((r) => r.status === 'paused').length,
      archived: routines.filter((r) => r.status === 'archived').length,
    }),
    [routines]
  );

  // ─── RUTİN FORMU MODALI (Portal ile body'ye bağlanır) ────────────────────────
  const renderRoutineFormModal = () => {
    if (!showFormModal) return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
        <div
          className="absolute inset-0 backdrop-blur-sm"
          style={{ background: 'var(--overlay)' }}
          onClick={() => setShowFormModal(false)}
        />
        <div
          className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 border-t sm:border shadow-2xl animate-slide-up"
          style={{
            background: 'var(--sheet-bg)',
            borderColor: 'var(--border-strong)',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-app-muted text-[10px] font-bold uppercase tracking-widest">
                {editingRoutine ? 'Rutin Düzenle' : 'Yeni Rutin'}
              </p>
              <h3 className="text-app-primary text-lg font-bold tracking-tight">
                {editingRoutine ? editingRoutine.title : 'Rutin Oluştur'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              aria-label="Kapat"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-3.5">
            {/* 1. Rutin Adı */}
            <div>
              <label className="text-app-secondary text-xs font-semibold block mb-1.5">
                Rutin Adı *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Su iç, Kitap oku 20 dk, Spor"
                required
                maxLength={80}
                autoFocus
                className="select-text input-base"
              />
            </div>

            {/* 2. İkon ve Renk Seçimi */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-app-secondary text-xs font-semibold block mb-1.5">
                  İkon & Renk
                </label>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {ROUTINE_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-transform active:scale-90 cursor-pointer"
                      style={{
                        background: icon === emoji ? `${color}25` : 'var(--surface)',
                        border:
                          icon === emoji
                            ? `1.5px solid ${color}`
                            : '1px solid var(--border)',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      aria-label={c.label}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                      style={{
                        background: c.hex,
                        boxShadow: color === c.hex ? `0 0 0 2px var(--bg), 0 0 0 4px ${c.hex}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Tekrar Günleri (Her gün / Hafta içi / Hafta sonu / Pzt-Paz Çip Seçimi) */}
            <div>
              <label className="text-app-secondary text-xs font-semibold block mb-1.5">
                Tekrar Kuralı
              </label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {(['daily', 'weekdays', 'weekends', 'custom'] as RoutineRepeatType[]).map(
                  (rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => handleSelectRepeatPreset(rt)}
                      className="py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      style={
                        repeatType === rt
                          ? { background: color, color: '#ffffff' }
                          : {
                              background: 'var(--surface)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border)',
                            }
                      }
                    >
                      {ROUTINE_REPEAT_LABELS[rt]}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_CHIPS.map((w) => {
                  const activeDays = resolveRepeatDays(repeatType, repeatDays);
                  const isSel = activeDays.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() => handleToggleDayChip(w.day)}
                      className="py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                      style={
                        isSel
                          ? {
                              background: `${color}22`,
                              color,
                              border: `1px solid ${color}`,
                            }
                          : {
                              background: 'var(--surface)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                            }
                      }
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Kategori ve İsteğe Bağlı Saat */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-app-secondary text-xs font-semibold block mb-1.5">
                  Kategori
                </label>
                <div className="flex items-center gap-1">
                  {CATEGORIES.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const isSel = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className="flex-1 py-2 px-1.5 rounded-xl text-[11px] font-semibold truncate cursor-pointer"
                        style={
                          isSel
                            ? {
                                background: 'var(--surface-2)',
                                color: cfg.dotColor,
                                border: `1px solid ${cfg.dotColor}`,
                              }
                            : {
                                background: 'var(--surface)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                              }
                        }
                      >
                        {cat === 'work' ? 'İş' : cfg.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-app-secondary text-xs font-semibold block mb-1.5">
                  Saat (İsteğe bağlı)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      if (e.target.value) setReminder(true);
                    }}
                    className="input-base !py-1.5 !px-2.5 text-xs flex-1"
                  />
                  {time && (
                    <button
                      type="button"
                      onClick={() => setReminder((v) => !v)}
                      title={reminder ? 'Hatırlatıcı açık' : 'Hatırlatıcı kapalı'}
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
                      style={{
                        background: reminder ? 'var(--primary-dim)' : 'var(--surface)',
                        color: reminder ? 'var(--primary-light)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <Bell size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 5. "Daha Fazla" Gelişmiş Seçenekler (Hedef Sayı, Başlangıç-Bitiş, Proje) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200 py-1 cursor-pointer"
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Daha fazla seçenek (Hedef sayı, tarih aralığı, proje)</span>
              </button>

              {showAdvanced && (
                <div
                  className="mt-2 p-3 rounded-2xl border space-y-3 animate-fade-in"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <label className="text-app-secondary text-xs font-semibold block mb-1">
                      Günlük Hedef Sayı (1 = Tek seferde tamamla, &gt;1 = Sayaçlı rutin)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targetCount}
                        onChange={(e) =>
                          setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="input-base !py-1.5 !w-24 text-xs"
                      />
                      <span className="text-xs text-app-muted">
                        Örn: 8 bardak su için 8 girin
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-app-secondary text-xs font-semibold block mb-1">
                        Başlangıç Tarihi
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-base !py-1.5 !px-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-app-secondary text-xs font-semibold block mb-1">
                        Bitiş (İsteğe bağlı)
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input-base !py-1.5 !px-2.5 text-xs"
                      />
                    </div>
                  </div>

                  {projects.length > 0 && (
                    <div>
                      <label className="text-app-secondary text-xs font-semibold block mb-1">
                        Proje Bağlantısı
                      </label>
                      <select
                        value={projectId ?? ''}
                        onChange={(e) => setProjectId(e.target.value || null)}
                        className="input-base !py-1.5 text-xs"
                      >
                        <option value="">Projesiz</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full py-3 mt-1 cursor-pointer">
              {editingRoutine ? 'Değişiklikleri Kaydet' : 'Rutini Oluştur'}
            </button>
          </form>
        </div>
      </div>,
      document.body
    );
  };

  // ─── c) RUTİN DETAY SAYFASI ──────────────────────────────────────────────────
  if (selectedRoutine) {
    const st = routineStatsMap.get(selectedRoutine.id);
    const linkedProject = selectedRoutine.project_id
      ? projects.find((p) => p.id === selectedRoutine.project_id)
      : null;
    const maxWeekdayDone = Math.max(
      1,
      ...(st?.weekdayStats.map((w) => w.done) ?? [1])
    );

    return (
      <div className="space-y-4 animate-fade-in">
        {renderRoutineFormModal()}

        {/* Üst Geri & Aksiyon Çubuğu */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRoutineId(null);
              if (onClearInitialRoutine) onClearInitialRoutine();
            }}
            className="inline-flex items-center gap-1.5 text-app-secondary hover:text-app-primary text-xs font-semibold py-1.5 px-2.5 rounded-xl cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <ArrowLeft size={14} />
            <span>Rutinlere Dön</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openEditModal(selectedRoutine)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-app-secondary hover:text-app-primary cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Pencil size={12} />
              <span>Düzenle</span>
            </button>

            {selectedRoutine.status === 'active' ? (
              <button
                type="button"
                onClick={() => void onSetRoutineStatus(selectedRoutine.id, 'paused')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-300 cursor-pointer"
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <Pause size={12} />
                <span>Duraklat</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSetRoutineStatus(selectedRoutine.id, 'active')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-300 cursor-pointer"
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                }}
              >
                <Play size={12} />
                <span>Etkinleştir</span>
              </button>
            )}

            {selectedRoutine.status !== 'archived' && (
              <button
                type="button"
                onClick={() => {
                  void onSetRoutineStatus(selectedRoutine.id, 'archived');
                  setSelectedRoutineId(null);
                }}
                className="p-1.5 rounded-xl text-app-muted hover:text-red-400 cursor-pointer"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                title="Arşivle (Geçmiş kayıtlar korunur)"
                aria-label="Rutini arşivle"
              >
                <Archive size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Rutin Başlık Kartı */}
        <div
          className="rounded-3xl p-4 border relative overflow-hidden"
          style={{
            background: 'var(--surface)',
            borderColor: `${selectedRoutine.color}44`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: `${selectedRoutine.color}20`,
                border: `1px solid ${selectedRoutine.color}40`,
              }}
            >
              {selectedRoutine.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-app-primary text-lg font-bold tracking-tight truncate">
                  {selectedRoutine.title}
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={
                    selectedRoutine.status === 'active'
                      ? { background: 'rgba(16, 185, 129, 0.15)', color: '#34D399' }
                      : { background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }
                  }
                >
                  {selectedRoutine.status === 'active'
                    ? 'Aktif'
                    : selectedRoutine.status === 'paused'
                      ? 'Duraklatıldı'
                      : 'Arşivde'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 mt-1.5 text-xs text-app-secondary flex-wrap">
                <span>{ROUTINE_REPEAT_LABELS[selectedRoutine.repeat_type]}</span>
                {selectedRoutine.time && (
                  <span className="inline-flex items-center gap-1 text-indigo-300">
                    <Clock size={11} />
                    <span>{selectedRoutine.time}</span>
                  </span>
                )}
                {selectedRoutine.target_count > 1 && (
                  <span className="inline-flex items-center gap-1">
                    <Target size={11} />
                    <span>Günlük hedef: {selectedRoutine.target_count}</span>
                  </span>
                )}
                {linkedProject && (
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: linkedProject.color }}
                  >
                    <FolderKanban size={11} />
                    <span>{linkedProject.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Özet İstatistik Kartı: Mevcut Seri, En Uzun Seri, Toplam Yapılma, Oran (%) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className="rounded-2xl p-3.5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
              <Flame size={13} className="fill-amber-400" />
              <span>Mevcut Seri</span>
            </div>
            <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
              {st?.currentStreak ?? 0}{' '}
              <span className="text-xs font-semibold text-app-muted">gün</span>
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold">
              <Award size={13} />
              <span>En Uzun Seri</span>
            </div>
            <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
              {st?.longestStreak ?? 0}{' '}
              <span className="text-xs font-semibold text-app-muted">gün</span>
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 size={13} />
              <span>Toplam Yapılma</span>
            </div>
            <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
              {st?.totalDoneCount ?? 0}{' '}
              <span className="text-xs font-semibold text-app-muted">kez</span>
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
              <TrendingUp size={13} />
              <span>Tamamlama Oranı</span>
            </div>
            <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
              %{st?.completionRate ?? 0}
            </p>
          </div>
        </div>

        {/* Son 30 Gün Takvimi */}
        <div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" />
              <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider">
                Son 30 Gün Takvimi
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-app-secondary">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Yapıldı
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-red-500/40" /> Yapılmadı
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-slate-500/50" /> Atlandı
              </span>
            </div>
          </div>

          <div className="grid grid-cols-10 gap-1.5">
            {(st?.last30Days ?? []).map((cell) => {
              let bg = 'transparent';
              let border = '1px dashed var(--border)';
              let textColor = 'var(--text-faint)';

              if (cell.state === 'done') {
                bg = 'rgba(16, 185, 129, 0.24)';
                border = '1px solid rgba(16, 185, 129, 0.55)';
                textColor = '#34D399';
              } else if (cell.state === 'missed') {
                bg = 'rgba(239, 68, 68, 0.14)';
                border = '1px solid rgba(239, 68, 68, 0.30)';
                textColor = '#FCA5A5';
              } else if (cell.state === 'skipped') {
                bg = 'rgba(148, 163, 184, 0.14)';
                border = '1px solid rgba(148, 163, 184, 0.28)';
                textColor = 'var(--text-secondary)';
              } else if (cell.state === 'pending') {
                bg = 'var(--primary-dim)';
                border = '1px solid var(--primary)';
                textColor = 'var(--primary-light)';
              }

              return (
                <div
                  key={cell.date}
                  title={`${cell.shortLabel}: ${
                    cell.state === 'done'
                      ? 'Yapıldı'
                      : cell.state === 'missed'
                        ? 'Yapılmadı'
                        : cell.state === 'skipped'
                          ? 'Atlandı'
                          : cell.state === 'pending'
                            ? 'Bugün (Bekliyor)'
                            : 'Planlanmadı'
                  }`}
                  className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold tabular-nums"
                  style={{ background: bg, border, color: textColor }}
                >
                  {cell.dayNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Haftalık Çubuk Grafik (Son 8 Hafta) */}
        <div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider mb-3">
            Son 8 Hafta Performansı
          </h3>
          <div className="grid grid-cols-8 gap-1.5 items-end h-28 pt-4">
            {(st?.last8Weeks ?? []).map((wb, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] font-bold text-app-secondary tabular-nums">
                  %{wb.rate}
                </span>
                <div
                  className="w-full rounded-lg overflow-hidden flex items-end"
                  style={{ height: '64px', background: 'var(--surface-2)' }}
                >
                  <div
                    className="w-full rounded-lg transition-all duration-300"
                    style={{
                      height: `${Math.max(wb.planned > 0 ? 8 : 0, wb.rate)}%`,
                      background:
                        wb.rate >= 80
                          ? '#10B981'
                          : wb.rate >= 50
                            ? selectedRoutine.color
                            : '#F59E0B',
                    }}
                  />
                </div>
                <span className="text-[9px] text-app-muted truncate max-w-full">
                  {wb.weekLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Haftanın Hangi Günleri En Çok Yapılıyor */}
        <div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider">
              Haftanın Günlerine Göre Dağılım
            </h3>
            {st?.bestWeekdayLabel && st.bestWeekdayLabel !== '—' && (
              <span
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#34D399' }}
              >
                En verimli: {st.bestWeekdayLabel}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {(st?.weekdayStats ?? []).map((ws) => {
              const barPct = Math.round((ws.done / maxWeekdayDone) * 100);
              return (
                <div key={ws.weekday} className="flex items-center gap-2.5 text-xs">
                  <span className="w-8 font-semibold text-app-secondary">{ws.label}</span>
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${barPct}%`,
                        background: selectedRoutine.color,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right text-app-secondary font-medium tabular-nums">
                    {ws.done}/{ws.planned} (%{ws.rate})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── b) RUTİN YÖNETİMİ LİSTE EKRANI ──────────────────────────────────────────
  return (
    <div className="space-y-3.5 animate-fade-in">
      {renderRoutineFormModal()}

      {/* Durum Filtreleri + Yeni Rutin Butonu */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'active', label: `Aktif (${counts.active})` },
            { id: 'paused', label: `Duraklatıldı (${counts.paused})` },
            ...(counts.archived > 0
              ? [{ id: 'archived', label: `Arşiv (${counts.archived})` }]
              : []),
          ].map((tab) => {
            const isSel = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setStatusFilter(tab.id as 'active' | 'paused' | 'archived')
                }
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                style={
                  isSel
                    ? { background: 'var(--primary)', color: '#ffffff' }
                    : {
                        background: 'var(--surface)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-transform active:scale-95 cursor-pointer"
          style={{
            background: 'var(--primary)',
            boxShadow: '0 6px 18px var(--primary-glow)',
          }}
        >
          <Plus size={14} />
          <span>Yeni Rutin</span>
        </button>
      </div>

      {/* Rutin Kartları Listesi */}
      {filteredRoutines.length > 0 ? (
        <div className="space-y-2">
          {filteredRoutines.map((r) => {
            const st = routineStatsMap.get(r.id);
            return (
              <div
                key={r.id}
                onClick={() => setSelectedRoutineId(r.id)}
                className="rounded-2xl p-3.5 border flex items-center justify-between gap-3 transition-colors hover:bg-surface-hover cursor-pointer"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background: `${r.color}18`,
                      border: `1px solid ${r.color}38`,
                    }}
                  >
                    {r.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-app-primary text-sm font-bold truncate">
                        {r.title}
                      </p>
                      {r.target_count > 1 && (
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                        >
                          {r.target_count}x
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-app-secondary">
                      <span>{ROUTINE_REPEAT_LABELS[r.repeat_type]}</span>
                      {r.time && <span>· {r.time}</span>}
                      <span>· %{st?.completionRate ?? 0} oran</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums"
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#FBBF24',
                    }}
                  >
                    <Flame size={11} className="fill-amber-400" />
                    <span>{st?.currentStreak ?? 0}</span>
                  </div>

                  {r.status === 'active' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onSetRoutineStatus(r.id, 'paused');
                      }}
                      title="Rutini duraklat"
                      aria-label="Rutini duraklat"
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-app-secondary hover:text-amber-300 cursor-pointer"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <Pause size={13} />
                    </button>
                  )}

                  {r.status !== 'active' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onSetRoutineStatus(r.id, 'active');
                      }}
                      title="Rutini yeniden etkinleştir"
                      aria-label="Rutini yeniden etkinleştir"
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-400 cursor-pointer"
                      style={{ background: 'rgba(16, 185, 129, 0.14)' }}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-3xl p-7 border text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-app-primary text-sm font-bold">
            {statusFilter === 'active'
              ? 'Henüz aktif rutin yok'
              : statusFilter === 'paused'
                ? 'Duraklatılmış rutin yok'
                : 'Arşivlenmiş rutin yok'}
          </p>
          <p className="text-app-secondary text-xs mt-1 max-w-xs mx-auto leading-relaxed">
            Su içmek, kitap okumak veya spor yapmak gibi tekrarlayan alışkanlıklarını tanımla; her gün otomatik takip edilsin.
          </p>
          {statusFilter === 'active' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: 'var(--primary)' }}
            >
              <Plus size={14} />
              <span>İlk Rutini Oluştur</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
