import { useState, useMemo, useCallback } from 'react';
import type { Category, Learning, Project, Task } from '../types';

export type StatsPeriod = 'day' | 'week' | 'month' | 'year';

export type DayBucket = {
  dateStr: string;
  dayShort: string;
  dayFull: string;
  dayNumber: number;
  isToday: boolean;
  completedTasks: Task[];
  pendingTasks: Task[];
  completedCount: number;
  totalCount: number;
  rate: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

const WEEKLY_GOAL_KEY = 'flowday_weekly_goal_v1';

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getMondayOfWeek(baseDate: Date, weekOffset: number): Date {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = d.getDay(); // 0=Paz, 1=Pzt ...
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday + weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

export function useStats(
  tasks: Task[],
  archivedTasks: Task[],
  projects: Project[],
  learnings: Learning[]
) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => toDateStr(new Date()));
  const [weeklyGoal, setWeeklyGoalState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(WEEKLY_GOAL_KEY);
      const parsed = raw ? parseInt(raw, 10) : 15;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
    } catch {
      return 15;
    }
  });

  const setWeeklyGoal = useCallback((val: number) => {
    const clamped = Math.max(1, Math.min(200, Math.round(val)));
    setWeeklyGoalState(clamped);
    try {
      localStorage.setItem(WEEKLY_GOAL_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  // Tüm görevleri (aktif + tamamlanan + arşiv) tekilleştirerek birleştir
  const allTasks = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of archivedTasks) map.set(t.id, t);
    for (const t of tasks) map.set(t.id, t);
    return Array.from(map.values());
  }, [tasks, archivedTasks]);

  const todayStr = toDateStr(new Date());

  // Belirli bir YYYY-MM-DD günü için yapılan ve yapılmayan görevleri hesapla
  const buildDayBucket = useCallback(
    (dateObj: Date): DayBucket => {
      const dStr = toDateStr(dateObj);
      const completedOnDay = allTasks.filter(
        (t) => t.completed && (t.completed_at ?? t.created_at).slice(0, 10) === dStr
      );
      const pendingOnDay = allTasks.filter((t) => {
        if (t.completed) return false;
        const createdDay = t.created_at.slice(0, 10);
        if (dStr === todayStr) return true;
        return createdDay === dStr;
      });

      const completedCount = completedOnDay.length;
      const totalCount = completedCount + pendingOnDay.length;
      const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        dateStr: dStr,
        dayShort: dateObj.toLocaleDateString('tr-TR', { weekday: 'short' }),
        dayFull: dateObj.toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        dayNumber: dateObj.getDate(),
        isToday: dStr === todayStr,
        completedTasks: completedOnDay,
        pendingTasks: pendingOnDay,
        completedCount,
        totalCount,
        rate,
        intensity: computeIntensity(completedCount),
      };
    },
    [allTasks, todayStr]
  );

  // ─── HAFTALIK VERİLER (Pzt–Paz 7 Günlük Şerit & Özet) ───────────────────────
  const weeklyData = useMemo(() => {
    const monday = getMondayOfWeek(new Date(), weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return buildDayBucket(d);
    });

    const sameMonth = monday.getMonth() === sunday.getMonth();
    const rangeLabel = sameMonth
      ? `${monday.getDate()}–${sunday.getDate()} ${sunday.toLocaleDateString('tr-TR', {
          month: 'long',
        })}`
      : `${monday.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
        })} – ${sunday.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
        })}`;

    const totalCompleted = days.reduce((acc, d) => acc + d.completedCount, 0);
    const totalPending = days.reduce((acc, d) => acc + d.pendingTasks.length, 0);
    const totalTasks = totalCompleted + totalPending;
    const completionRate =
      totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // En verimli gün
    let bestDay: DayBucket | null = null;
    for (const d of days) {
      if (d.completedCount > 0 && (!bestDay || d.completedCount > bestDay.completedCount)) {
        bestDay = d;
      }
    }

    // Kategori dağılımı (bu haftaki görevler)
    const weekTasks = days.flatMap((d) => [...d.completedTasks, ...d.pendingTasks]);
    const uniqueWeekTasks = Array.from(new Map(weekTasks.map((t) => [t.id, t])).values());
    const catCounts: Record<Category, { completed: number; total: number }> = {
      work: { completed: 0, total: 0 },
      personal: { completed: 0, total: 0 },
      urgent: { completed: 0, total: 0 },
    };
    for (const t of uniqueWeekTasks) {
      const cat: Category =
        t.category ?? (t.priority === 'high' ? 'urgent' : 'personal');
      catCounts[cat].total += 1;
      if (t.completed) catCounts[cat].completed += 1;
    }

    // Geçen haftayla karşılaştırma (±%)
    const prevMonday = getMondayOfWeek(new Date(), weekOffset - 1);
    let prevWeekCompleted = 0;
    for (let i = 0; i < 7; i++) {
      const pd = new Date(prevMonday);
      pd.setDate(prevMonday.getDate() + i);
      const pdStr = toDateStr(pd);
      prevWeekCompleted += allTasks.filter(
        (t) => t.completed && (t.completed_at ?? t.created_at).slice(0, 10) === pdStr
      ).length;
    }

    const vsPrevWeekPct =
      prevWeekCompleted > 0
        ? Math.round(((totalCompleted - prevWeekCompleted) / prevWeekCompleted) * 100)
        : totalCompleted > 0
          ? 100
          : 0;

    return {
      days,
      rangeLabel,
      totalCompleted,
      totalTasks,
      completionRate,
      bestDay,
      catCounts,
      prevWeekCompleted,
      vsPrevWeekPct,
    };
  }, [weekOffset, buildDayBucket, allTasks]);

  // ─── AYLIK VERİLER (Isı Haritası, Seri, Saat Aralığı, Trend) ────────────────
  const monthlyData = useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = firstOfMonth.getFullYear();
    const month = firstOfMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmptySlots = (firstOfMonth.getDay() + 6) % 7; // Pzt = 0

    const monthLabel = firstOfMonth.toLocaleDateString('tr-TR', {
      month: 'long',
      year: 'numeric',
    });

    const days: DayBucket[] = Array.from({ length: daysInMonth }, (_, idx) => {
      const d = new Date(year, month, idx + 1);
      return buildDayBucket(d);
    });

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const completedInMonth = allTasks.filter(
      (t) => t.completed && (t.completed_at ?? t.created_at).startsWith(monthPrefix)
    );
    const createdInMonth = allTasks.filter((t) => t.created_at.startsWith(monthPrefix));
    const totalMonthScope = Math.max(completedInMonth.length, createdInMonth.length);
    const monthlyRate =
      totalMonthScope > 0
        ? Math.min(100, Math.round((completedInMonth.length / totalMonthScope) * 100))
        : 0;

    const elapsedDays =
      monthOffset === 0 ? Math.max(1, now.getDate()) : daysInMonth;
    const dailyAverage = Number((completedInMonth.length / elapsedDays).toFixed(1));

    // Önceki ayla karşılaştırma
    const prevMonthDate = new Date(year, month - 1, 1);
    const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(
      prevMonthDate.getMonth() + 1
    ).padStart(2, '0')}`;
    const prevMonthCompleted = allTasks.filter(
      (t) => t.completed && (t.completed_at ?? t.created_at).startsWith(prevMonthPrefix)
    ).length;

    const vsPrevMonthPct =
      prevMonthCompleted > 0
        ? Math.round(
            ((completedInMonth.length - prevMonthCompleted) / prevMonthCompleted) * 100
          )
        : completedInMonth.length > 0
          ? 100
          : 0;

    // En uzun seri & mevcut seri (tüm completed_at tarihlerinden)
    const completedDateSet = new Set<string>();
    for (const t of allTasks) {
      if (t.completed) {
        completedDateSet.add((t.completed_at ?? t.created_at).slice(0, 10));
      }
    }
    const sortedDates = Array.from(completedDateSet).sort();
    let longestStreak = 0;
    let running = 0;
    let prevDateObj: Date | null = null;
    for (const ds of sortedDates) {
      const cur = new Date(`${ds}T00:00:00`);
      if (prevDateObj) {
        const diffDays = Math.round(
          (cur.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          running += 1;
        } else {
          running = 1;
        }
      } else {
        running = 1;
      }
      if (running > longestStreak) longestStreak = running;
      prevDateObj = cur;
    }

    // En verimli saat aralığı (completed_at saatlerinden)
    const hourSlots = [
      { label: '06:00 – 09:00', min: 6, max: 9, count: 0 },
      { label: '09:00 – 12:00', min: 9, max: 12, count: 0 },
      { label: '12:00 – 15:00', min: 12, max: 15, count: 0 },
      { label: '15:00 – 18:00', min: 15, max: 18, count: 0 },
      { label: '18:00 – 21:00', min: 18, max: 21, count: 0 },
      { label: '21:00 – 00:00', min: 21, max: 24, count: 0 },
    ];
    for (const t of allTasks) {
      if (!t.completed) continue;
      const iso = t.completed_at ?? t.created_at;
      const h = new Date(iso).getHours();
      const slot = hourSlots.find((s) => h >= s.min && h < s.max);
      if (slot) slot.count += 1;
    }
    const bestHourSlot =
      hourSlots.reduce(
        (best, cur) => (cur.count > best.count ? cur : best),
        hourSlots[1]
      );

    // Trend çizgisi için 5'er günlük (veya haftalık) toplam noktaları
    const trendPoints: Array<{ label: string; value: number }> = [];
    const chunkSize = 5;
    for (let i = 0; i < days.length; i += chunkSize) {
      const slice = days.slice(i, i + chunkSize);
      const sum = slice.reduce((acc, d) => acc + d.completedCount, 0);
      const firstDayNum = slice[0].dayNumber;
      const lastDayNum = slice[slice.length - 1].dayNumber;
      trendPoints.push({
        label: `${firstDayNum}-${lastDayNum}`,
        value: sum,
      });
    }

    return {
      monthLabel,
      leadingEmptySlots,
      days,
      completedCount: completedInMonth.length,
      totalCount: totalMonthScope,
      monthlyRate,
      dailyAverage,
      vsPrevMonthPct,
      longestStreak: Math.max(1, longestStreak),
      bestHourRange: bestHourSlot.count > 0 ? bestHourSlot.label : '09:00 – 12:00',
      trendPoints,
    };
  }, [monthOffset, buildDayBucket, allTasks]);

  // ─── YILLIK & PROJE / KATEGORİ TABLOLARI ───────────────────────────────────
  const yearlyAndTableData = useMemo(() => {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, mIdx) => {
      const prefix = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = new Date(year, mIdx, 1).toLocaleDateString('tr-TR', {
        month: 'short',
      });
      const count = allTasks.filter(
        (t) => t.completed && (t.completed_at ?? t.created_at).startsWith(prefix)
      ).length;
      return { monthIndex: mIdx, label, count };
    });

    const yearlyTotalCompleted = months.reduce((acc, m) => acc + m.count, 0);
    const bestMonth = months.reduce(
      (best, cur) => (cur.count > best.count ? cur : best),
      months[0]
    );

    // Proje bazlı ilerleme tablosu
    const projectRows = projects.map((proj) => {
      const pTasks = allTasks.filter((t) => t.project_id === proj.id);
      const pDone = pTasks.filter((t) => t.completed).length;
      const pTotal = pTasks.length;
      const pct = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;
      const noteCount = learnings.filter((l) => l.project_id === proj.id).length;
      return {
        id: proj.id,
        name: proj.name,
        color: proj.color,
        status: proj.status,
        completed: pDone,
        total: pTotal,
        pct,
        noteCount,
      };
    });

    // Kategori bazlı ilerleme tablosu
    const categories: Category[] = ['work', 'personal', 'urgent'];
    const categoryRows = categories.map((cat) => {
      const cTasks = allTasks.filter(
        (t) => (t.category ?? (t.priority === 'high' ? 'urgent' : 'personal')) === cat
      );
      const cDone = cTasks.filter((t) => t.completed).length;
      const cTotal = cTasks.length;
      const pct = cTotal > 0 ? Math.round((cDone / cTotal) * 100) : 0;
      return {
        category: cat,
        completed: cDone,
        total: cTotal,
        pct,
      };
    });

    return {
      year,
      months,
      yearlyTotalCompleted,
      bestMonth,
      projectRows,
      categoryRows,
      totalLearnings: learnings.length,
    };
  }, [allTasks, projects, learnings]);

  const selectedDayBucket = useMemo(() => {
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    const dateObj = y && m && d ? new Date(y, m - 1, d) : new Date();
    return buildDayBucket(dateObj);
  }, [selectedDayStr, buildDayBucket]);

  return {
    weekOffset,
    setWeekOffset,
    monthOffset,
    setMonthOffset,
    selectedDayStr,
    setSelectedDayStr,
    selectedDayBucket,
    weeklyGoal,
    setWeeklyGoal,
    weeklyData,
    monthlyData,
    yearlyAndTableData,
    allTasks,
  };
}
