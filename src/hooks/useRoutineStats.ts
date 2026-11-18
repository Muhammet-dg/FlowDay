import { useMemo } from 'react';
import type { Routine, RoutineLog } from '../types';
import {
  addDaysStr,
  computeSingleRoutineStats,
  getIstanbulDateStr,
  isRoutineScheduledOnDate,
  parseDateStr,
} from '../lib/routines';
import type { StatsPeriod } from './useStats';

export type RoutinePeriodDayItem = {
  dateStr: string;
  dayNum: number;
  shortLabel: string;
  done: number;
  planned: number;
  skipped: number;
  rate: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
};

export type RoutineTableRow = {
  routine: Routine;
  done: number;
  planned: number;
  skipped: number;
  rate: number;
  currentStreak: number;
  longestStreak: number;
};

export function useRoutineStats(
  routines: Routine[],
  routineLogs: RoutineLog[],
  period: StatsPeriod,
  weekOffset: number,
  monthOffset: number,
  userId?: string
) {
  const todayStr = useMemo(() => getIstanbulDateStr(), []);

  return useMemo(() => {
    const activeOrPaused = routines.filter((r) => r.status !== 'archived');

    // Hızlı erişim için (routine_id_date -> log)
    const logMap = new Map<string, RoutineLog>();
    for (const l of routineLogs) {
      logMap.set(`${l.routine_id}_${l.date}`, l);
    }

    const evaluateDateRange = (startStr: string, endStr: string) => {
      let totalDone = 0;
      let totalPlanned = 0;
      let totalSkipped = 0;
      const days: RoutinePeriodDayItem[] = [];

      let cursor = startStr;
      while (cursor <= endStr) {
        const dt = parseDateStr(cursor);
        const isFuture = cursor > todayStr;
        const isToday = cursor === todayStr;

        let dDone = 0;
        let dPlanned = 0;
        let dSkipped = 0;

        if (!isFuture) {
          for (const r of activeOrPaused) {
            const log = logMap.get(`${r.id}_${cursor}`);
            const scheduled = isRoutineScheduledOnDate(r, cursor, log, userId);
            if (!scheduled) continue;

            if (log?.status === 'skipped') {
              dSkipped += 1;
              continue;
            }
            dPlanned += 1;
            if (log?.status === 'done') {
              dDone += 1;
            }
          }
        }

        totalDone += dDone;
        totalPlanned += dPlanned;
        totalSkipped += dSkipped;

        const rate = dPlanned > 0 ? Math.round((dDone / dPlanned) * 100) : 0;
        let intensity: 0 | 1 | 2 | 3 | 4 = 0;
        if (dPlanned > 0 && dDone > 0) {
          if (rate >= 95) intensity = 4;
          else if (rate >= 70) intensity = 3;
          else if (rate >= 40) intensity = 2;
          else intensity = 1;
        }

        const weekdayIdx = (dt.getDay() + 6) % 7;
        const shortWeekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

        days.push({
          dateStr: cursor,
          dayNum: dt.getDate(),
          shortLabel: shortWeekdays[weekdayIdx],
          done: dDone,
          planned: dPlanned,
          skipped: dSkipped,
          rate,
          intensity,
          isToday,
          isFuture,
        });

        cursor = addDaysStr(cursor, 1);
      }

      const overallRate =
        totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

      return {
        totalDone,
        totalPlanned,
        totalSkipped,
        overallRate,
        days,
      };
    };

    // 1. Bugün Özeti
    const todayEval = evaluateDateRange(todayStr, todayStr);

    // 2. Seçili Hafta ve Önceki Hafta
    const todayDt = parseDateStr(todayStr);
    const dow = (todayDt.getDay() + 6) % 7; // 0=Pzt..6=Paz
    const currentWeekMonday = addDaysStr(todayStr, -dow + weekOffset * 7);
    const currentWeekSunday = addDaysStr(currentWeekMonday, 6);
    const prevWeekMonday = addDaysStr(currentWeekMonday, -7);
    const prevWeekSunday = addDaysStr(currentWeekMonday, -1);

    const weekEval = evaluateDateRange(currentWeekMonday, currentWeekSunday);
    const prevWeekEval = evaluateDateRange(prevWeekMonday, prevWeekSunday);
    const weekDiffPct = weekEval.overallRate - prevWeekEval.overallRate;

    // 3. Seçili Ay ve Önceki Ay
    const targetMonthDate = new Date(
      todayDt.getFullYear(),
      todayDt.getMonth() + monthOffset,
      1,
      12,
      0,
      0
    );
    const monthYear = targetMonthDate.getFullYear();
    const monthIdx = targetMonthDate.getMonth();
    const monthStartStr = `${monthYear}-${String(monthIdx + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(monthYear, monthIdx + 1, 0).getDate();
    const monthEndStr = `${monthYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(
      lastDayOfMonth
    ).padStart(2, '0')}`;

    const prevMonthDate = new Date(monthYear, monthIdx - 1, 1, 12, 0, 0);
    const prevMYear = prevMonthDate.getFullYear();
    const prevMIdx = prevMonthDate.getMonth();
    const prevMonthStartStr = `${prevMYear}-${String(prevMIdx + 1).padStart(2, '0')}-01`;
    const prevLastDay = new Date(prevMYear, prevMIdx + 1, 0).getDate();
    const prevMonthEndStr = `${prevMYear}-${String(prevMIdx + 1).padStart(2, '0')}-${String(
      prevLastDay
    ).padStart(2, '0')}`;

    const monthEval = evaluateDateRange(monthStartStr, monthEndStr);
    const prevMonthEval = evaluateDateRange(prevMonthStartStr, prevMonthEndStr);
    const monthDiffPct = monthEval.overallRate - prevMonthEval.overallRate;
    const monthLeadingBlanks = (parseDateStr(monthStartStr).getDay() + 6) % 7;

    // 4. Seçili Döneme Göre Rutin Bazlı Performans Tablosu
    let rangeStart = currentWeekMonday;
    let rangeEnd = currentWeekSunday > todayStr ? todayStr : currentWeekSunday;

    if (period === 'day') {
      rangeStart = todayStr;
      rangeEnd = todayStr;
    } else if (period === 'month') {
      rangeStart = monthStartStr;
      rangeEnd = monthEndStr > todayStr ? todayStr : monthEndStr;
    } else if (period === 'year') {
      rangeStart = addDaysStr(todayStr, -364);
      rangeEnd = todayStr;
    }

    const routineTable: RoutineTableRow[] = activeOrPaused.map((r) => {
      let rDone = 0;
      let rPlanned = 0;
      let rSkipped = 0;

      if (rangeStart <= rangeEnd) {
        let cur = rangeStart;
        while (cur <= rangeEnd) {
          const log = logMap.get(`${r.id}_${cur}`);
          const scheduled = isRoutineScheduledOnDate(r, cur, log, userId);
          if (scheduled) {
            if (log?.status === 'skipped') {
              rSkipped += 1;
            } else {
              rPlanned += 1;
              if (log?.status === 'done') rDone += 1;
            }
          }
          cur = addDaysStr(cur, 1);
        }
      }

      const singleSt = computeSingleRoutineStats(r, routineLogs, todayStr, userId);
      const rate = rPlanned > 0 ? Math.round((rDone / rPlanned) * 100) : 0;

      return {
        routine: r,
        done: rDone,
        planned: rPlanned,
        skipped: rSkipped,
        rate,
        currentStreak: singleSt.currentStreak,
        longestStreak: singleSt.longestStreak,
      };
    });

    const withPlanned = routineTable.filter((row) => row.planned > 0);
    const sortedByConsistency = [...withPlanned].sort(
      (a, b) => b.rate - a.rate || b.done - a.done
    );
    const mostConsistent = sortedByConsistency[0] ?? null;

    const sortedByMissed = [...withPlanned]
      .filter((row) => row.planned - row.done > 0)
      .sort(
        (a, b) =>
          a.rate - b.rate || b.planned - b.done - (a.planned - a.done)
      );
    const mostMissed = sortedByMissed[0] ?? null;

    return {
      hasRoutines: activeOrPaused.length > 0,
      todayEval,
      weekEval,
      weekDiffPct,
      monthEval,
      monthDiffPct,
      monthLeadingBlanks,
      routineTable,
      mostConsistent,
      mostMissed,
    };
  }, [routines, routineLogs, period, weekOffset, monthOffset, todayStr, userId]);
}
