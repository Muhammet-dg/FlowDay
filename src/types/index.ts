export type Priority = 'low' | 'medium' | 'high';

export type Category = 'work' | 'personal' | 'urgent';

// FilterCategory: 'all', standart kategoriler veya 'project:<id>' şeklinde proje filtresi
export type FilterCategory = 'all' | Category | `project:${string}`;

export type Tab = 'tasks' | 'projects' | 'completed' | 'stats';

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Task = {
  id: string;
  title: string;
  note?: string;
  priority: Priority;
  category?: Category;
  project_id?: string | null;
  subtasks?: Subtask[];
  completed: boolean;
  created_at: string;
  completed_at?: string;
  reminder_time?: string | null; // ISO 8601 — bildirim zamanı
  user_id?: string;
};

export type TaskFormData = {
  title: string;
  note: string;
  priority: Priority;
  category?: Category;
  project_id?: string | null;
  subtasks?: Subtask[];
  reminder_time: string | null; // ISO 8601 — null ise bildirim yok
};

// ─── Proje ve Öğrendiklerim Tipleri ─────────────────────────────────────────

export type ProjectStatus = 'active' | 'on_hold' | 'completed';

export type ProjectIconName =
  | 'folder'
  | 'rocket'
  | 'code'
  | 'book'
  | 'target'
  | 'briefcase'
  | 'sparkles'
  | 'layers';

export type Milestone = {
  id: string;
  title: string;
  completed: boolean;
  target_date?: string | null;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: ProjectIconName;
  description?: string;
  start_date?: string | null;
  target_date?: string | null;
  status: ProjectStatus;
  milestones: Milestone[];
  created_at: string;
  updated_at?: string;
};

export type ProjectFormData = {
  name: string;
  color: string;
  icon: ProjectIconName;
  description?: string;
  start_date?: string | null;
  target_date?: string | null;
  status: ProjectStatus;
  milestones?: Milestone[];
};

export type Learning = {
  id: string;
  user_id: string;
  content: string;
  project_id?: string | null;
  tags: string[];
  learned_date: string; // YYYY-MM-DD
  created_at: string;
};

export type LearningFormData = {
  content: string;
  project_id?: string | null;
  tags: string[];
  learned_date?: string;
};

// ─── Rutin Görevler (Routines & Routine Logs) Tipleri ───────────────────────

export type RoutineRepeatType = 'daily' | 'weekdays' | 'weekends' | 'custom';

export type RoutineStatus = 'active' | 'paused' | 'archived';

export type RoutineLogStatus = 'pending' | 'done' | 'skipped';

export type Routine = {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  color: string;
  category: Category;
  project_id?: string | null;
  time?: string | null; // 'HH:MM'
  reminder: boolean;
  repeat_type: RoutineRepeatType;
  repeat_days: number[]; // 0=Paz, 1=Pzt, 2=Sal, 3=Çar, 4=Per, 5=Cum, 6=Cmt
  target_count: number;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  status: RoutineStatus;
  created_at: string;
  updated_at?: string;
};

export type RoutineFormData = {
  title: string;
  icon: string;
  color: string;
  category: Category;
  project_id?: string | null;
  time?: string | null;
  reminder: boolean;
  repeat_type: RoutineRepeatType;
  repeat_days: number[];
  target_count: number;
  start_date: string;
  end_date?: string | null;
  status?: RoutineStatus;
};

export type RoutineLog = {
  id: string;
  user_id: string;
  routine_id: string;
  date: string; // YYYY-MM-DD
  status: RoutineLogStatus;
  count: number;
  target_count: number;
  completed_at?: string | null;
  created_at: string;
};

export const ROUTINE_ICONS = [
  '💧',
  '📚',
  '🏃',
  '🧘',
  '💻',
  '🇬🇧',
  '🍎',
  '💊',
  '✍️',
  '🎯',
] as const;

export const ROUTINE_REPEAT_LABELS: Record<RoutineRepeatType, string> = {
  daily: 'Her gün',
  weekdays: 'Hafta içi',
  weekends: 'Hafta sonu',
  custom: 'Seçili günler',
};

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; badgeBg: string; badgeText: string; dotColor: string }
> = {
  active: {
    label: 'Aktif',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    dotColor: '#10B981',
  },
  on_hold: {
    label: 'Beklemede',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    dotColor: '#F59E0B',
  },
  completed: {
    label: 'Tamamlandı',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-300',
    dotColor: '#6366F1',
  },
};

export const PROJECT_COLORS = [
  { id: 'indigo', hex: '#6366F1', label: 'İndigo' },
  { id: 'emerald', hex: '#10B981', label: 'Zümrüt' },
  { id: 'amber', hex: '#F59E0B', label: 'Kehribar' },
  { id: 'rose', hex: '#F43F5E', label: 'Mercan' },
  { id: 'cyan', hex: '#06B6D4', label: 'Turkuaz' },
  { id: 'violet', hex: '#8B5CF6', label: 'Mor' },
] as const;

