import { createClient } from '@supabase/supabase-js';
import type {
  Category,
  Learning,
  Milestone,
  Project,
  ProjectIconName,
  ProjectStatus,
  Subtask,
  Task,
} from '../types';
import { decodeNoteAndCategory, getLocalTaskMeta } from '../types';
import type { PushSubscriptionJSON } from '../hooks/useNotifications';

const DEFAULT_SUPABASE_URL = 'https://ooeowjpmoxjzxtwqwvtk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_4Lusd9avoZzeIygvaZMnug_mOdjIq31';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

// ─── tasks tablosu ───────────────────────────────────────────
export type TaskRow = {
  id: string;
  title: string;
  note: string | null;
  priority: 'low' | 'medium' | 'high';
  category?: Category | null;
  project_id?: string | null;
  subtasks?: Subtask[] | null;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  reminder_time: string | null; // ISO 8601 — bildirim zamanı
  is_notified: boolean; // bildirim gönderildi mi
  user_id: string | null;
};

// ─── projects tablosu ────────────────────────────────────────
export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  start_date: string | null;
  target_date: string | null;
  status: ProjectStatus;
  milestones: Milestone[] | null;
  created_at: string;
  updated_at: string;
};

// ─── learnings tablosu ───────────────────────────────────────
export type LearningRow = {
  id: string;
  user_id: string;
  content: string;
  project_id: string | null;
  tags: string[] | null;
  learned_date: string;
  created_at: string;
};

// ─── push_subscriptions tablosu ──────────────────────────────
export type PushSubscriptionRow = {
  id: string;
  user_id: string | null;
  device_label: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

// ─── user_fcm_tokens tablosu ─────────────────────────────────
export type UserFcmTokenRow = {
  id: string;
  user_id: string | null;
  fcm_token: string;
  device_label: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: TaskRow;
        Insert: Omit<TaskRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<TaskRow, 'id'>>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProjectRow, 'id'>>;
        Relationships: [];
      };
      learnings: {
        Row: LearningRow;
        Insert: Omit<LearningRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<LearningRow, 'id'>>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Omit<PushSubscriptionRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PushSubscriptionRow, 'id'>>;
        Relationships: [];
      };
      user_fcm_tokens: {
        Row: UserFcmTokenRow;
        Insert: Omit<UserFcmTokenRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserFcmTokenRow, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Supabase satırını uygulama Task tipine dönüştür
export function rowToTask(row: TaskRow): Task {
  const localMeta = getLocalTaskMeta(row.id);
  const { note, category } = decodeNoteAndCategory(
    row.note,
    row.id,
    row.priority,
    row.category ?? localMeta?.category ?? null
  );

  return {
    id: row.id,
    title: row.title,
    note,
    priority: row.priority,
    category,
    project_id: row.project_id !== undefined ? row.project_id : (localMeta?.project_id ?? null),
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : (localMeta?.subtasks ?? []),
    completed: row.completed,
    created_at: row.created_at,
    completed_at: row.completed_at ?? undefined,
    reminder_time: row.reminder_time ?? null,
    user_id: row.user_id ?? undefined,
  };
}

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color || '#6366F1',
    icon: (row.icon as ProjectIconName) || 'folder',
    description: row.description ?? undefined,
    start_date: row.start_date,
    target_date: row.target_date,
    status: row.status || 'active',
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToLearning(row: LearningRow): Learning {
  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    project_id: row.project_id,
    tags: Array.isArray(row.tags) ? row.tags : [],
    learned_date: row.learned_date,
    created_at: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Push Aboneliği Yardımcı Fonksiyonları
// ─────────────────────────────────────────────────────────────

export async function savePushSubscription(
  sub: PushSubscriptionJSON,
  deviceLabel: string,
  userId?: string | null
): Promise<PushSubscriptionRow | null> {
  const payload: Database['public']['Tables']['push_subscriptions']['Insert'] = {
    user_id: userId ?? null,
    device_label: deviceLabel.trim() || 'Bilinmeyen Cihaz',
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  };

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' })
    .select()
    .single();

  if (error) {
    console.error('[supabase] savePushSubscription hatası:', error);
    return null;
  }

  return data as PushSubscriptionRow;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[supabase] removePushSubscription hatası:', error);
  }
}

export async function getPushSubscriptions(
  userId: string
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabase] getPushSubscriptions hatası:', error);
    return [];
  }

  return (data ?? []) as PushSubscriptionRow[];
}
