import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Subtask, Task, TaskFormData } from '../types';
import {
  encodeNoteWithCategory,
  saveLocalCategory,
  saveLocalTaskMeta,
} from '../types';
import type { Database, TaskRow } from '../lib/supabase';
import { supabase, rowToTask } from '../lib/supabase';
import { scheduleTaskReminder, cancelTaskReminder } from '../lib/qstash';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// ─── Durum Tipleri ───────────────────────────────────────────
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type TaskStats = {
  total: number;
  completed: number;
  active: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  completionRate: number;
};

type UseTasksReturn = {
  tasks: Task[];
  activeTasks: Task[];
  completedTasks: Task[];
  archivedTasks: Task[];
  stats: TaskStats;
  loading: LoadingState;
  isSubmitting: boolean;
  error: string | null;
  deletedTaskToast: Task | null;
  addTask: (data: TaskFormData) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  editTask: (id: string, title: string, note?: string) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => void;
  undoDeleteTask: () => void;
  dismissDeleteToast: () => void;
  updateSubtasks: (taskId: string, subtasks: Subtask[]) => Promise<void>;
  snoozeTask: (id: string, mode?: '1h' | 'tomorrow') => Promise<void>;
  clearCompleted: () => Promise<void>;
  restoreCompleted: () => Promise<void>;
  archiveCompleted: () => Promise<void>;
  restoreFromArchive: (id: string) => Promise<void>;
  clearArchive: () => void;
  importTasks: (incoming: Task[]) => Promise<void>;
  refetch: () => Promise<void>;
};

type UseTasksOptions = {
  /** Supabase auth user id. Görevler yalnızca bu kullanıcıya filtrelenir. */
  userId: string;
};

const ARCHIVE_STORAGE_PREFIX = 'flowday_archived_tasks_';
const ORDER_STORAGE_PREFIX = 'flowday_task_order_';