export const PRIORITY_CONFIG = {
  low: {
    label: 'Düşük',
    color: 'bg-slate-400',
    borderColor: 'border-l-slate-400',
    textColor: 'text-slate-400',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-300',
    dotColor: 'bg-slate-400',
    hex: '#64748B',
  },
  medium: {
    label: 'Orta',
    color: 'bg-amber-500',
    borderColor: 'border-l-amber-500',
    textColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    dotColor: 'bg-amber-400',
    hex: '#F59E0B',
  },
  high: {
    label: 'Yüksek',
    color: 'bg-red-500',
    borderColor: 'border-l-red-500',
    textColor: 'text-red-400',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    dotColor: 'bg-red-400',
    hex: '#EF4444',
  },
} as const;

export const CATEGORY_CONFIG: Record<
  Category,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
    dotColor: string;
  }
> = {
  work: {
    label: 'İş / Proje',
    shortLabel: 'İş / Proje',
    badgeBg: 'bg-indigo-500/12',
    badgeText: 'text-indigo-300',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    dotColor: '#818CF8',
  },
  personal: {
    label: 'Kişisel',
    shortLabel: 'Kişisel',
    badgeBg: 'bg-emerald-500/12',
    badgeText: 'text-emerald-300',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    dotColor: '#34D399',
  },
  urgent: {
    label: 'Acil',
    shortLabel: 'Acil',
    badgeBg: 'bg-red-500/12',
    badgeText: 'text-red-300',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    dotColor: '#F87171',
  },
};

// ─── Kategori & Meta Yardımcıları (Şema bağımsız kalıcılık + geriye uyumluluk) ───

const CATEGORY_PREFIX_REGEX = /^\[cat:(work|personal|urgent)\]\s*/i;
const LOCAL_CATEGORY_KEY = 'flowday_task_categories_v1';
const LOCAL_TASK_META_KEY = 'flowday_task_meta_v2';

type LocalTaskMeta = {
  category?: Category;
  project_id?: string | null;
  subtasks?: Subtask[];
};

export function saveLocalCategory(taskId: string, category?: Category): void {
  if (!category) return;
  try {
    const raw = localStorage.getItem(LOCAL_CATEGORY_KEY);
    const map: Record<string, Category> = raw ? (JSON.parse(raw) as Record<string, Category>) : {};
    map[taskId] = category;
    localStorage.setItem(LOCAL_CATEGORY_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function getLocalCategory(taskId: string): Category | undefined {
  try {
    const raw = localStorage.getItem(LOCAL_CATEGORY_KEY);
    if (!raw) return undefined;
    const map: Record<string, Category> = JSON.parse(raw) as Record<string, Category>;
    return map[taskId];
  } catch {
    return undefined;
  }
}

export function saveLocalTaskMeta(taskId: string, meta: LocalTaskMeta): void {
  try {
    const raw = localStorage.getItem(LOCAL_TASK_META_KEY);
    const map: Record<string, LocalTaskMeta> = raw
      ? (JSON.parse(raw) as Record<string, LocalTaskMeta>)
      : {};
    map[taskId] = { ...map[taskId], ...meta };
    localStorage.setItem(LOCAL_TASK_META_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function getLocalTaskMeta(taskId: string): LocalTaskMeta | undefined {
  try {
    const raw = localStorage.getItem(LOCAL_TASK_META_KEY);
    if (!raw) return undefined;
    const map: Record<string, LocalTaskMeta> = JSON.parse(raw) as Record<string, LocalTaskMeta>;
    return map[taskId];
  } catch {
    return undefined;
  }
}

export function encodeNoteWithCategory(note?: string, category?: Category): string | null {
  const cleanNote = (note ?? '').replace(CATEGORY_PREFIX_REGEX, '').trim();
  if (!category) {
    return cleanNote || null;
  }
  return cleanNote ? `[cat:${category}] ${cleanNote}` : `[cat:${category}]`;
}

export function decodeNoteAndCategory(
  rawNote?: string | null,
  taskId?: string,
  priority?: Priority,
  rowCategory?: Category | null
): { note?: string; category?: Category } {
  if (!rawNote) {
    const localCat = taskId ? getLocalCategory(taskId) : undefined;
    const inferred = rowCategory ?? localCat ?? (priority === 'high' ? 'urgent' : 'personal');
    return { note: undefined, category: inferred };
  }

  const match = rawNote.match(CATEGORY_PREFIX_REGEX);
  if (match) {
    const cat = match[1].toLowerCase() as Category;
    const stripped = rawNote.replace(CATEGORY_PREFIX_REGEX, '').trim();
    return {
      note: stripped || undefined,
      category: rowCategory ?? cat,
    };
  }

  const localCat = taskId ? getLocalCategory(taskId) : undefined;
  const inferred = rowCategory ?? localCat ?? (priority === 'high' ? 'urgent' : 'personal');
  return {
    note: rawNote,
    category: inferred,
  };
}
