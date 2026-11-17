import { useState, useEffect, useCallback } from 'react';
import type { Milestone, Project, ProjectFormData } from '../types';
import type { ProjectRow } from '../lib/supabase';
import { rowToProject, supabase } from '../lib/supabase';
import {
  deleteUserProject,
  fetchUserProjects,
  insertUserProject,
  loadLocalProjects,
  saveLocalProjects,
  updateUserProject,
} from '../lib/projectsAndLearnings';

type UseProjectsOptions = {
  userId: string;
};

export function useProjects({ userId }: UseProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>(() => loadLocalProjects(userId));
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!userId || userId.trim() === '') {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchUserProjects(userId);
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProjects();
    if (!userId || userId.trim() === '') return;

    const channel = supabase
      .channel(`projects-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToProject(payload.new as ProjectRow);
            setProjects((prev) => {
              if (prev.some((p) => p.id === incoming.id)) return prev;
              const next = [incoming, ...prev];
              saveLocalProjects(userId, next);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = rowToProject(payload.new as ProjectRow);
            setProjects((prev) => {
              const next = prev.map((p) => (p.id === updated.id ? updated : p));
              saveLocalProjects(userId, next);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setProjects((prev) => {
                const next = prev.filter((p) => p.id !== deletedId);
                saveLocalProjects(userId, next);
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
  }, [loadProjects, userId]);

  const addProject = useCallback(
    async (form: ProjectFormData): Promise<Project | null> => {
      if (!userId || !form.name.trim()) return null;
      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: Project = {
        id: optimisticId,
        user_id: userId,
        name: form.name.trim(),
        color: form.color,
        icon: form.icon,
        description: form.description?.trim() || undefined,
        start_date: form.start_date ?? null,
        target_date: form.target_date ?? null,
        status: form.status,
        milestones: form.milestones ?? [],
        created_at: now,
        updated_at: now,
      };

      setProjects((prev) => {
        const next = [optimistic, ...prev];
        saveLocalProjects(userId, next);
        return next;
      });

      const saved = await insertUserProject(userId, form, optimisticId);
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === optimisticId ? saved : p));
        saveLocalProjects(userId, next);
        return next;
      });
      return saved;
    },
    [userId]
  );

  const updateProject = useCallback(
    async (projectId: string, updates: Partial<ProjectFormData>) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
        );
        saveLocalProjects(userId, next);
        return next;
      });
      await updateUserProject(projectId, updates);
    },
    [userId]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== projectId);
        saveLocalProjects(userId, next);
        return next;
      });
      await deleteUserProject(projectId);
    },
    [userId]
  );

  const addMilestone = useCallback(
    async (projectId: string, title: string, targetDate?: string | null) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target || !title.trim()) return;
      const newMilestone: Milestone = {
        id: crypto.randomUUID(),
        title: title.trim(),
        completed: false,
        target_date: targetDate ?? null,
      };
      const nextMilestones = [...target.milestones, newMilestone];
      await updateProject(projectId, { milestones: nextMilestones });
    },
    [projects, updateProject]
  );

  const toggleMilestone = useCallback(
    async (projectId: string, milestoneId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;
      const nextMilestones = target.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      );
      await updateProject(projectId, { milestones: nextMilestones });
    },
    [projects, updateProject]
  );

  const deleteMilestone = useCallback(
    async (projectId: string, milestoneId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;
      const nextMilestones = target.milestones.filter((m) => m.id !== milestoneId);
      await updateProject(projectId, { milestones: nextMilestones });
    },
    [projects, updateProject]
  );

  const importProjects = useCallback(
    async (incoming: Project[]) => {
      if (!userId || incoming.length === 0) return;
      const existingIds = new Set(projects.map((p) => p.id));
      const newOnes = incoming.filter((p) => p.name && !existingIds.has(p.id));
      if (newOnes.length === 0) return;

      const merged = [...newOnes, ...projects];
      setProjects(merged);
      saveLocalProjects(userId, merged);

      for (const p of newOnes) {
        await insertUserProject(
          userId,
          {
            name: p.name,
            color: p.color || '#6366F1',
            icon: p.icon || 'folder',
            description: p.description,
            start_date: p.start_date,
            target_date: p.target_date,
            status: p.status || 'active',
            milestones: p.milestones || [],
          },
          p.id
        );
      }
    },
    [projects, userId]
  );

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
    importProjects,
    refetchProjects: loadProjects,
  };
}
