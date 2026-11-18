import type {
  Routine,
  RoutineFormData,
  RoutineLog,
  RoutineLogStatus,
  RoutineRepeatType,
} from '../types';
import type { Database, RoutineLogRow, RoutineRow } from './supabase';
import { rowToRoutine, rowToRoutineLog, supabase } from './supabase';

type RoutineInsert = Database['public']['Tables']['routines']['Insert'];
type RoutineUpdate = Database['public']['Tables']['routines']['Update'];
type RoutineLogInsert = Database['public']['Tables']['routine_logs']['Insert'];

const LOCAL_ROUTINES_PREFIX = 'flowday_routines_v1_';
const LOCAL_ROUTINE_LOGS_PREFIX = 'flowday_routine_logs_v1_';
const LOCAL_ROUTINE_SYNC_QUEUE_PREFIX = 'flowday_routine_sync_q_v1_';
const LOCAL_ROUTINE_SCHED_HIST_PREFIX = 'flowday_routine_sched_hist_v1_';

// ─── Zaman Dilimi & Tarih Yardımcıları (tr-TR / Europe/Istanbul) ─────────────

const istanbulFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Kullanıcının yerel gün sınırını (Europe/Istanbul) YYYY-MM-DD olarak döndürür.
 */
export function getIstanbulDateStr(date: Date = new Date()): string {
  try {
    const formatted = istanbulFormatter.format(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysStr(dateStr: string, offsetDays: number): string {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + offsetDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

/** 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi */
export function getWeekdayNumber(dateStr: string): number {
  return parseDateStr(dateStr).getDay();
}

export function resolveRepeatDays(
  repeatType: RoutineRepeatType,
  customDays?: number[]
): number[] {
  if (repeatType === 'daily') return [1, 2, 3, 4, 5, 6, 0];
  if (repeatType === 'weekdays') return [1, 2, 3, 4, 5];
  if (repeatType === 'weekends') return [6, 0];
  const valid = (customDays ?? []).filter((d) => d >= 0 && d <= 6);
  return valid.length > 0 ? Array.from(new Set(valid)) : [1, 2, 3, 4, 5, 6, 0];
}

// ─── Geçmiş Tekrar Kuralı Koruması (Rutin düzenlendiğinde geçmişi bozmamak için) ───

type ScheduleHistoryEntry = {
  untilDate: string; // YYYY-MM-DD (bu tarihten önceki günlerde geçerli olan kural)
  repeat_days: number[];
  target_count: number;
};

function loadScheduleHistory(userId: string): Record<string, ScheduleHistoryEntry[]> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${LOCAL_ROUTINE_SCHED_HIST_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Record<string, ScheduleHistoryEntry[]>) : {};
  } catch {
    return {};
  }
}

function saveScheduleHistorySnapshot(
  userId: string,
  routine: Routine,
  todayStr: string
): void {
  if (!userId) return;
  try {
    const map = loadScheduleHistory(userId);
    const list = map[routine.id] ?? [];
    const yesterdayStr = addDaysStr(todayStr, -1);
    if (yesterdayStr >= routine.start_date) {
      list.push({
        untilDate: yesterdayStr,
        repeat_days: routine.repeat_days,
        target_count: routine.target_count,
      });
      map[routine.id] = list.slice(-10);
      localStorage.setItem(`${LOCAL_ROUTINE_SCHED_HIST_PREFIX}${userId}`, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

/**
 * Bir rutinin belirli bir YYYY-MM-DD gününde planlı olup olmadığını hesaplar.
 * - Eğer o gün için zaten bir log oluşturulmuşsa (done/skipped/pending), planlı kabul edilir.
 * - Rutin sonradan düzenlendiyse ve geçmiş tarih için kural snapshot'ı varsa o kullanılır.
 */
export function isRoutineScheduledOnDate(
  routine: Routine,
  dateStr: string,
  existingLog?: RoutineLog,
  userId?: string
): boolean {
  if (existingLog) return true;
  if (dateStr < routine.start_date) return false;
  if (routine.end_date && dateStr > routine.end_date) return false;

  const weekday = getWeekdayNumber(dateStr);

  if (userId) {
    const histMap = loadScheduleHistory(userId);
    const entries = histMap[routine.id];
    if (entries && entries.length > 0) {
      const matched = entries.find((e) => dateStr <= e.untilDate);
      if (matched) {
        return matched.repeat_days.includes(weekday);
      }
    }
  }

  const days = resolveRepeatDays(routine.repeat_type, routine.repeat_days);
  return days.includes(weekday);
}

// ─── LocalStorage & Çevrimdışı Senkronizasyon Kuyruğu ────────────────────────

export function loadLocalRoutines(userId: string): Routine[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_ROUTINES_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Routine[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRoutines(userId: string, routines: Routine[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCAL_ROUTINES_PREFIX}${userId}`, JSON.stringify(routines));
  } catch {
    // ignore
  }
}

export function loadLocalRoutineLogs(userId: string): RoutineLog[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_ROUTINE_LOGS_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as RoutineLog[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRoutineLogs(userId: string, logs: RoutineLog[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCAL_ROUTINE_LOGS_PREFIX}${userId}`, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

function loadPendingLogSyncQueue(userId: string): RoutineLog[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_ROUTINE_SYNC_QUEUE_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as RoutineLog[]) : [];
  } catch {
    return [];
  }
}

function savePendingLogSyncQueue(userId: string, queue: RoutineLog[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCAL_ROUTINE_SYNC_QUEUE_PREFIX}${userId}`, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function enqueuePendingLogSync(userId: string, log: RoutineLog): void {
  const queue = loadPendingLogSyncQueue(userId);
  const filtered = queue.filter(
    (item) => !(item.routine_id === log.routine_id && item.date === log.date)
  );
  savePendingLogSyncQueue(userId, [...filtered, log]);
}

export async function flushPendingLogSync(userId: string): Promise<void> {
  if (!userId) return;
  const queue = loadPendingLogSyncQueue(userId);
  if (queue.length === 0) return;

  try {
    const payloads: RoutineLogInsert[] = queue.map((l) => ({
      id: l.id,
      user_id: userId,
      routine_id: l.routine_id,
      date: l.date,
      status: l.status,
      count: l.count,
      target_count: l.target_count,
      completed_at: l.completed_at ?? null,
    }));

    const { error } = await supabase
      .from('routine_logs')
      .upsert(payloads, { onConflict: 'routine_id,date' });

    if (!error) {
      savePendingLogSyncQueue(userId, []);
    }
  } catch {
    // Çevrimdışıysa kuyrukta kalır
  }
}

// ─── Supabase + Çevrimdışı Veri Erişimi ──────────────────────────────────────

export async function fetchUserRoutines(userId: string): Promise<Routine[]> {
  const local = loadLocalRoutines(userId);
  try {
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return local;

    const remote = ((data ?? []) as RoutineRow[]).map(rowToRoutine);
    const remoteIds = new Set(remote.map((r) => r.id));
    const unsyncedLocal = local.filter((l) => !remoteIds.has(l.id));

    if (unsyncedLocal.length > 0) {
      const syncPayloads: RoutineInsert[] = unsyncedLocal.map((r) => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        icon: r.icon,
        color: r.color,
        category: r.category,
        project_id: r.project_id ?? null,
        time: r.time ?? null,
        reminder: r.reminder,
        repeat_type: r.repeat_type,
        repeat_days: r.repeat_days,
        target_count: r.target_count,
        start_date: r.start_date,
        end_date: r.end_date ?? null,
        status: r.status,
      }));
      await supabase.from('routines').upsert(syncPayloads, { onConflict: 'id' });
    }

    const merged = [...remote, ...unsyncedLocal];
    saveLocalRoutines(userId, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function fetchUserRoutineLogs(userId: string): Promise<RoutineLog[]> {
  await flushPendingLogSync(userId);
  const local = loadLocalRoutineLogs(userId);

  try {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) return local;

    const remote = ((data ?? []) as RoutineLogRow[]).map(rowToRoutineLog);
    const remoteKeySet = new Set(remote.map((l) => `${l.routine_id}_${l.date}`));
    const unsyncedLocal = local.filter(
      (l) => !remoteKeySet.has(`${l.routine_id}_${l.date}`)
    );

    if (unsyncedLocal.length > 0) {
      const syncPayloads: RoutineLogInsert[] = unsyncedLocal.map((l) => ({
        id: l.id,
        user_id: userId,
        routine_id: l.routine_id,
        date: l.date,
        status: l.status,
        count: l.count,
        target_count: l.target_count,
        completed_at: l.completed_at ?? null,
      }));
      await supabase
        .from('routine_logs')
        .upsert(syncPayloads, { onConflict: 'routine_id,date' });
    }

    const merged = [...remote, ...unsyncedLocal];
    saveLocalRoutineLogs(userId, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function insertUserRoutine(
  userId: string,
  form: RoutineFormData,
  optimisticId?: string
): Promise<Routine> {
  const now = new Date().toISOString();
  const repeatDays = resolveRepeatDays(form.repeat_type, form.repeat_days);

  const fallbackRoutine: Routine = {
    id: optimisticId ?? crypto.randomUUID(),
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
    start_date: form.start_date || getIstanbulDateStr(),
    end_date: form.end_date || null,
    status: form.status ?? 'active',
    created_at: now,
    updated_at: now,
  };

  const payload: RoutineInsert = {
    id: fallbackRoutine.id,
    user_id: userId,
    title: fallbackRoutine.title,
    icon: fallbackRoutine.icon,
    color: fallbackRoutine.color,
    category: fallbackRoutine.category,
    project_id: fallbackRoutine.project_id ?? null,
    time: fallbackRoutine.time ?? null,
    reminder: fallbackRoutine.reminder,
    repeat_type: fallbackRoutine.repeat_type,
    repeat_days: fallbackRoutine.repeat_days,
    target_count: fallbackRoutine.target_count,
    start_date: fallbackRoutine.start_date,
    end_date: fallbackRoutine.end_date ?? null,
    status: fallbackRoutine.status,
  };

  try {
    const { data, error } = await supabase
      .from('routines')
      .insert(payload)
      .select()
      .single();

    if (error || !data) return fallbackRoutine;
    return rowToRoutine(data as RoutineRow);
  } catch {
    return fallbackRoutine;
  }
}

export async function updateUserRoutine(
  userId: string,
  existingRoutine: Routine,
  updates: Partial<RoutineFormData>,
  todayStr: string
): Promise<boolean> {
  // Tekrar günleri veya hedef sayı değişiyorsa bugünden önceki günler için geçmiş kuralı sakla
  if (
    updates.repeat_type !== undefined ||
    updates.repeat_days !== undefined ||
    updates.target_count !== undefined
  ) {
    saveScheduleHistorySnapshot(userId, existingRoutine, todayStr);
  }

  const payload: RoutineUpdate = {};
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.project_id !== undefined) payload.project_id = updates.project_id;
  if (updates.time !== undefined) payload.time = updates.time || null;
  if (updates.reminder !== undefined) payload.reminder = updates.reminder;
  if (updates.repeat_type !== undefined) payload.repeat_type = updates.repeat_type;
  if (updates.repeat_days !== undefined) {
    const rType = updates.repeat_type ?? existingRoutine.repeat_type;
    payload.repeat_days = resolveRepeatDays(rType, updates.repeat_days);
  }
  if (updates.target_count !== undefined) {
    payload.target_count = Math.max(1, Number(updates.target_count) || 1);
  }
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.end_date !== undefined) payload.end_date = updates.end_date || null;
  if (updates.status !== undefined) payload.status = updates.status;

  try {
    const { error } = await supabase
      .from('routines')
      .update(payload)
      .eq('id', existingRoutine.id);

    return !error;
  } catch {
    return false;
  }
}

export async function upsertRoutineLogEntry(
  userId: string,
  log: RoutineLog
): Promise<RoutineLog> {
  const payload: RoutineLogInsert = {
    id: log.id,
    user_id: userId,
    routine_id: log.routine_id,
    date: log.date,
    status: log.status,
    count: log.count,
    target_count: log.target_count,
    completed_at: log.completed_at ?? null,
  };

  try {
    const { data, error } = await supabase
      .from('routine_logs')
      .upsert(payload, { onConflict: 'routine_id,date' })
      .select()
      .single();

    if (error || !data) {
      enqueuePendingLogSync(userId, log);
      return log;
    }
    return rowToRoutineLog(data as RoutineLogRow);
  } catch {
    enqueuePendingLogSync(userId, log);
    return log;
  }
}

// ─── İdempotent Günlük Rutin Üretimi (Lazy Generation) ───────────────────────

/**
 * Yalnızca bugünün (todayStr) aktif ve planlı rutinleri için eksik routine_logs
 * kayıtlarını idempotent olarak üretir.
 * Geçmiş günleri geriye dönük görev yığını olarak doldurmaz; eksik geçmiş günler
 * istatistik motorunda otomatik olarak "yapılmadı" (missed) olarak hesaplanır.
 */
export async function ensureTodayRoutineLogs(
  userId: string,
  routines: Routine[],
  existingLogs: RoutineLog[],
  todayStr: string
): Promise<RoutineLog[]> {
  if (!userId || routines.length === 0) return existingLogs;

  const existingTodayKeys = new Set(
    existingLogs
      .filter((l) => l.date === todayStr)
      .map((l) => `${l.routine_id}_${l.date}`)
  );

  const missingForToday = routines.filter((r) => {
    if (r.status !== 'active') return false;
    if (!isRoutineScheduledOnDate(r, todayStr, undefined, userId)) return false;
    return !existingTodayKeys.has(`${r.id}_${todayStr}`);
  });

  if (missingForToday.length === 0) return existingLogs;

  const nowIso = new Date().toISOString();
  const createdLogs: RoutineLog[] = missingForToday.map((r) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    routine_id: r.id,
    date: todayStr,
    status: 'pending',
    count: 0,
    target_count: r.target_count,
    completed_at: null,
    created_at: nowIso,
  }));

  const nextLogs = [...createdLogs, ...existingLogs];
  saveLocalRoutineLogs(userId, nextLogs);

  try {
    const payloads: RoutineLogInsert[] = createdLogs.map((l) => ({
      id: l.id,
      user_id: userId,
      routine_id: l.routine_id,
      date: l.date,
      status: l.status,
      count: l.count,
      target_count: l.target_count,
      completed_at: null,
    }));

    const { data, error } = await supabase
      .from('routine_logs')
      .upsert(payloads, { onConflict: 'routine_id,date', ignoreDuplicates: true })
      .select();

    if (!error && data && data.length > 0) {
      const savedRows = (data as RoutineLogRow[]).map(rowToRoutineLog);
      const savedByKey = new Map(savedRows.map((s) => [`${s.routine_id}_${s.date}`, s]));
      const reconciled = nextLogs.map(
        (l) => savedByKey.get(`${l.routine_id}_${l.date}`) ?? l
      );
      saveLocalRoutineLogs(userId, reconciled);
      return reconciled;
    }
  } catch {
    for (const l of createdLogs) {
      enqueuePendingLogSync(userId, l);
    }
  }

  return nextLogs;
}

// ─── Rutin İstatistik & Seri Hesaplama Motoru ────────────────────────────────

export type RoutineDayCellState = 'done' | 'missed' | 'skipped' | 'unscheduled' | 'pending';

export type RoutineDayCell = {
  date: string;
  dayNum: number;
  shortLabel: string;
  state: RoutineDayCellState;
  count: number;
  targetCount: number;
};

export type RoutineWeekBar = {
  weekLabel: string;
  done: number;
  planned: number;
  rate: number;
};

export type RoutineWeekdayStat = {
  weekday: number; // 1=Pzt..0=Paz
  label: string;
  done: number;
  planned: number;
  rate: number;
};

export type SingleRoutineStats = {
  routineId: string;
  currentStreak: number;
  longestStreak: number;
  totalDoneCount: number;
  totalPlannedCount: number;
  completionRate: number;
  last30Days: RoutineDayCell[];
  last8Weeks: RoutineWeekBar[];
  weekdayStats: RoutineWeekdayStat[];
  bestWeekdayLabel: string;
};

const WEEKDAY_ORDER: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Pzt' },
  { day: 2, label: 'Sal' },
  { day: 3, label: 'Çar' },
  { day: 4, label: 'Per' },
  { day: 5, label: 'Cum' },
  { day: 6, label: 'Cmt' },
  { day: 0, label: 'Paz' },
];

/**
 * Tek bir rutin için mevcut seri, en uzun seri, son 30 gün takvimi,
 * son 8 hafta çubuk grafiği ve haftanın günleri dağılımını hesaplar.
 * - "Atlandı" (skipped) günler seriyi kırmaz ve başarısızlık sayılmaz.
 * - Uygulamanın açılmadığı geçmiş planlı günler otomatik olarak "missed" (yapılmadı) sayılır.
 */
export function computeSingleRoutineStats(
  routine: Routine,
  allLogs: RoutineLog[],
  todayStr: string,
  userId?: string
): SingleRoutineStats {
  const logByDate = new Map<string, RoutineLog>();
  for (const l of allLogs) {
    if (l.routine_id === routine.id) {
      logByDate.set(l.date, l);
    }
  }

  // Başlangıç tarihinden bugüne kadar günleri tara (en fazla 365 gün geriye)
  const earliestBound = addDaysStr(todayStr, -365);
  const startScan =
    routine.start_date > earliestBound ? routine.start_date : earliestBound;

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let totalDoneCount = 0;
  let totalPlannedCount = 0;

  const weekdayBuckets = new Map<number, { done: number; planned: number }>();
  for (const w of WEEKDAY_ORDER) {
    weekdayBuckets.set(w.day, { done: 0, planned: 0 });
  }

  let cursor = startScan;
  while (cursor <= todayStr) {
    const log = logByDate.get(cursor);
    const scheduled = isRoutineScheduledOnDate(routine, cursor, log, userId);

    if (scheduled) {
      const status: RoutineLogStatus | 'missing' = log ? log.status : 'missing';

      if (status === 'done') {
        runningStreak += 1;
        if (runningStreak > longestStreak) longestStreak = runningStreak;
        totalDoneCount += 1;
        totalPlannedCount += 1;

        const wb = weekdayBuckets.get(getWeekdayNumber(cursor));
        if (wb) {
          wb.done += 1;
          wb.planned += 1;
        }
      } else if (status === 'skipped') {
        // Atlanan gün seriyi bozmaz ve başarısızlık sayılmaz
      } else if (cursor === todayStr) {
        // Bugün henüz pending ise mevcut seriyi kırmaz, ancak bugünkü planlı sayıya dahildir
        totalPlannedCount += 1;
        const wb = weekdayBuckets.get(getWeekdayNumber(cursor));
        if (wb) wb.planned += 1;
      } else {
        // Geçmişte yapılmamış (missed) gün -> seriyi sıfırlar
        runningStreak = 0;
        totalPlannedCount += 1;
        const wb = weekdayBuckets.get(getWeekdayNumber(cursor));
        if (wb) wb.planned += 1;
      }
    }

    cursor = addDaysStr(cursor, 1);
  }

  currentStreak = runningStreak;

  const completionRate =
    totalPlannedCount > 0 ? Math.round((totalDoneCount / totalPlannedCount) * 100) : 0;

  // Son 30 Gün Takvimi
  const last30Days: RoutineDayCell[] = [];
  for (let i = 29; i >= 0; i--) {
    const dStr = addDaysStr(todayStr, -i);
    const dt = parseDateStr(dStr);
    const log = logByDate.get(dStr);
    const scheduled = isRoutineScheduledOnDate(routine, dStr, log, userId);

    let state: RoutineDayCellState = 'unscheduled';
    if (scheduled) {
      if (log?.status === 'done') state = 'done';
      else if (log?.status === 'skipped') state = 'skipped';
      else if (dStr === todayStr) state = 'pending';
      else state = 'missed';
    }

    last30Days.push({
      date: dStr,
      dayNum: dt.getDate(),
      shortLabel: dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      state,
      count: log?.count ?? 0,
      targetCount: log?.target_count ?? routine.target_count,
    });
  }

  // Son 8 Hafta Çubuk Grafiği (Pazartesi başlangıçlı)
  const todayDt = parseDateStr(todayStr);
  const dow = (todayDt.getDay() + 6) % 7; // 0=Pzt..6=Paz
  const currentWeekMondayStr = addDaysStr(todayStr, -dow);

  const last8Weeks: RoutineWeekBar[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekStart = addDaysStr(currentWeekMondayStr, -w * 7);
    let wDone = 0;
    let wPlanned = 0;

    for (let d = 0; d < 7; d++) {
      const dayStr = addDaysStr(weekStart, d);
      if (dayStr > todayStr) continue;
      const log = logByDate.get(dayStr);
      const scheduled = isRoutineScheduledOnDate(routine, dayStr, log, userId);
      if (!scheduled) continue;
      if (log?.status === 'skipped') continue;

      wPlanned += 1;
      if (log?.status === 'done') wDone += 1;
    }

    const startDt = parseDateStr(weekStart);
    const weekLabel = startDt.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });

    last8Weeks.push({
      weekLabel,
      done: wDone,
      planned: wPlanned,
      rate: wPlanned > 0 ? Math.round((wDone / wPlanned) * 100) : 0,
    });
  }

  // Haftanın Günleri Performansı
  const weekdayStats: RoutineWeekdayStat[] = WEEKDAY_ORDER.map((w) => {
    const b = weekdayBuckets.get(w.day) ?? { done: 0, planned: 0 };
    return {
      weekday: w.day,
      label: w.label,
      done: b.done,
      planned: b.planned,
      rate: b.planned > 0 ? Math.round((b.done / b.planned) * 100) : 0,
    };
  });

  const bestWeekday = [...weekdayStats]
    .filter((w) => w.done > 0)
    .sort((a, b) => b.done - a.done || b.rate - a.rate)[0];

  return {
    routineId: routine.id,
    currentStreak,
    longestStreak,
    totalDoneCount,
    totalPlannedCount,
    completionRate,
    last30Days,
    last8Weeks,
    weekdayStats,
    bestWeekdayLabel: bestWeekday ? bestWeekday.label : '—',
  };
}
