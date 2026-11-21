import { useState } from 'react';
import {
  TrendingUp,
  Target,
  CheckCircle2,
  Clock,
  Flame,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
  Layers,
  FolderKanban,
  BookOpen,
  Check,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  AlertTriangle,
} from 'lucide-react';
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from '../types';
import type { Learning, Project, Routine, RoutineLog, Task } from '../types';
import type { TaskStats } from '../hooks/useTasks';
import { useStats } from '../hooks/useStats';
import type { StatsPeriod } from '../hooks/useStats';
import { useRoutineStats } from '../hooks/useRoutineStats';

export type BackupPayload = {
  version: number;
  exportedAt: string;
  tasks?: Task[];
  projects?: Project[];
  learnings?: Learning[];
  routines?: Routine[];
  routineLogs?: RoutineLog[];
  weeklyGoal?: number;
};

type StatsViewProps = {
  stats: TaskStats;
  streak?: number;
  tasks?: Task[];
  archivedTasks?: Task[];
  projects?: Project[];
  learnings?: Learning[];
  routines?: Routine[];
  routineLogs?: RoutineLog[];
  userId?: string;
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onImportData?: (payload: BackupPayload) => Promise<void>;
};

const PERIODS: Array<{ id: StatsPeriod; label: string }> = [
  { id: 'day', label: 'Gün' },
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Ay' },
  { id: 'year', label: 'Yıl' },
];

