import { useState, useEffect, useCallback } from 'react';
import type { Learning, LearningFormData } from '../types';
import type { LearningRow } from '../lib/supabase';
import { rowToLearning, supabase } from '../lib/supabase';
import {
  deleteUserLearning,
  fetchUserLearnings,
  insertUserLearning,
  loadLocalLearnings,
  saveLocalLearnings,
} from '../lib/projectsAndLearnings';

type UseLearningsOptions = {
  userId: string;
};

export function useLearnings({ userId }: UseLearningsOptions) {
  const [learnings, setLearnings] = useState<Learning[]>(() => loadLocalLearnings(userId));
  const [loading, setLoading] = useState(false);

  const loadLearnings = useCallback(async () => {
    if (!userId || userId.trim() === '') {
      setLearnings([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchUserLearnings(userId);
      setLearnings(list);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadLearnings();
    if (!userId || userId.trim() === '') return;

    const channel = supabase
      .channel(`learnings-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'learnings', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToLearning(payload.new as LearningRow);
            setLearnings((prev) => {
              if (prev.some((l) => l.id === incoming.id)) return prev;
              const next = [incoming, ...prev];
              saveLocalLearnings(userId, next);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = rowToLearning(payload.new as LearningRow);
            setLearnings((prev) => {
              const next = prev.map((l) => (l.id === updated.id ? updated : l));
              saveLocalLearnings(userId, next);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setLearnings((prev) => {
                const next = prev.filter((l) => l.id !== deletedId);
                saveLocalLearnings(userId, next);
                return next;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadLearnings, userId]);

  const addLearning = useCallback(
    async (form: LearningFormData): Promise<Learning | null> => {
      if (!userId || !form.content.trim()) return null;
      const optimisticId = crypto.randomUUID();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const optimistic: Learning = {
        id: optimisticId,
        user_id: userId,
        content: form.content.trim(),
        project_id: form.project_id ?? null,
        tags: form.tags,
        learned_date: form.learned_date || todayStr,
        created_at: now.toISOString(),
      };

      setLearnings((prev) => {
        const next = [optimistic, ...prev];
        saveLocalLearnings(userId, next);
        return next;
      });

      const saved = await insertUserLearning(userId, form, optimisticId);
      setLearnings((prev) => {
        const next = prev.map((l) => (l.id === optimisticId ? saved : l));
        saveLocalLearnings(userId, next);
        return next;
      });
      return saved;
    },
    [userId]
  );

  const deleteLearning = useCallback(
    async (learningId: string) => {
      setLearnings((prev) => {
        const next = prev.filter((l) => l.id !== learningId);
        saveLocalLearnings(userId, next);
        return next;
      });
      await deleteUserLearning(learningId);
    },
    [userId]
  );

  const importLearnings = useCallback(
    async (incoming: Learning[]) => {
      if (!userId || incoming.length === 0) return;
      const existingIds = new Set(learnings.map((l) => l.id));
      const newOnes = incoming.filter((l) => l.content && !existingIds.has(l.id));
      if (newOnes.length === 0) return;

      const merged = [...newOnes, ...learnings];
      setLearnings(merged);
      saveLocalLearnings(userId, merged);

      for (const l of newOnes) {
        await insertUserLearning(
          userId,
          {
            content: l.content,
            project_id: l.project_id,
            tags: l.tags || [],
            learned_date: l.learned_date,
          },
          l.id
        );
      }
    },
    [learnings, userId]
  );

  return {
    learnings,
    loading,
    addLearning,
    deleteLearning,
    importLearnings,
    refetchLearnings: loadLearnings,
  };
}
