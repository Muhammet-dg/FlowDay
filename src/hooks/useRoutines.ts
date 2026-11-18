import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Routine, RoutineFormData, RoutineLog, RoutineStatus } from '../types';
import {
  computeSingleRoutineStats,
  ensureTodayRoutineLogs,
  fetchUserRoutineLogs,
  fetchUserRoutines,
  flushPendingLogSync,
  getIstanbulDateStr,
  insertUserRoutine,
  isRoutineScheduledOnDate,
  loadLocalRoutineLogs,
  loadLocalRoutines,
  resolveRepeatDays,
  saveLocalRoutineLogs,
  saveLocalRoutines,
  updateUserRoutine,
  upsertRoutineLogEntry,
} from '../lib/routines';
import type { SingleRoutineStats } from '../lib/routines';
import { scheduleTaskReminder } from '../lib/qstash';

export type TodayRoutineItem = {
  routine: Routine;
  log: RoutineLog;
  streak: number;
};

type UseRoutinesOptions = {
  userId: string;
};

export function useRoutines({ userId }: UseRoutinesOptions) {
  const [todayStr, setTodayStr] = useState<string>(() => getIstanbulDateStr());
  const [routines, setRoutines] = useState<Routine[]>(() => loadLocalRoutines(userId));
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>(() =>
    loadLocalRoutineLogs(userId)
  );
  const [loading, setLoading] = useState(false);

  const routinesRef = useRef<Routine[]>(routines);
  routinesRef.current = routines;
  const logsRef = useRef<RoutineLog[]>(routineLogs);
  logsRef.current = routineLogs;
  const scheduledReminderKeysRef = useRef<Set<string>>(new Set());

  // ── Gece Yarısı (23:59 -> 00:00) Geçişi & Sekme Odaklanma Kontrolü ──────────
  useEffect(() => {
    const checkDateBoundary = () => {
      const currentIstanbul = getIstanbulDateStr();
      setTodayStr((prev) => (prev !== currentIstanbul ? currentIstanbul : prev));
    };

    const intervalId = setInterval(checkDateBoundary, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDateBoundary();
        if (userId) {
          void flushPendingLogSync(userId);
        }
      }
    };
    const handleOnline = () => {
      if (userId) {
        void flushPendingLogSync(userId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  // ── İlk Yükleme ve İdempotent Günlük Üretim ────────────────────────────────
  const loadAndEnsureToday = useCallback(async () => {
    if (!userId) {
      setRoutines([]);
      setRoutineLogs([]);
      return;
    }

    setLoading(true);
    try {
      const [fetchedRoutines, fetchedLogs] = await Promise.all([
        fetchUserRoutines(userId),
        fetchUserRoutineLogs(userId),
      ]);

      setRoutines(fetchedRoutines);
      const ensuredLogs = await ensureTodayRoutineLogs(
        userId,
        fetchedRoutines,
        fetchedLogs,
        todayStr
      );
      setRoutineLogs(ensuredLogs);
    } finally {
      setLoading(false);
    }
  }, [userId, todayStr]);

  useEffect(() => {
    setRoutines(loadLocalRoutines(userId));
    setRoutineLogs(loadLocalRoutineLogs(userId));
    void loadAndEnsureToday();
  }, [loadAndEnsureToday, userId]);

  // ── Saatli ve Hatırlatıcılı Rutinler İçin Günlük Bildirim Zamanlama ─────────
  useEffect(() => {
    if (!userId || routines.length === 0) return;
    const now = new Date();

    for (const r of routines) {
      if (r.status !== 'active' || !r.reminder || !r.time) continue;
      if (!isRoutineScheduledOnDate(r, todayStr, undefined, userId)) continue;

      const key = `${r.id}_${todayStr}_${r.time}`;
      if (scheduledReminderKeysRef.current.has(key)) continue;

      const todayLog = routineLogs.find(
        (l) => l.routine_id === r.id && l.date === todayStr
      );
      if (todayLog && (todayLog.status === 'done' || todayLog.status === 'skipped')) {
        continue;
      }

      const [hh, mm] = r.time.split(':').map((n) => parseInt(n, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

      const reminderDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hh,
        mm,
        0,
        0
      );
      if (reminderDate > now) {
        scheduledReminderKeysRef.current.add(key);
        void scheduleTaskReminder({
          taskId: `routine-${r.id}-${todayStr}`,
          title: `${r.icon} Rutin: ${r.title}`,
          reminderTime: reminderDate.toISOString(),
          priority: r.category === 'urgent' ? 'high' : 'medium',
        });
      }
    }
  }, [userId, routines, routineLogs, todayStr]);

  // ── Yeni Rutin Ekle ────────────────────────────────────────────────────────
  const addRoutine = useCallback(
    async (form: RoutineFormData): Promise<Routine | null> => {
      if (!userId || !form.title.trim()) return null;

      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();
      const repeatDays = resolveRepeatDays(form.repeat_type, form.repeat_days);

      const optimistic: Routine = {
        id: optimisticId,
        user_id: userId,
        title: form.title.trim(),
        icon: form.icon || '💧',
        color: form.color || '#6366F1',
        category: form.category || 'personal',
        project_id: form.project_id ?? null,
        time: form.time?.trim() || null,
        reminder: Boolean(form.reminder && form.time),
        repeat_type: form.repeat_type,
        repeat_days: repeatDays,
        target_count: Math.max(1, Number(form.target_count) || 1),
        start_date: form.start_date || todayStr,
        end_date: form.end_date || null,
        status: form.status ?? 'active',
        created_at: now,
        updated_at: now,
      };

      const nextRoutines = [...routinesRef.current, optimistic];
      setRoutines(nextRoutines);
      saveLocalRoutines(userId, nextRoutines);

      const saved = await insertUserRoutine(userId, form, optimisticId);
      const reconciledRoutines = nextRoutines.map((r) =>
        r.id === optimisticId ? saved : r
      );
      setRoutines(reconciledRoutines);
      saveLocalRoutines(userId, reconciledRoutines);

      // Bugün planlıysa bugünkü log'u da idempotent olarak oluştur
      const updatedLogs = await ensureTodayRoutineLogs(
        userId,
        reconciledRoutines,
        logsRef.current,
        todayStr
      );
      setRoutineLogs(updatedLogs);

      return saved;
    },
    [userId, todayStr]
  );

  // ── Rutin Güncelle (Yalnızca bugünden itibaren etkiler, geçmişi korur) ─────
  const updateRoutine = useCallback(
    async (id: string, updates: Partial<RoutineFormData>) => {
      if (!userId) return;
      const existing = routinesRef.current.find((r) => r.id === id);
      if (!existing) return;

      const nextRepeatType = updates.repeat_type ?? existing.repeat_type;
      const nextRepeatDays =
        updates.repeat_days !== undefined || updates.repeat_type !== undefined
          ? resolveRepeatDays(nextRepeatType, updates.repeat_days ?? existing.repeat_days)
          : existing.repeat_days;

      const nextRoutines = routinesRef.current.map((r) =>
        r.id === id
          ? {
              ...r,
              ...updates,
              title: updates.title !== undefined ? updates.title.trim() : r.title,
              repeat_type: nextRepeatType,
              repeat_days: nextRepeatDays,
              target_count:
                updates.target_count !== undefined
                  ? Math.max(1, Number(updates.target_count) || 1)
                  : r.target_count,
              updated_at: new Date().toISOString(),
            }
          : r
      );
      setRoutines(nextRoutines);
      saveLocalRoutines(userId, nextRoutines);

      // Bugünkü pending log varsa target_count değerini güncelle
      if (updates.target_count !== undefined) {
        const newTarget = Math.max(1, Number(updates.target_count) || 1);
        const todayLog = logsRef.current.find(
          (l) => l.routine_id === id && l.date === todayStr
        );
        if (todayLog && todayLog.status !== 'skipped') {
          const updatedLog: RoutineLog = {
            ...todayLog,
            target_count: newTarget,
            status: todayLog.count >= newTarget ? 'done' : 'pending',
          };
          const nextLogs = logsRef.current.map((l) =>
            l.id === todayLog.id ? updatedLog : l
          );
          setRoutineLogs(nextLogs);
          saveLocalRoutineLogs(userId, nextLogs);
          void upsertRoutineLogEntry(userId, updatedLog);
        }
      }

      await updateUserRoutine(userId, existing, updates, todayStr);

      // Bugün artık planlı hale geldiyse bugünkü log'u üret
      const ensuredLogs = await ensureTodayRoutineLogs(
        userId,
        nextRoutines,
        logsRef.current,
        todayStr
      );
      setRoutineLogs(ensuredLogs);
    },
    [userId, todayStr]
  );

  // ── Duraklat / Devam Ettir / Arşivle (Soft Delete) ─────────────────────────
  const setRoutineStatus = useCallback(
    async (id: string, status: RoutineStatus) => {
      await updateRoutine(id, { status });
    },
    [updateRoutine]
  );

  // ── Bugünkü Rutini Tamamla / Geri Al ───────────────────────────────────────
  const toggleTodayRoutine = useCallback(
    async (routineId: string) => {
      if (!userId) return;
      const routine = routinesRef.current.find((r) => r.id === routineId);
      if (!routine) return;

      const existing = logsRef.current.find(
        (l) => l.routine_id === routineId && l.date === todayStr
      );
      const targetCount = existing?.target_count ?? routine.target_count;
      const isCurrentlyDone = existing?.status === 'done';
      const nowIso = new Date().toISOString();

      const updatedLog: RoutineLog = existing
        ? {
            ...existing,
            status: isCurrentlyDone ? 'pending' : 'done',
            count: isCurrentlyDone ? 0 : targetCount,
            target_count: targetCount,
            completed_at: isCurrentlyDone ? null : nowIso,
          }
        : {
            id: crypto.randomUUID(),
            user_id: userId,
            routine_id: routineId,
            date: todayStr,
            status: 'done',
            count: targetCount,
            target_count: targetCount,
            completed_at: nowIso,
            created_at: nowIso,
          };

      const nextLogs = existing
        ? logsRef.current.map((l) => (l.id === existing.id ? updatedLog : l))
        : [updatedLog, ...logsRef.current];

      setRoutineLogs(nextLogs);
      saveLocalRoutineLogs(userId, nextLogs);
      await upsertRoutineLogEntry(userId, updatedLog);
    },
    [userId, todayStr]
  );

  // ── Sayaçlı Rutinlerde (+1) Artır ──────────────────────────────────────────
  const incrementTodayRoutine = useCallback(
    async (routineId: string) => {
      if (!userId) return;
      const routine = routinesRef.current.find((r) => r.id === routineId);
      if (!routine) return;

      const existing = logsRef.current.find(
        (l) => l.routine_id === routineId && l.date === todayStr
      );
      const targetCount = existing?.target_count ?? routine.target_count;
      const currentCount = existing?.status === 'skipped' ? 0 : (existing?.count ?? 0);
      const nextCount = currentCount >= targetCount ? 0 : currentCount + 1;
      const isDone = nextCount >= targetCount;
      const nowIso = new Date().toISOString();

      const updatedLog: RoutineLog = existing
        ? {
            ...existing,
            status: isDone ? 'done' : 'pending',
            count: nextCount,
            target_count: targetCount,
            completed_at: isDone ? nowIso : null,
          }
        : {
            id: crypto.randomUUID(),
            user_id: userId,
            routine_id: routineId,
            date: todayStr,
            status: isDone ? 'done' : 'pending',
            count: nextCount,
            target_count: targetCount,
            completed_at: isDone ? nowIso : null,
            created_at: nowIso,
          };

      const nextLogs = existing
        ? logsRef.current.map((l) => (l.id === existing.id ? updatedLog : l))
        : [updatedLog, ...logsRef.current];

      setRoutineLogs(nextLogs);
      saveLocalRoutineLogs(userId, nextLogs);
      await upsertRoutineLogEntry(userId, updatedLog);
    },
    [userId, todayStr]
  );

  // ── Bugün İçin Atla (Skipped — Başarısızlık sayılmaz) ─────────────────────
  const skipTodayRoutine = useCallback(
    async (routineId: string) => {
      if (!userId) return;
      const routine = routinesRef.current.find((r) => r.id === routineId);
      if (!routine) return;

      const existing = logsRef.current.find(
        (l) => l.routine_id === routineId && l.date === todayStr
      );
      const nowIso = new Date().toISOString();
      const isAlreadySkipped = existing?.status === 'skipped';

      const updatedLog: RoutineLog = existing
        ? {
            ...existing,
            status: isAlreadySkipped ? 'pending' : 'skipped',
            count: 0,
            completed_at: null,
          }
        : {
            id: crypto.randomUUID(),
            user_id: userId,
            routine_id: routineId,
            date: todayStr,
            status: 'skipped',
            count: 0,
            target_count: routine.target_count,
            completed_at: null,
            created_at: nowIso,
          };

      const nextLogs = existing
        ? logsRef.current.map((l) => (l.id === existing.id ? updatedLog : l))
        : [updatedLog, ...logsRef.current];

      setRoutineLogs(nextLogs);
      saveLocalRoutineLogs(userId, nextLogs);
      await upsertRoutineLogEntry(userId, updatedLog);
    },
    [userId, todayStr]
  );

  // ── JSON İçe Aktarma (Import) ──────────────────────────────────────────────
  const importRoutinesData = useCallback(
    async (incomingRoutines?: Routine[], incomingLogs?: RoutineLog[]) => {
      if (!userId) return;
      if (incomingRoutines && incomingRoutines.length > 0) {
        const existingIds = new Set(routinesRef.current.map((r) => r.id));
        const newOnes = incomingRoutines.filter((r) => r.title && !existingIds.has(r.id));
        if (newOnes.length > 0) {
          const merged = [...routinesRef.current, ...newOnes];
          setRoutines(merged);
          saveLocalRoutines(userId, merged);
        }
      }
      if (incomingLogs && incomingLogs.length > 0) {
        const existingKeys = new Set(
          logsRef.current.map((l) => `${l.routine_id}_${l.date}`)
        );
        const newLogs = incomingLogs.filter(
          (l) => l.routine_id && l.date && !existingKeys.has(`${l.routine_id}_${l.date}`)
        );
        if (newLogs.length > 0) {
          const mergedLogs = [...newLogs, ...logsRef.current];
          setRoutineLogs(mergedLogs);
          saveLocalRoutineLogs(userId, mergedLogs);
          for (const l of newLogs) {
            void upsertRoutineLogEntry(userId, l);
          }
        }
      }
    },
    [userId]
  );

  // ── Her Rutin İçin İstatistik ve Seri Haritası ────────────────────────────
  const routineStatsMap = useMemo(() => {
    const map = new Map<string, SingleRoutineStats>();
    for (const r of routines) {
      map.set(r.id, computeSingleRoutineStats(r, routineLogs, todayStr, userId));
    }
    return map;
  }, [routines, routineLogs, todayStr, userId]);

  // ── Bugünün Planlı Rutinleri (Görevler Ekranı İçin) ────────────────────────
  const todayRoutines = useMemo<TodayRoutineItem[]>(() => {
    const activeList = routines.filter((r) => r.status === 'active');
    const items: TodayRoutineItem[] = [];

    for (const r of activeList) {
      const existingLog = routineLogs.find(
        (l) => l.routine_id === r.id && l.date === todayStr
      );
      if (!isRoutineScheduledOnDate(r, todayStr, existingLog, userId)) continue;

      const log: RoutineLog = existingLog ?? {
        id: `virtual-${r.id}-${todayStr}`,
        user_id: userId,
        routine_id: r.id,
        date: todayStr,
        status: 'pending',
        count: 0,
        target_count: r.target_count,
        completed_at: null,
        created_at: r.created_at,
      };

      const st = routineStatsMap.get(r.id);
      items.push({
        routine: r,
        log,
        streak: st?.currentStreak ?? 0,
      });
    }

    return items;
  }, [routines, routineLogs, todayStr, userId, routineStatsMap]);

  const todayRoutineCounts = useMemo(() => {
    const activeToday = todayRoutines.filter((item) => item.log.status !== 'skipped');
    const doneCount = activeToday.filter((item) => item.log.status === 'done').length;
    const pendingCount = activeToday.filter((item) => item.log.status === 'pending').length;
    const skippedCount = todayRoutines.filter((item) => item.log.status === 'skipped').length;
    return {
      totalPlanned: activeToday.length,
      doneCount,
      pendingCount,
      skippedCount,
    };
  }, [todayRoutines]);

  return {
    todayStr,
    routines,
    routineLogs,
    todayRoutines,
    todayRoutineCounts,
    routineStatsMap,
    loading,
    addRoutine,
    updateRoutine,
    setRoutineStatus,
    toggleTodayRoutine,
    incrementTodayRoutine,
    skipTodayRoutine,
    importRoutinesData,
    refetchRoutines: loadAndEnsureToday,
  };
}