const WEEKDAY_HEADERS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function StatsView({
  stats,
  streak = 1,
  tasks = [],
  archivedTasks = [],
  projects = [],
  learnings = [],
  routines = [],
  routineLogs = [],
  userId,
  onToggleTask,
}: StatsViewProps) {
  const [period, setPeriod] = useState<StatsPeriod>('week');

  const {
    weekOffset,
    setWeekOffset,
    monthOffset,
    setMonthOffset,
    selectedDayStr,
    setSelectedDayStr,
    selectedDayBucket,
    weeklyData,
    monthlyData,
    yearlyAndTableData,
  } = useStats(tasks, archivedTasks, projects, learnings);

  const routineStats = useRoutineStats(
    routines,
    routineLogs,
    period,
    weekOffset,
    monthOffset,
    userId
  );

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (stats.completionRate / 100) * circumference;

  const getPriorityCount = (p: 'high' | 'medium' | 'low') => {
    if (p === 'high') return stats.highPriority;
    if (p === 'medium') return stats.mediumPriority;
    return stats.lowPriority;
  };

  // Trend çizgisi SVG noktaları (Ay görünümü için)
  const trendSvg = (() => {
    const pts = monthlyData.trendPoints;
    if (pts.length === 0) return { polyline: '', area: '', coords: [] };
    const maxVal = Math.max(4, ...pts.map((p) => p.value));
    const width = 280;
    const height = 80;
    const padX = 16;
    const padY = 12;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const coords = pts.map((pt, i) => {
      const x =
        pts.length > 1 ? padX + (i / (pts.length - 1)) * usableW : width / 2;
      const y = padY + usableH - (pt.value / maxVal) * usableH;
      return { x, y, label: pt.label, value: pt.value };
    });

    const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const firstX = coords[0]?.x ?? padX;
    const lastX = coords[coords.length - 1]?.x ?? width - padX;
    const area = `${firstX},${height - padY} ${polyline} ${lastX},${height - padY}`;
    return { polyline, area, coords };
  })();

  return (
    <div className="px-5 pb-8 space-y-4 select-none animate-fade-in">
      {/* ─── GÜN / HAFTA / AY / YIL SEGMENT KONTROLÜ ─── */}
      <div
        className="grid grid-cols-4 p-1 rounded-2xl border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        role="tablist"
        aria-label="İstatistik dönemi seçimi"
      >
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(p.id)}
              className={`py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                active ? 'text-white shadow-sm' : 'text-app-secondary hover:text-app-primary'
              }`}
              style={
                active
                  ? {
                      background: 'var(--primary)',
                      boxShadow: '0 4px 12px var(--primary-glow)',
                    }
                  : { background: 'transparent' }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          1. GÜN GÖRÜNÜMÜ (Mevcut Günlük Dairesel Özet & Öncelik Dağılımı)
         ═══════════════════════════════════════════════════════════════════════ */}
      {period === 'day' && (
        <div className="space-y-4 animate-fade-in">
          <div
            className="border rounded-3xl p-6 flex flex-col items-center transition-colors duration-300"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={stats.completionRate === 100 ? '#10B981' : '#6366F1'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-app-primary text-3xl font-extrabold tracking-tight">
                  %{stats.completionRate}
                </p>
                <p className="text-app-muted text-[11px] font-semibold mt-0.5 uppercase tracking-wider">
                  Tamamlama
                </p>
              </div>
            </div>

            <p className="text-app-secondary text-sm text-center font-medium">
              {stats.total > 0
                ? `${stats.completed} / ${stats.total} görev tamamlandı`
                : 'Henüz görev eklenmedi'}
            </p>

            <div
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.22)',
                color: '#FBBF24',
              }}
            >
              <Flame size={13} className="fill-amber-400 text-amber-400" />
              <span>{streak} Günlük Aktif Seri</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <StatCard
              icon={<Clock size={17} className="text-indigo-400" />}
              iconBg="var(--primary-dim)"
              label="Bekleyen"
              value={stats.active}
              sub="aktif görev"
              accentColor="#818CF8"
            />
            <StatCard
              icon={<CheckCircle2 size={17} className="text-emerald-400" />}
              iconBg="rgba(16, 185, 129, 0.12)"
              label="Tamamlanan"
              value={stats.completed}
              sub="başarılı"
              accentColor="#34D399"
            />
            <StatCard
              icon={<Flame size={17} className="text-red-400" />}
              iconBg="rgba(239, 68, 68, 0.12)"
              label="Yüksek Öncelik"
              value={stats.highPriority}
              sub="kritik görev"
              accentColor="#F87171"
            />
            <StatCard
              icon={<Target size={17} className="text-amber-400" />}
              iconBg="rgba(245, 158, 11, 0.12)"
              label="Toplam"
              value={stats.total}
              sub="tüm görevler"
              accentColor="#FBBF24"
            />
          </div>

          {/* Öncelik Dağılımı */}
          <div
            className="border rounded-3xl p-5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-indigo-400" />
              <span>Öncelik Dağılımı</span>
            </h3>
            <div className="space-y-3.5">
              {(['high', 'medium', 'low'] as const).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const count = getPriorityCount(p);
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

                return (
                  <div key={p} className="flex items-center gap-3">
                    <span className={`text-xs font-semibold w-14 ${cfg.textColor}`}>
                      {cfg.label}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        className={`h-full ${cfg.color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-app-secondary text-xs font-semibold w-8 text-right tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          2. HAFTA GÖRÜNÜMÜ (7 Günlük Şerit, Mini Halkalar, Gün Detayı, Hedef)
         ═══════════════════════════════════════════════════════════════════════ */}
      {period === 'week' && (
        <div className="space-y-4 animate-fade-in">
          {/* Haftalar Arası Gezinme Barı */}
          <div
            className="rounded-2xl p-3 border flex items-center justify-between"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Önceki hafta"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-all active:scale-90"
              style={{ background: 'var(--surface-2)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Calendar size={13} className="text-indigo-400" />
                <span className="text-app-primary text-xs sm:text-sm font-bold tracking-tight">
                  {weeklyData.rangeLabel}
                </span>
              </div>
              {weekOffset !== 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setWeekOffset(0);
                    setSelectedDayStr(toDateStr(new Date()));
                  }}
                  className="text-[10px] font-bold text-indigo-400 hover:underline mt-0.5"
                >
                  Bu Haftaya Dön
                </button>
              ) : (
                <p className="text-app-muted text-[10px] font-medium mt-0.5">Bu Hafta</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Sonraki hafta"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-all active:scale-90"
              style={{ background: 'var(--surface-2)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Pzt–Paz 7 Günlük Şerit (Mini İlerleme Halkalı) */}
          <div
            className="rounded-3xl p-3.5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="grid grid-cols-7 gap-1.5">
              {weeklyData.days.map((d) => {
                const isSelected = selectedDayStr === d.dateStr;
                const miniR = 13;
                const miniC = 2 * Math.PI * miniR;
                const miniOffset = miniC - (d.rate / 100) * miniC;

                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDayStr(d.dateStr)}
                    className="flex flex-col items-center py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer"
                    style={
                      isSelected
                        ? {
                            background: 'var(--primary-dim)',
                            border: '1px solid rgba(99, 102, 241, 0.45)',
                          }
                        : {
                            background: d.isToday ? 'var(--surface-2)' : 'transparent',
                            border: '1px solid transparent',
                          }
                    }
                  >
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isSelected
                          ? 'text-indigo-300'
                          : d.isToday
                            ? 'text-app-primary'
                            : 'text-app-muted'
                      }`}
                    >
                      {d.dayShort}
                    </span>

                    {/* Mini Dairesel İlerleme Halkası */}
                    <div className="relative w-8 h-8 my-1 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                        <circle
                          cx="16"
                          cy="16"
                          r={miniR}
                          fill="none"
                          stroke="var(--surface-2)"
                          strokeWidth="2.8"
                        />
                        {d.totalCount > 0 && (
                          <circle
                            cx="16"
                            cy="16"
                            r={miniR}
                            fill="none"
                            stroke={d.rate === 100 ? '#10B981' : '#6366F1'}
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeDasharray={miniC}
                            strokeDashoffset={miniOffset}
                          />
                        )}
                      </svg>
                      <span className="absolute text-[10px] font-bold text-app-primary tabular-nums">
                        {d.dayNumber}
                      </span>
                    </div>

                    <span className="text-[9px] font-semibold text-app-secondary tabular-nums">
                      {d.completedCount}/{d.totalCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seçili Günün Yapılan / Yapılmayan Görevleri */}
          <div
            className="rounded-3xl p-4 border animate-fade-in"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-app-muted text-[10px] font-bold uppercase tracking-wider">
                  Seçili Gün Detayı
                </p>
                <h3 className="text-app-primary text-sm font-bold capitalize mt-0.5">
                  {selectedDayBucket.dayFull}
                </h3>
              </div>
              <span
                className="px-2.5 py-1 rounded-xl text-xs font-bold"
                style={{
                  background:
                    selectedDayBucket.rate === 100 && selectedDayBucket.totalCount > 0
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'var(--primary-dim)',
                  color:
                    selectedDayBucket.rate === 100 && selectedDayBucket.totalCount > 0
                      ? '#34D399'
                      : 'var(--primary-light)',
                }}
              >
                {selectedDayBucket.completedCount}/{selectedDayBucket.totalCount} yapıldı
              </span>
            </div>

            {selectedDayBucket.completedTasks.length === 0 &&
            selectedDayBucket.pendingTasks.length === 0 ? (
              <p className="text-app-muted text-xs py-4 text-center">
                Bu gün için kayıtlı görev bulunmuyor.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedDayBucket.completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask && onToggleTask(t.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className="text-xs font-medium text-app-muted line-through truncate">
                        {t.title}
                      </span>
                    </button>
                    <span className="text-[10px] font-semibold text-emerald-400 flex-shrink-0">
                      Yapıldı
                    </span>
                  </div>
                ))}

                {selectedDayBucket.pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask && onToggleTask(t.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        style={{
                          border: `1.5px solid ${PRIORITY_CONFIG[t.priority].hex}`,
                        }}
                      />
                      <span className="text-xs font-semibold text-app-primary truncate">
                        {t.title}
                      </span>
                    </button>
                    <span className="text-[10px] font-semibold text-amber-400 flex-shrink-0">
                      Bekliyor
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Haftalık Özet Kartları (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-3.5">
            <div
              className="rounded-2xl p-4 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">
                Tamamlanan
              </p>
              <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
                {weeklyData.totalCompleted}
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold">
                {weeklyData.vsPrevWeekPct >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-400">
                    <ArrowUpRight size={12} />
                    <span>+{weeklyData.vsPrevWeekPct}% geçen haftaya göre</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                    <ArrowDownRight size={12} />
                    <span>{weeklyData.vsPrevWeekPct}% geçen haftaya göre</span>
                  </span>
                )}
              </div>
            </div>

            <div
              className="rounded-2xl p-4 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">
                Haftalık Oran
              </p>
              <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
                %{weeklyData.completionRate}
              </p>
              <p className="text-app-secondary text-[11px] font-medium mt-1.5">
                {weeklyData.totalCompleted}/{weeklyData.totalTasks} görev bitti
              </p>
            </div>

            <div
              className="rounded-2xl p-4 border col-span-2 flex items-center justify-between"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(16, 185, 129, 0.14)' }}
                >
                  <Award size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase">
                    En Verimli Gün
                  </p>
                  <p className="text-app-primary text-sm font-bold capitalize mt-0.5">
                    {weeklyData.bestDay
                      ? `${weeklyData.bestDay.dayFull} (${weeklyData.bestDay.completedCount} görev)`
                      : 'Henüz tamamlanan görev yok'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Haftalık Kategori Dağılımı */}
          <div
            className="rounded-3xl p-5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider mb-3.5 flex items-center gap-2">
              <Layers size={14} className="text-indigo-400" />
              <span>Haftalık Kategori Dağılımı</span>
            </h3>
            <div className="space-y-3">
              {(['work', 'personal', 'urgent'] as const).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const item = weeklyData.catCounts[cat];
                const pct =
                  item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-app-primary flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: cfg.dotColor }}
                        />
                        {cfg.label}
                      </span>
                      <span className="text-app-secondary font-semibold tabular-nums">
                        {item.completed}/{item.total} (%{pct})
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: cfg.dotColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          3. AY GÖRÜNÜMÜ (Isı Haritası Takvim, Seri, Saat Aralığı, Trend Çizgisi)
         ═══════════════════════════════════════════════════════════════════════ */}
      {period === 'month' && (
        <div className="space-y-4 animate-fade-in">
          {/* Ay Gezinme Barı */}
          <div
            className="rounded-2xl p-3 border flex items-center justify-between"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              aria-label="Önceki ay"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-all active:scale-90"
              style={{ background: 'var(--surface-2)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="text-center">
              <p className="text-app-primary text-sm font-bold capitalize">
                {monthlyData.monthLabel}
              </p>
              {monthOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setMonthOffset(0)}
                  className="text-[10px] font-bold text-indigo-400 hover:underline"
                >
                  Bu Aya Dön
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMonthOffset((m) => m + 1)}
              aria-label="Sonraki ay"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-all active:scale-90"
              style={{ background: 'var(--surface-2)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Aylık Isı Haritası Takvim (Heatmap) */}
          <div
            className="rounded-3xl p-4 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-400" />
                <span>Aylık Aktivite Isı Haritası</span>
              </h3>
              <span className="text-app-secondary text-[11px] font-semibold">
                {monthlyData.completedCount} görev
              </span>
            </div>

            {/* Gün Başlıkları */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
              {WEEKDAY_HEADERS.map((wd) => (
                <span key={wd} className="text-[10px] font-bold text-app-muted">
                  {wd}
                </span>
              ))}
            </div>

            {/* Takvim Izgarası */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: monthlyData.leadingEmptySlots }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-9 rounded-xl opacity-0" />
              ))}

              {monthlyData.days.map((d) => {
                const isSelected = selectedDayStr === d.dateStr;
                const bgMap: Record<0 | 1 | 2 | 3 | 4, string> = {
                  0: 'var(--surface-2)',
                  1: 'rgba(16, 185, 129, 0.22)',
                  2: 'rgba(16, 185, 129, 0.42)',
                  3: 'rgba(16, 185, 129, 0.68)',
                  4: '#10B981',
                };

                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDayStr(d.dateStr)}
                    title={`${d.dayFull}: ${d.completedCount} tamamlanan`}
                    className="h-9 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 cursor-pointer relative"
                    style={{
                      background: bgMap[d.intensity],
                      border: isSelected
                        ? '1.5px solid #818CF8'
                        : d.isToday
                          ? '1px solid var(--border-strong)'
                          : '1px solid transparent',
                    }}
                  >
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        d.intensity >= 3 ? 'text-white' : 'text-app-primary'
                      }`}
                    >
                      {d.dayNumber}
                    </span>
                    {d.completedCount > 0 && (
                      <span
                        className={`text-[8px] font-bold leading-none ${
                          d.intensity >= 3 ? 'text-emerald-100' : 'text-emerald-400'
                        }`}
                      >
                        {d.completedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Yoğunluk Göstergesi */}
            <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-app-muted">
              <span>Az</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <span
                  key={lvl}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background:
                      lvl === 0
                        ? 'var(--surface-2)'
                        : lvl === 1
                          ? 'rgba(16, 185, 129, 0.22)'
                          : lvl === 2
                            ? 'rgba(16, 185, 129, 0.42)'
                            : lvl === 3
                              ? 'rgba(16, 185, 129, 0.68)'
                              : '#10B981',
                  }}
                />
              ))}
              <span>Çok</span>
            </div>
          </div>

          {/* Aylık Ayrıntılı Metrik Kartları */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl p-3.5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">Aylık Oran</p>
              <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
                %{monthlyData.monthlyRate}
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                {monthlyData.vsPrevMonthPct >= 0
                  ? `+${monthlyData.vsPrevMonthPct}% önceki aya göre`
                  : `${monthlyData.vsPrevMonthPct}% önceki aya göre`}
              </p>
            </div>

            <div
              className="rounded-2xl p-3.5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">
                Günlük Ortalama
              </p>
              <p className="text-app-primary text-2xl font-extrabold mt-1 tabular-nums">
                {monthlyData.dailyAverage}
              </p>
              <p className="text-[11px] text-app-secondary font-medium mt-1">
                görev / gün ({monthlyData.completedCount} toplam)
              </p>
            </div>

            <div
              className="rounded-2xl p-3.5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">
                Mevcut / En Uzun Seri
              </p>
              <p className="text-amber-400 text-xl font-extrabold mt-1 tabular-nums">
                🔥 {streak}g / {Math.max(streak, monthlyData.longestStreak)}g
              </p>
              <p className="text-[11px] text-app-secondary font-medium mt-1">
                kesintisiz aktif gün
              </p>
            </div>

            <div
              className="rounded-2xl p-3.5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-bold uppercase">
                En Verimli Saatler
              </p>
              <p className="text-indigo-400 text-base font-extrabold mt-1.5 tabular-nums">
                {monthlyData.bestHourRange}
              </p>
              <p className="text-[11px] text-app-secondary font-medium mt-1">
                odak zirvesi
              </p>
            </div>
          </div>

          {/* Aylık Trend Çizgisi (Saf SVG) */}
          <div
            className="rounded-3xl p-4 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={13} className="text-indigo-400" />
                <span>Aylık Tamamlama Trendi</span>
              </h3>
              <span className="text-[10px] text-app-muted font-semibold">5 Günlük Dilimler</span>
            </div>

            <svg className="w-full h-24 overflow-visible" viewBox="0 0 280 88">
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {trendSvg.area && <polygon points={trendSvg.area} fill="url(#trendGrad)" />}
              {trendSvg.polyline && (
                <polyline
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendSvg.polyline}
                />
              )}
              {trendSvg.coords.map((c, idx) => (
                <g key={idx}>
                  <circle cx={c.x} cy={c.y} r="3.5" fill="#6366F1" stroke="#ffffff" strokeWidth="1.2" />
                  <text
                    x={c.x}
                    y={84}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontWeight="600"
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {c.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          4. YIL GÖRÜNÜMÜ (12 Aylık Grafik & Yıllık Özet)
         ═══════════════════════════════════════════════════════════════════════ */}
      {period === 'year' && (
        <div className="space-y-4 animate-fade-in">
          <div
            className="rounded-3xl p-5 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-app-muted text-[10px] font-bold uppercase tracking-wider">
                  {yearlyAndTableData.year} Yılı Performansı
                </p>
                <h3 className="text-app-primary text-xl font-extrabold mt-0.5">
                  {yearlyAndTableData.yearlyTotalCompleted} Görev Tamamlandı
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300">
                En İyi: {yearlyAndTableData.bestMonth.label}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-1.5 items-end h-28 pt-4">
              {yearlyAndTableData.months.map((m) => {
                const maxM = Math.max(
                  1,
                  ...yearlyAndTableData.months.map((item) => item.count)
                );
                const h = m.count > 0 ? Math.max(14, Math.round((m.count / maxM) * 72)) : 6;
                const isCur = m.monthIndex === new Date().getMonth();
                return (
                  <div key={m.monthIndex} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-app-secondary tabular-nums">
                      {m.count > 0 ? m.count : ''}
                    </span>
                    <div
                      className="w-full rounded-md transition-all duration-300"
                      style={{
                        height: `${h}px`,
                        background: isCur
                          ? '#10B981'
                          : m.count > 0
                            ? '#6366F1'
                            : 'var(--surface-2)',
                      }}
                    />
                    <span className="text-[9px] font-semibold text-app-muted">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PROJE BAZLI & KATEGORİ BAZLI İLERLEME TABLOLARI + ÖĞRENME NOTU SAYISI
         ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-3xl p-4 border space-y-3"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-app-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <FolderKanban size={14} className="text-indigo-400" />
            <span>Proje & Kategori İlerleme Tablosu</span>
          </h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/12 text-emerald-300">
            <BookOpen size={10} />
            <span>{yearlyAndTableData.totalLearnings} Öğrenme Notu</span>
          </span>
        </div>

        {/* Projeler Tablosu */}
        {yearlyAndTableData.projectRows.length > 0 && (
          <div className="space-y-2 pt-1">
            {yearlyAndTableData.projectRows.map((row) => (
              <div
                key={row.id}
                className="p-2.5 rounded-xl border flex items-center justify-between gap-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: row.color }}
                    />
                    <span className="text-xs font-bold text-app-primary truncate">
                      {row.name}
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden mt-1.5"
                    style={{ background: 'var(--bg-2)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.pct}%`, background: row.color }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-extrabold text-app-primary tabular-nums">
                    %{row.pct}
                  </p>
                  <p className="text-[10px] text-app-muted tabular-nums">
                    {row.completed}/{row.total} görev · {row.noteCount} not
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kategoriler Tablosu */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {yearlyAndTableData.categoryRows.map((cRow) => {
            const cfg = CATEGORY_CONFIG[cRow.category];
            return (
              <div
                key={cRow.category}
                className="p-2.5 rounded-xl border text-center"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] font-bold" style={{ color: cfg.dotColor }}>
                  {cfg.shortLabel}
                </p>
                <p className="text-base font-extrabold text-app-primary mt-0.5 tabular-nums">
                  %{cRow.pct}
                </p>
                <p className="text-[10px] text-app-muted tabular-nums">
                  {cRow.completed}/{cRow.total}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RUTİN İSTATİSTİKLERİ (GÜN / HAFTA / AY ORANLARI, ISI HARİTASI & TABLO)
         ═══════════════════════════════════════════════════════════════════════ */}
      {routineStats.hasRoutines && (
        <div
          className="rounded-3xl p-4 border space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.14)' }}
              >
                <Repeat size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-app-primary text-xs font-bold">
                  Rutin Takibi & Tutarlılık Analizi
                </p>
                <p className="text-app-muted text-[11px]">
                  Bugün {routineStats.todayEval.totalDone}/{routineStats.todayEval.totalPlanned} rutin tamamlandı
                </p>
              </div>
            </div>

            {/* Dönem Karşılaştırma Rozeti (±%) */}
            {(period === 'week' || period === 'month') && (
              <span
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-xs font-bold tabular-nums"
                style={{
                  background:
                    (period === 'week'
                      ? routineStats.weekDiffPct
                      : routineStats.monthDiffPct) >= 0
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(239, 68, 68, 0.14)',
                  color:
                    (period === 'week'
                      ? routineStats.weekDiffPct
                      : routineStats.monthDiffPct) >= 0
                      ? '#34D399'
                      : '#FCA5A5',
                }}
              >
                {(period === 'week'
                  ? routineStats.weekDiffPct
                  : routineStats.monthDiffPct) >= 0 ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                <span>
                  {(period === 'week'
                    ? routineStats.weekDiffPct
                    : routineStats.monthDiffPct) >= 0
                    ? '+'
                    : ''}
                  {period === 'week'
                    ? routineStats.weekDiffPct
                    : routineStats.monthDiffPct}
                  %
                </span>
              </span>
            )}
          </div>

          {/* 3'lü Dönem Özeti: Bugün / Bu Hafta / Bu Ay */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-2xl p-2.5 border"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-semibold uppercase">Bugün</p>
              <p className="text-app-primary text-base font-extrabold mt-0.5 tabular-nums">
                %{routineStats.todayEval.overallRate}
              </p>
              <p className="text-app-secondary text-[11px] tabular-nums">
                {routineStats.todayEval.totalDone}/{routineStats.todayEval.totalPlanned} yapıldı
              </p>
            </div>

            <div
              className="rounded-2xl p-2.5 border"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-semibold uppercase">Haftalık</p>
              <p className="text-app-primary text-base font-extrabold mt-0.5 tabular-nums">
                %{routineStats.weekEval.overallRate}
              </p>
              <p className="text-app-secondary text-[11px] tabular-nums">
                {routineStats.weekEval.totalDone}/{routineStats.weekEval.totalPlanned} yapıldı
              </p>
            </div>

            <div
              className="rounded-2xl p-2.5 border"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
            >
              <p className="text-app-muted text-[10px] font-semibold uppercase">Aylık</p>
              <p className="text-app-primary text-base font-extrabold mt-0.5 tabular-nums">
                %{routineStats.monthEval.overallRate}
              </p>
              <p className="text-app-secondary text-[11px] tabular-nums">
                {routineStats.monthEval.totalDone}/{routineStats.monthEval.totalPlanned} yapıldı
              </p>
            </div>
          </div>

          {/* Haftalık Görünüm: 7 Günlük Rutin Tamamlama Halkaları */}
          {(period === 'week' || period === 'day') && (
            <div>
              <p className="text-app-secondary text-xs font-semibold mb-2">
                Haftalık Rutin Tamamlama Şeridi
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {routineStats.weekEval.days.map((d) => {
                  const r = 12;
                  const c = 2 * Math.PI * r;
                  const off = c - (d.rate / 100) * c;
                  return (
                    <div
                      key={d.dateStr}
                      className="rounded-xl py-2 px-1 flex flex-col items-center gap-1 border"
                      style={{
                        background: d.isToday ? 'var(--primary-dim)' : 'var(--bg-2)',
                        borderColor: d.isToday ? 'var(--primary)' : 'var(--border)',
                        opacity: d.isFuture ? 0.45 : 1,
                      }}
                    >
                      <span className="text-[10px] font-bold text-app-secondary">
                        {d.shortLabel}
                      </span>
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 30 30">
                          <circle
                            cx="15"
                            cy="15"
                            r={r}
                            fill="none"
                            stroke="var(--surface-2)"
                            strokeWidth="2.8"
                          />
                          {d.planned > 0 && (
                            <circle
                              cx="15"
                              cy="15"
                              r={r}
                              fill="none"
                              stroke={d.rate === 100 ? '#10B981' : '#6366F1'}
                              strokeWidth="2.8"
                              strokeLinecap="round"
                              strokeDasharray={c}
                              strokeDashoffset={off}
                            />
                          )}
                        </svg>
                        <span className="absolute text-[9px] font-bold text-app-primary tabular-nums">
                          {d.planned > 0 ? `${d.done}/${d.planned}` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aylık Görünüm: Rutin Tamamlama Yoğunluğu Isı Haritası Takvimi */}
          {period === 'month' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-app-secondary text-xs font-semibold">
                  Aylık Rutin Yoğunluk Isı Haritası
                </p>
                <span className="text-[10px] text-app-muted">
                  Önceki aya göre {routineStats.monthDiffPct >= 0 ? '+' : ''}
                  {routineStats.monthDiffPct}%
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_HEADERS.map((h) => (
                  <div
                    key={h}
                    className="text-center text-[10px] font-semibold text-app-muted"
                  >
                    {h}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: routineStats.monthLeadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} className="aspect-square" />
                ))}
                {routineStats.monthEval.days.map((d) => {
                  const intensityBg =
                    d.intensity === 4
                      ? 'rgba(16, 185, 129, 0.45)'
                      : d.intensity === 3
                        ? 'rgba(16, 185, 129, 0.28)'
                        : d.intensity === 2
                          ? 'rgba(99, 102, 241, 0.25)'
                          : d.intensity === 1
                            ? 'rgba(245, 158, 11, 0.22)'
                            : 'var(--bg-2)';

                  return (
                    <div
                      key={d.dateStr}
                      title={`${d.dateStr}: ${d.done}/${d.planned} rutin (%${d.rate})`}
                      className="aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-bold tabular-nums border"
                      style={{
                        background: intensityBg,
                        borderColor: d.isToday ? 'var(--primary)' : 'var(--border)',
                        color:
                          d.intensity >= 3
                            ? '#34D399'
                            : d.isFuture
                              ? 'var(--text-faint)'
                              : 'var(--text-secondary)',
                      }}
                    >
                      <span>{d.dayNum}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* En Tutarlı ve En Çok Aksayan Rutin */}
          {(routineStats.mostConsistent || routineStats.mostMissed) && (
            <div className="grid grid-cols-2 gap-2">
              {routineStats.mostConsistent && (
                <div
                  className="rounded-2xl p-3 border"
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderColor: 'rgba(16, 185, 129, 0.22)',
                  }}
                >
                  <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                    <Award size={12} />
                    <span>En Tutarlı Rutin</span>
                  </div>
                  <p className="text-app-primary text-xs font-bold mt-1 truncate">
                    {routineStats.mostConsistent.routine.icon}{' '}
                    {routineStats.mostConsistent.routine.title}
                  </p>
                  <p className="text-emerald-300 text-xs font-semibold mt-0.5 tabular-nums">
                    %{routineStats.mostConsistent.rate} ({routineStats.mostConsistent.done}/
                    {routineStats.mostConsistent.planned})
                  </p>
                </div>
              )}

              {routineStats.mostMissed && (
                <div
                  className="rounded-2xl p-3 border"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.22)',
                  }}
                >
                  <div className="flex items-center gap-1 text-amber-400 text-[11px] font-bold">
                    <AlertTriangle size={12} />
                    <span>En Çok Aksayan</span>
                  </div>
                  <p className="text-app-primary text-xs font-bold mt-1 truncate">
                    {routineStats.mostMissed.routine.icon}{' '}
                    {routineStats.mostMissed.routine.title}
                  </p>
                  <p className="text-amber-300 text-xs font-semibold mt-0.5 tabular-nums">
                    %{routineStats.mostMissed.rate} ({routineStats.mostMissed.done}/
                    {routineStats.mostMissed.planned})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rutin Bazlı Performans Tablosu */}
          <div className="space-y-2 pt-1">
            <p className="text-app-secondary text-xs font-semibold">
              Rutin Bazlı İlerleme Tablosu
            </p>
            {routineStats.routineTable.map((row) => (
              <div
                key={row.routine.id}
                className="rounded-2xl p-3 border flex items-center justify-between gap-3"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base flex-shrink-0">{row.routine.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-app-primary text-xs font-bold truncate">
                        {row.routine.title}
                      </p>
                      <span className="text-xs font-bold text-app-secondary tabular-nums flex-shrink-0">
                        {row.done}/{row.planned} · %{row.rate}
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden mt-1.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${row.rate}%`,
                          background: row.rate >= 80 ? '#10B981' : row.routine.color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold tabular-nums flex-shrink-0"
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#FBBF24',
                  }}
                >
                  <Flame size={11} className="fill-amber-400" />
                  <span>{row.currentStreak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  sub: string;
  accentColor: string;
};

function StatCard({ icon, iconBg, label, value, sub, accentColor }: StatCardProps) {
  return (
    <div
      className="border rounded-2xl p-4 transition-all duration-200"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p className="text-app-primary text-2xl font-bold tracking-tight leading-none tabular-nums">
        {value}
      </p>
      <p className="text-app-secondary text-xs font-semibold mt-1.5">{label}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: accentColor, opacity: 0.8 }}>
        {sub}
      </p>
    </div>
  );
}
