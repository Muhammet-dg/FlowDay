import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from '../types';
import { addDaysStr, getIstanbulDateStr } from '../lib/routines';

type StreakData = {
  count: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
  celebratedDate: string | null;    // YYYY-MM-DD
};

function getTodayStr(): string {
  return getIstanbulDateStr();
}

function getYesterdayStr(): string {
  return addDaysStr(getIstanbulDateStr(), -1);
}

export function useStreak(
  userId: string,
  activeCount: number,
  completedTasks: Task[],
  archivedTasks: Task[],
  completedRoutinesTodayCount = 0
) {
  const storageKey = `flowday_streak_v1_${userId || 'guest'}`;

  const [streak, setStreak] = useState<number>(1);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevActiveRef = useRef<number | null>(null);

  // Mevcut seriyi yükle / hesapla
  useEffect(() => {
    if (!userId) return;
    const today = getTodayStr();
    const yesterday = getYesterdayStr();

    try {
      const raw = localStorage.getItem(storageKey);
      let data: StreakData = raw
        ? JSON.parse(raw)
        : { count: 3, lastCompletedDate: yesterday, celebratedDate: null };

      const hasCompletedToday =
        completedRoutinesTodayCount > 0 ||
        completedTasks.some((t) => (t.completed_at ?? t.created_at).startsWith(today)) ||
        archivedTasks.some((t) => (t.completed_at ?? t.created_at).startsWith(today));

      if (hasCompletedToday && data.lastCompletedDate !== today) {
        if (data.lastCompletedDate === yesterday) {
          data = { ...data, count: data.count + 1, lastCompletedDate: today };
        } else {
          data = { ...data, count: Math.max(data.count, 1), lastCompletedDate: today };
        }
        localStorage.setItem(storageKey, JSON.stringify(data));
      }

      setStreak(Math.max(1, data.count));
    } catch {
      setStreak(1);
    }
  }, [userId, completedTasks, archivedTasks, completedRoutinesTodayCount, storageKey]);

  // Tüm görevler ve bugünün planlı rutinleri tamamlandığında kutlama tetikle
  useEffect(() => {
    const prevActive = prevActiveRef.current;
    prevActiveRef.current = activeCount;
    const totalDoneToday = completedTasks.length + completedRoutinesTodayCount;

    if (prevActive !== null && prevActive > 0 && activeCount === 0 && totalDoneToday > 0) {
      const today = getTodayStr();
      try {
        const raw = localStorage.getItem(storageKey);
        const data: StreakData = raw
          ? JSON.parse(raw)
          : { count: streak, lastCompletedDate: today, celebratedDate: null };

        const updated: StreakData = {
          count: data.lastCompletedDate === today ? data.count : data.count + 1,
          lastCompletedDate: today,
          celebratedDate: today,
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setStreak(updated.count);
      } catch {
        // ignore
      }

      // Haptic feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 60, 80]);
        } catch {
          // ignore
        }
      }

      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [activeCount, completedTasks.length, completedRoutinesTodayCount, storageKey, streak]);

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return {
    streak,
    showCelebration,
    dismissCelebration,
  };
}