function loadArchivedTasks(userId: string): Task[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${ARCHIVE_STORAGE_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveArchivedTasks(userId: string, list: Task[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${ARCHIVE_STORAGE_PREFIX}${userId}`, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function loadTaskOrder(userId: string): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${ORDER_STORAGE_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveTaskOrder(userId: string, order: string[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${ORDER_STORAGE_PREFIX}${userId}`, JSON.stringify(order));
  } catch {
    // ignore storage errors
  }
}

// ─── Hook ────────────────────────────────────────────────────
export function useTasks({ userId }: UseTasksOptions): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>(() => loadArchivedTasks(userId));
  const [taskOrder, setTaskOrder] = useState<string[]>(() => loadTaskOrder(userId));
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedTaskToast, setDeletedTaskToast] = useState<Task | null>(null);

  const isAddingRef = useRef(false);
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const qstashMessageIds = useRef<Map<string, string>>(new Map());
  const pendingDeleteRef = useRef<{
    task: Task;
    timerId: ReturnType<typeof setTimeout>;
  } | null>(null);

  // Kullanıcı değiştiğinde arşivi ve özel sıralamayı yükle
  useEffect(() => {
    setArchivedTasks(loadArchivedTasks(userId));
    setTaskOrder(loadTaskOrder(userId));
  }, [userId]);

  // Bekleyen silme işlemini veritabanına uygula
  const commitDeleteToDb = useCallback(async (taskToCommit: Task) => {
    const msgId = qstashMessageIds.current.get(taskToCommit.id);
    if (msgId) {
      void cancelTaskReminder(msgId);
      qstashMessageIds.current.delete(taskToCommit.id);
    }

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToCommit.id);

      if (deleteError) throw deleteError;
    } catch (err) {
      setTasks((prev) => [taskToCommit, ...prev]);
      const msg = err instanceof Error ? err.message : 'Görev silinemedi';
      setError(msg);
    }
  }, []);

  // Unmount olurken bekleyen silme varsa tamamla
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timerId);
        void commitDeleteToDb(pendingDeleteRef.current.task);
        pendingDeleteRef.current = null;
      }
    };
  }, [commitDeleteToDb]);

  // ── Görevleri yükle ────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!userId || userId.trim() === '') {
      return;
    }

    setLoading('loading');
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTasks(((data ?? []) as TaskRow[]).map(rowToTask));
      setLoading('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Görevler yüklenemedi';
      setError(msg);
      setLoading('error');
      console.error('[useTasks] fetchTasks:', err);
    }
  }, [userId]);

  // ── İlk yüklemede + realtime için ──────────────────────────
  useEffect(() => {
    if (!userId || userId.trim() === '') {
      setTasks([]);
      setLoading('idle');
      return;
    }

    setTasks([]);
    void fetchTasks();

    const channel = supabase
      .channel(`tasks-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => {
              const incoming = rowToTask(payload.new as TaskRow);
              const alreadyExists = prev.some((t) => t.id === incoming.id);
              if (alreadyExists) return prev;
              return [incoming, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === (payload.new as TaskRow).id
                  ? rowToTask(payload.new as TaskRow)
                  : t
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setTasks((prev) => prev.filter((t) => t.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchTasks, userId]);

  // ── Görev ekle ──────────────────────────────────────────────
  const addTask = useCallback(
    async (data: TaskFormData) => {
      if (!userId || userId.trim() === '') {
        setError('Görev eklemek için lütfen tekrar giriş yapın.');
        return;
      }

      if (isAddingRef.current) return;
      isAddingRef.current = true;
      setIsSubmitting(true);

      const resolvedCategory =
        data.category ?? (data.priority === 'high' ? 'urgent' : 'personal');
      const cleanNote = data.note.trim() || undefined;
      const resolvedProjectId = data.project_id ?? null;
      const resolvedSubtasks = data.subtasks ?? [];

      const optimisticTask: Task = {
        id: crypto.randomUUID(),
        title: data.title.trim(),
        note: cleanNote,
        priority: data.priority,
        category: resolvedCategory,
        project_id: resolvedProjectId,
        subtasks: resolvedSubtasks,
        completed: false,
        created_at: new Date().toISOString(),
        reminder_time: data.reminder_time,
      };

      saveLocalCategory(optimisticTask.id, resolvedCategory);
      saveLocalTaskMeta(optimisticTask.id, {
        category: resolvedCategory,
        project_id: resolvedProjectId,
        subtasks: resolvedSubtasks,
      });

      // Optimistic update — anında UI'ya yansıt ve özel sıralamanın en başına koy
      setTasks((prev) => [optimisticTask, ...prev]);
      setTaskOrder((prev) => {
        const next = [optimisticTask.id, ...prev.filter((id) => id !== optimisticTask.id)];
        saveTaskOrder(userId, next);
        return next;
      });

      try {
        const encodedNote = encodeNoteWithCategory(cleanNote, resolvedCategory);

        const basePayload: TaskInsert = {
          title: optimisticTask.title,
          note: encodedNote,
          priority: optimisticTask.priority,
          completed: false,
          completed_at: null,
          reminder_time: data.reminder_time ?? null,
          is_notified: false,
          user_id: userId,
        };

        const extendedPayload: TaskInsert = {
          ...basePayload,
          category: resolvedCategory,
          project_id: resolvedProjectId,
          subtasks: resolvedSubtasks,
        };

        let insertedRow: TaskRow | null = null;
        const { data: extData, error: extError } = await supabase
          .from('tasks')
          .insert(extendedPayload)
          .select()
          .single();

        if (extError) {
          // Migration henüz uzak veritabanında çalıştırılmadıysa temel kolonlarla kaydet
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('tasks')
            .insert(basePayload)
            .select()
            .single();

          if (fallbackError) throw fallbackError;
          insertedRow = fallbackData as TaskRow;
        } else {
          insertedRow = extData as TaskRow;
        }

        if (insertedRow) {
          saveLocalCategory(insertedRow.id, resolvedCategory);
          saveLocalTaskMeta(insertedRow.id, {
            category: resolvedCategory,
            project_id: resolvedProjectId,
            subtasks: resolvedSubtasks,
          });
          const savedTask = rowToTask(insertedRow);
          setTasks((prev) =>
            prev.map((t) => (t.id === optimisticTask.id ? savedTask : t))
          );
          setTaskOrder((prev) => {
            const next = prev.map((id) => (id === optimisticTask.id ? savedTask.id : id));
            saveTaskOrder(userId, next);
            return next;
          });

          // ── QStash: Hatırlatıcı zamanlaması ────────────────────────────────
          if (savedTask.reminder_time) {
            scheduleTaskReminder({
              taskId: savedTask.id,
              title: savedTask.title,
              reminderTime: savedTask.reminder_time,
              priority: savedTask.priority,
            })
              .then((result) => {
                if (result.ok && result.messageId) {
                  qstashMessageIds.current.set(savedTask.id, result.messageId);
                } else if (!result.ok) {
                  setError(`Hatırlatıcı zamanlanamadı: ${result.error}`);
                }
              })
              .catch((err: unknown) => {
                setError(
                  `Hatırlatıcı zamanlanamadı: ${
                    err instanceof Error ? err.message : String(err)
                  }`
                );
              });
          }
        }
      } catch (err: unknown) {
        setTasks((prev) => prev.filter((t) => t.id !== optimisticTask.id));
        const msg = err instanceof Error ? err.message : 'Görev eklenemedi';
        setError(msg);
      } finally {
        isAddingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [userId]
  );

  // ── Görev tamamla / geri al ────────────────────────────────
  const toggleTask = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;

      const newCompleted = !task.completed;
      const newCompletedAt = newCompleted ? new Date().toISOString() : null;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, completed: newCompleted, completed_at: newCompletedAt ?? undefined }
            : t
        )
      );

      if (newCompleted) {
        const msgId = qstashMessageIds.current.get(id);
        if (msgId) {
          void cancelTaskReminder(msgId);
          qstashMessageIds.current.delete(id);
        }
      }

      try {
        const updatePayload: TaskUpdate = {
          completed: newCompleted,
          completed_at: newCompletedAt,
        };
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', id);

        if (updateError) throw updateError;
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, completed: task.completed, completed_at: task.completed_at }
              : t
          )
        );
        const msg = err instanceof Error ? err.message : 'Görev güncellenemedi';
        setError(msg);
      }
    },
    []
  );

  // ── Görev başlık/not düzenle ────────────────────────────────
  const editTask = useCallback(
    async (id: string, title: string, note?: string) => {
      const target = tasksRef.current.find((t) => t.id === id);
      if (!target || !title.trim()) return;

      const cleanTitle = title.trim();
      const cleanNote = note?.trim() || undefined;
      const encodedNote = encodeNoteWithCategory(cleanNote, target.category);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: cleanTitle, note: cleanNote } : t
        )
      );

      try {
        const updatePayload: TaskUpdate = {
          title: cleanTitle,
          note: encodedNote,
        };
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', id);

        if (updateError) throw updateError;
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, title: target.title, note: target.note } : t
          )
        );
        const msg = err instanceof Error ? err.message : 'Görev güncellenemedi';
        setError(msg);
      }
    },
    []
  );

  // ── Alt Görevleri (Subtasks) Güncelle ──────────────────────
  const updateSubtasks = useCallback(
    async (taskId: string, subtasks: Subtask[]) => {
      const target = tasksRef.current.find((t) => t.id === taskId);
      if (!target) return;

      saveLocalTaskMeta(taskId, {
        category: target.category,
        project_id: target.project_id,
        subtasks,
      });

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks } : t))
      );

      try {
        await supabase
          .from('tasks')
          .update({ subtasks })
          .eq('id', taskId);
      } catch {
        // Şema henüz güncellenmediyse localStorage meta üzerinde kalır
      }
    },
    []
  );

  // ── Görev ertele (Snooze) ───────────────────────────────────
  const snoozeTask = useCallback(
    async (id: string, mode: '1h' | 'tomorrow' = '1h') => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;

      const now = new Date();
      const targetDate = new Date(now);
      if (mode === '1h') {
        targetDate.setHours(targetDate.getHours() + 1);
      } else {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(9, 0, 0, 0);
      }
      const newReminderIso = targetDate.toISOString();

      const oldMsgId = qstashMessageIds.current.get(id);
      if (oldMsgId) {
        void cancelTaskReminder(oldMsgId);
        qstashMessageIds.current.delete(id);
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, reminder_time: newReminderIso } : t))
      );

      try {
        const updatePayload: TaskUpdate = {
          reminder_time: newReminderIso,
          is_notified: false,
        };
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', id);

        if (updateError) throw updateError;

        void scheduleTaskReminder({
          taskId: task.id,
          title: task.title,
          reminderTime: newReminderIso,
          priority: task.priority,
        }).then((res) => {
          if (res.ok && res.messageId) {
            qstashMessageIds.current.set(task.id, res.messageId);
          }
        });
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, reminder_time: task.reminder_time } : t))
        );
        const msg = err instanceof Error ? err.message : 'Görev ertelenemedi';
        setError(msg);
      }
    },
    []
  );

  // ── Görev sil (5 sn Geri Al Toast ile) ──────────────────────
  const deleteTask = useCallback(
    async (id: string) => {
      const deleted = tasksRef.current.find((t) => t.id === id);
      if (!deleted) return;

      // Önceki bekleyen silme varsa hemen veritabanına uygula
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timerId);
        void commitDeleteToDb(pendingDeleteRef.current.task);
        pendingDeleteRef.current = null;
      }

      // Listeden anında çıkar
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setDeletedTaskToast(deleted);

      // 5 saniye sonra veritabanından sil
      const timerId = setTimeout(() => {
        pendingDeleteRef.current = null;
        setDeletedTaskToast(null);
        void commitDeleteToDb(deleted);
      }, 5000);

      pendingDeleteRef.current = { task: deleted, timerId };
    },
    [commitDeleteToDb]
  );

  // ── Silinen görevi 5 sn içinde geri al ──────────────────────
  const undoDeleteTask = useCallback(() => {
    if (!pendingDeleteRef.current) return;
    const { task, timerId } = pendingDeleteRef.current;
    clearTimeout(timerId);
    pendingDeleteRef.current = null;
    setDeletedTaskToast(null);

    setTasks((prev) => {
      if (prev.some((t) => t.id === task.id)) return prev;
      return [task, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, []);

  const dismissDeleteToast = useCallback(() => {
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timerId);
      const taskToCommit = pendingDeleteRef.current.task;
      pendingDeleteRef.current = null;
      void commitDeleteToDb(taskToCommit);
    }
    setDeletedTaskToast(null);
  }, [commitDeleteToDb]);

  // ── Tümünü temizle ──────────────────────────────────────────
  const clearCompleted = useCallback(async () => {
    const toDelete = tasks.filter((t) => t.completed);
    if (toDelete.length === 0) return;

    setTasks((prev) => prev.filter((t) => !t.completed));

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .eq('completed', true);

      if (deleteError) throw deleteError;
    } catch (err) {
      setTasks((prev) => [...toDelete, ...prev]);
      const msg = err instanceof Error ? err.message : 'Tamamlananlar temizlenemedi';
      setError(msg);
    }
  }, [tasks, userId]);

  // ── Tamamlananları Geri Yükle (Toplu) ──────────────────────
  const restoreCompleted = useCallback(async () => {
    const toRestore = tasks.filter((t) => t.completed);
    if (toRestore.length === 0) return;

    setTasks((prev) =>
      prev.map((t) => (t.completed ? { ...t, completed: false, completed_at: undefined } : t))
    );

    try {
      const updatePayload: TaskUpdate = {
        completed: false,
        completed_at: null,
      };
      const { error: updateError } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('user_id', userId)
        .eq('completed', true);

      if (updateError) throw updateError;
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => {
          const orig = toRestore.find((r) => r.id === t.id);
          return orig ? orig : t;
        })
      );
      const msg = err instanceof Error ? err.message : 'Görevler geri yüklenemedi';
      setError(msg);
    }
  }, [tasks, userId]);

  // ── Tamamlananları Arşive Taşı ──────────────────────────────
  const archiveCompleted = useCallback(async () => {
    const toArchive = tasks.filter((t) => t.completed);
    if (toArchive.length === 0) return;

    const updatedArchive = [...toArchive, ...archivedTasks].slice(0, 100);
    setArchivedTasks(updatedArchive);
    saveArchivedTasks(userId, updatedArchive);

    setTasks((prev) => prev.filter((t) => !t.completed));

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .eq('completed', true);

      if (deleteError) throw deleteError;
    } catch (err) {
      setTasks((prev) => [...toArchive, ...prev]);
      const msg = err instanceof Error ? err.message : 'Arşivleme başarısız oldu';
      setError(msg);
    }
  }, [tasks, archivedTasks, userId]);

  // ── Arşivden Geri Yükle ─────────────────────────────────────
  const restoreFromArchive = useCallback(
    async (id: string) => {
      const target = archivedTasks.find((t) => t.id === id);
      if (!target) return;

      const nextArchive = archivedTasks.filter((t) => t.id !== id);
      setArchivedTasks(nextArchive);
      saveArchivedTasks(userId, nextArchive);

      await addTask({
        title: target.title,
        note: target.note ?? '',
        priority: target.priority,
        category: target.category,
        project_id: target.project_id,
        subtasks: target.subtasks,
        reminder_time: null,
      });
    },
    [archivedTasks, userId, addTask]
  );

  const clearArchive = useCallback(() => {
    setArchivedTasks([]);
    saveArchivedTasks(userId, []);
  }, [userId]);

  // ── Sürükle-Bırak Görev Sıralaması Güncelle ─────────────────
  const reorderTasks = useCallback(
    (orderedIds: string[]) => {
      setTaskOrder((prev) => {
        const orderedSet = new Set(orderedIds);
        const remaining = prev.filter((id) => !orderedSet.has(id));
        const next = [...orderedIds, ...remaining];
        saveTaskOrder(userId, next);
        return next;
      });
    },
    [userId]
  );

  // ── JSON İçe Aktarma (Import) ───────────────────────────────
  const importTasks = useCallback(
    async (incoming: Task[]) => {
      if (!userId || incoming.length === 0) return;
      const existingIds = new Set(tasks.map((t) => t.id));
      const newOnes = incoming.filter((t) => t.title && !existingIds.has(t.id));
      if (newOnes.length === 0) return;

      for (const item of newOnes) {
        saveLocalCategory(item.id, item.category);
        saveLocalTaskMeta(item.id, {
          category: item.category,
          project_id: item.project_id ?? null,
          subtasks: item.subtasks ?? [],
        });
      }

      setTasks((prev) => [...newOnes, ...prev]);

      for (const item of newOnes) {
        const baseRow: TaskInsert = {
          id: item.id,
          title: item.title,
          note: encodeNoteWithCategory(item.note, item.category),
          priority: item.priority || 'medium',
          completed: Boolean(item.completed),
          created_at: item.created_at || new Date().toISOString(),
          completed_at: item.completed_at ?? null,
          reminder_time: item.reminder_time ?? null,
          is_notified: true,
          user_id: userId,
        };
        try {
          await supabase.from('tasks').upsert(baseRow);
        } catch {
          // ignore individual import errors
        }
      }
    },
    [tasks, userId]
  );

  // ── Derived state ──────────────────────────────────────────
  const activeTasks = useMemo(() => {
    const active = tasks.filter((t) => !t.completed);
    if (taskOrder.length === 0) return active;
    const indexMap = new Map<string, number>();
    taskOrder.forEach((id, idx) => indexMap.set(id, idx));
    return [...active].sort((a, b) => {
      const idxA = indexMap.get(a.id);
      const idxB = indexMap.get(b.id);
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return 1;
      if (idxB !== undefined) return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, taskOrder]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = completedTasks.length;
    const active = activeTasks.length;
    const highPriority = tasks.filter((t) => t.priority === 'high').length;
    const mediumPriority = tasks.filter((t) => t.priority === 'medium').length;
    const lowPriority = tasks.filter((t) => t.priority === 'low').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      active,
      highPriority,
      mediumPriority,
      lowPriority,
      completionRate,
    };
  }, [tasks, activeTasks, completedTasks]);

  return {
    tasks,
    activeTasks,
    completedTasks,
    archivedTasks,
    stats,
    loading,
    isSubmitting,
    error,
    deletedTaskToast,
    addTask,
    toggleTask,
    deleteTask,
    editTask,
    reorderTasks,
    undoDeleteTask,
    dismissDeleteToast,
    updateSubtasks,
    snoozeTask,
    clearCompleted,
    restoreCompleted,
    archiveCompleted,
    restoreFromArchive,
    clearArchive,
    importTasks,
    refetch: fetchTasks,
  };
}
