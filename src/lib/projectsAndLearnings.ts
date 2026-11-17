import type {
  Learning,
  LearningFormData,
  Project,
  ProjectFormData,
} from '../types';
import type { Database, LearningRow, ProjectRow } from './supabase';
import { rowToLearning, rowToProject, supabase } from './supabase';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type LearningInsert = Database['public']['Tables']['learnings']['Insert'];

const LOCAL_PROJECTS_PREFIX = 'flowday_projects_v1_';
const LOCAL_LEARNINGS_PREFIX = 'flowday_learnings_v1_';

export function loadLocalProjects(userId: string): Project[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_PROJECTS_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(userId: string, projects: Project[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCAL_PROJECTS_PREFIX}${userId}`, JSON.stringify(projects));
  } catch {
    // ignore storage errors
  }
}

export function loadLocalLearnings(userId: string): Learning[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_LEARNINGS_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Learning[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalLearnings(userId: string, learnings: Learning[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${LOCAL_LEARNINGS_PREFIX}${userId}`, JSON.stringify(learnings));
  } catch {
    // ignore storage errors
  }
}

// ─── Projeler Supabase + Çevrimdışı/Şema Fallback Çağrıları ──────────────────

export async function fetchUserProjects(userId: string): Promise<Project[]> {
  const local = loadLocalProjects(userId);
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return local;
    }

    const remote = ((data ?? []) as ProjectRow[]).map(rowToProject);
    // Remote ve local veriyi birleştir (henüz senkronize olmamış local kayıtları buluta aktar)
    const remoteIds = new Set(remote.map((r) => r.id));
    const unsyncedLocal = local.filter((l) => !remoteIds.has(l.id));
    if (unsyncedLocal.length > 0) {
      const syncPayloads: ProjectInsert[] = unsyncedLocal.map((p) => ({
        id: p.id,
        user_id: userId,
        name: p.name,
        color: p.color,
        icon: p.icon,
        description: p.description ?? null,
        start_date: p.start_date ?? null,
        target_date: p.target_date ?? null,
        status: p.status,
        milestones: p.milestones,
        created_at: p.created_at,
        updated_at: p.updated_at ?? p.created_at,
      }));
      await supabase.from('projects').upsert(syncPayloads, { onConflict: 'id' });
    }
    const merged = [...unsyncedLocal, ...remote];
    saveLocalProjects(userId, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function insertUserProject(
  userId: string,
  form: ProjectFormData,
  optimisticId?: string
): Promise<Project> {
  const now = new Date().toISOString();
  const fallbackProject: Project = {
    id: optimisticId ?? crypto.randomUUID(),
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

  const payload: ProjectInsert = {
    id: fallbackProject.id,
    user_id: userId,
    name: fallbackProject.name,
    color: fallbackProject.color,
    icon: fallbackProject.icon,
    description: fallbackProject.description ?? null,
    start_date: fallbackProject.start_date ?? null,
    target_date: fallbackProject.target_date ?? null,
    status: fallbackProject.status,
    milestones: fallbackProject.milestones,
  };

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      return fallbackProject;
    }
    return rowToProject(data as ProjectRow);
  } catch {
    return fallbackProject;
  }
}

export async function updateUserProject(
  projectId: string,
  updates: Partial<ProjectFormData>
): Promise<boolean> {
  const payload: ProjectUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.description !== undefined) payload.description = updates.description.trim() || null;
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.target_date !== undefined) payload.target_date = updates.target_date;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.milestones !== undefined) payload.milestones = updates.milestones;

  try {
    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId);

    return !error;
  } catch {
    return false;
  }
}

export async function deleteUserProject(projectId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    return !error;
  } catch {
    return false;
  }
}

// ─── Öğrendiklerim Supabase + Çevrimdışı/Şema Fallback Çağrıları ─────────────

export async function fetchUserLearnings(userId: string): Promise<Learning[]> {
  const local = loadLocalLearnings(userId);
  try {
    const { data, error } = await supabase
      .from('learnings')
      .select('*')
      .eq('user_id', userId)
      .order('learned_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return local;
    }

    const remote = ((data ?? []) as LearningRow[]).map(rowToLearning);
    const remoteIds = new Set(remote.map((r) => r.id));
    const unsyncedLocal = local.filter((l) => !remoteIds.has(l.id));
    if (unsyncedLocal.length > 0) {
      const syncPayloads: LearningInsert[] = unsyncedLocal.map((l) => ({
        id: l.id,
        user_id: userId,
        content: l.content,
        project_id: l.project_id ?? null,
        tags: l.tags,
        learned_date: l.learned_date,
        created_at: l.created_at,
      }));
      await supabase.from('learnings').upsert(syncPayloads, { onConflict: 'id' });
    }
    const merged = [...unsyncedLocal, ...remote];
    saveLocalLearnings(userId, merged);
    return merged;
  } catch {
    return local;
  }
}

export async function insertUserLearning(
  userId: string,
  form: LearningFormData,
  optimisticId?: string
): Promise<Learning> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const learnedDate = form.learned_date || todayStr;

  const fallbackLearning: Learning = {
    id: optimisticId ?? crypto.randomUUID(),
    user_id: userId,
    content: form.content.trim(),
    project_id: form.project_id ?? null,
    tags: form.tags,
    learned_date: learnedDate,
    created_at: now.toISOString(),
  };

  const payload: LearningInsert = {
    id: fallbackLearning.id,
    user_id: userId,
    content: fallbackLearning.content,
    project_id: fallbackLearning.project_id ?? null,
    tags: fallbackLearning.tags,
    learned_date: fallbackLearning.learned_date,
  };

  try {
    const { data, error } = await supabase
      .from('learnings')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      return fallbackLearning;
    }
    return rowToLearning(data as LearningRow);
  } catch {
    return fallbackLearning;
  }
}

export async function deleteUserLearning(learningId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('learnings')
      .delete()
      .eq('id', learningId);

    return !error;
  } catch {
    return false;
  }
}
