import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderKanban,
  BookOpen,
  Plus,
  X,
  Calendar,
  Target,
  CheckCircle2,
  Flame,
  ArrowLeft,
  Trash2,
  Search,
  Tag,
  Sparkles,
  Check,
  Flag,
  Layers,
  Repeat,
} from 'lucide-react';
import type {
  Learning,
  LearningFormData,
  Project,
  ProjectFormData,
  ProjectIconName,
  ProjectStatus,
  Routine,
  RoutineFormData,
  RoutineStatus,
  Subtask,
  Task,
  TaskFormData,
} from '../types';
import { PROJECT_COLORS, PROJECT_STATUS_CONFIG } from '../types';
import type { SingleRoutineStats } from '../lib/routines';
import { ProjectIcon } from './TodayProjectsStrip';
import { TaskCard } from './TaskCard';
import { RoutinesManagerView } from './RoutinesManagerView';

type ProjectsViewProps = {
  projects: Project[];
  tasks: Task[];
  learnings: Learning[];
  routines?: Routine[];
  routineStatsMap?: Map<string, SingleRoutineStats>;
  initialProjectId?: string | null;
  initialSubView?: 'projects' | 'routines' | 'learnings';
  initialRoutineId?: string | null;
  onClearInitialProject?: () => void;
  onClearInitialRoutine?: () => void;
  onAddProject: (data: ProjectFormData) => Promise<Project | null>;
  onUpdateProject: (id: string, updates: Partial<ProjectFormData>) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onAddMilestone: (projectId: string, title: string, targetDate?: string | null) => Promise<void>;
  onToggleMilestone: (projectId: string, milestoneId: string) => Promise<void>;
  onDeleteMilestone: (projectId: string, milestoneId: string) => Promise<void>;
  onAddTask: (data: TaskFormData) => Promise<void>;
  onToggleTask: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateSubtasks: (taskId: string, subtasks: Subtask[]) => Promise<void>;
  onAddLearning: (data: LearningFormData) => Promise<Learning | null>;
  onDeleteLearning: (id: string) => Promise<void>;
  onAddRoutine?: (form: RoutineFormData) => Promise<Routine | null>;
  onUpdateRoutine?: (id: string, updates: Partial<RoutineFormData>) => Promise<void>;
  onSetRoutineStatus?: (id: string, status: RoutineStatus) => Promise<void>;
};

const ICON_OPTIONS: Array<{ id: ProjectIconName; label: string }> = [
  { id: 'folder', label: 'Klasör' },
  { id: 'rocket', label: 'Roket' },
  { id: 'code', label: 'Kod' },
  { id: 'book', label: 'Kitap' },
  { id: 'target', label: 'Hedef' },
  { id: 'briefcase', label: 'İş' },
  { id: 'sparkles', label: 'Yıldız' },
  { id: 'layers', label: 'Katman' },
];

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function computeProjectStreak(projectTasks: Task[]): number {
  const completedDates = new Set<string>();
  for (const t of projectTasks) {
    if (t.completed) {
      const d = (t.completed_at ?? t.created_at).slice(0, 10);
      completedDates.add(d);
    }
  }
  if (completedDates.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  const todayStr = getDateStr(cursor);
  if (!completedDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completedDates.has(getDateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ProjectsView({
  projects,
  tasks,
  learnings,
  routines = [],
  routineStatsMap = new Map(),
  initialProjectId = null,
  initialSubView = 'projects',
  initialRoutineId = null,
  onClearInitialProject,
  onClearInitialRoutine,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddMilestone,
  onToggleMilestone,
  onDeleteMilestone,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateSubtasks,
  onAddLearning,
  onDeleteLearning,
  onAddRoutine,
  onUpdateRoutine,
  onSetRoutineStatus,
}: ProjectsViewProps) {
  const [subView, setSubView] = useState<'projects' | 'routines' | 'learnings'>(initialSubView);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Yeni Proje Formu
  const [projName, setProjName] = useState('');
  const [projColor, setProjColor] = useState<string>(PROJECT_COLORS[0].hex);
  const [projIcon, setProjIcon] = useState<ProjectIconName>('rocket');
  const [projDesc, setProjDesc] = useState('');
  const [projStartDate, setProjStartDate] = useState(() => getDateStr(new Date()));
  const [projTargetDate, setProjTargetDate] = useState('');
  const [projStatus, setProjStatus] = useState<ProjectStatus>('active');

  // Proje Detayı İçi Formlar
  const [projectTaskTitle, setProjectTaskTitle] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [showMilestoneDate, setShowMilestoneDate] = useState(false);

  // Öğrendiklerim Formu & Arama
  const [learningContent, setLearningContent] = useState('');
  const [learningTagsInput, setLearningTagsInput] = useState('');
  const [learningProjectId, setLearningProjectId] = useState<string | null>(null);
  const [learningSearch, setLearningSearch] = useState('');
  const [learningFilterProject, setLearningFilterProject] = useState<string>('all');

  const activeSelectedProjectId = initialProjectId ?? selectedProjectId;
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === activeSelectedProjectId) ?? null,
    [projects, activeSelectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const todayPrefix = getDateStr(new Date());

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    await onAddProject({
      name: projName.trim(),
      color: projColor,
      icon: projIcon,
      description: projDesc.trim() || undefined,
      start_date: projStartDate || null,
      target_date: projTargetDate || null,
      status: projStatus,
      milestones: [],
    });
    setProjName('');
    setProjDesc('');
    setProjTargetDate('');
    setShowNewProjectModal(false);
  };

  const handleAddProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !projectTaskTitle.trim()) return;
    await onAddTask({
      title: projectTaskTitle.trim(),
      note: '',
      priority: 'medium',
      category: 'work',
      project_id: selectedProject.id,
      reminder_time: null,
    });
    setProjectTaskTitle('');
  };

  const handleAddMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !milestoneTitle.trim()) return;
    await onAddMilestone(
      selectedProject.id,
      milestoneTitle.trim(),
      milestoneDate || null
    );
    setMilestoneTitle('');
    setMilestoneDate('');
    setShowMilestoneDate(false);
  };

  const handleAddLearningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learningContent.trim()) return;
    const parsedTags = learningTagsInput
      .split(/[,#\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    await onAddLearning({
      content: learningContent.trim(),
      project_id: learningProjectId,
      tags: Array.from(new Set(parsedTags)),
    });
    setLearningContent('');
    setLearningTagsInput('');
  };

  const filteredLearnings = useMemo(() => {
    return learnings.filter((item) => {
      if (learningFilterProject !== 'all' && item.project_id !== learningFilterProject) {
        return false;
      }
      if (!learningSearch.trim()) return true;
      const q = learningSearch.trim().toLowerCase();
      const inContent = item.content.toLowerCase().includes(q);
      const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
      return inContent || inTags;
    });
  }, [learnings, learningFilterProject, learningSearch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PROJE DETAY EKRANI (Sadeleştirilmiş & Taşmasız)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedProject) {
    const projectTasks = tasks.filter((t) => t.project_id === selectedProject.id);
    const activeProjectTasks = projectTasks.filter((t) => !t.completed);
    const completedProjectTasks = projectTasks.filter((t) => t.completed);

    // Bugünkü proje görevleri
    const completedTodayCount = completedProjectTasks.filter((t) =>
      (t.completed_at ?? t.created_at).startsWith(todayPrefix)
    ).length;
    const todayTotalCount = activeProjectTasks.length + completedTodayCount;

    // Genel ilerleme (Görevler + Kilometre Taşları)
    const totalItems = projectTasks.length + selectedProject.milestones.length;
    const completedItems =
      completedProjectTasks.length +
      selectedProject.milestones.filter((m) => m.completed).length;
    const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Proje bazlı seri & son 7 gün grafik verisi
    const projectStreak = computeProjectStreak(projectTasks);
    const last7Days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const dStr = getDateStr(d);
      const dayLabel = d.toLocaleDateString('tr-TR', { weekday: 'short' });
      const doneCount = completedProjectTasks.filter((t) =>
        (t.completed_at ?? t.created_at).startsWith(dStr)
      ).length;
      return { dStr, dayLabel, doneCount };
    });
    const maxDayDone = Math.max(1, ...last7Days.map((d) => d.doneCount));

    const projectLearnings = learnings.filter((l) => l.project_id === selectedProject.id);

    return (
      <div className="px-4 pb-8 select-none animate-fade-in">
        {/* Üst Bar: Geri Dön & Sade Durum Seçici */}
        <div
          className="flex items-center justify-between gap-2 pb-4"
          style={{
            paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedProjectId(null);
              if (onClearInitialProject) onClearInitialProject();
            }}
            className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl text-xs font-medium text-app-secondary hover:text-app-primary transition-colors active:scale-95 cursor-pointer"
            style={{ background: 'var(--surface)' }}
          >
            <ArrowLeft size={15} />
            <span>Projeler</span>
          </button>

          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center p-0.5 rounded-xl"
              style={{ background: 'var(--surface)' }}
            >
              {(['active', 'on_hold', 'completed'] as const).map((st) => {
                const cfg = PROJECT_STATUS_CONFIG[st];
                const isCur = selectedProject.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void onUpdateProject(selectedProject.id, { status: st })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isCur ? `${cfg.badgeBg} ${cfg.badgeText} font-semibold` : 'text-app-muted hover:text-app-secondary'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                void onDeleteProject(selectedProject.id);
                setSelectedProjectId(null);
                if (onClearInitialProject) onClearInitialProject();
              }}
              aria-label="Projeyi sil"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-app-muted hover:text-red-400 transition-colors active:scale-90 cursor-pointer"
              style={{ background: 'var(--surface)' }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Proje Başlık & Özet Kartı */}
        <div
          className="rounded-2xl p-4 mb-4 relative overflow-hidden"
          style={{
            background: 'var(--surface)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: `${selectedProject.color}1E`,
                  color: selectedProject.color,
                }}
              >
                <ProjectIcon icon={selectedProject.icon} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-app-primary text-lg font-bold leading-snug line-clamp-2">
                  {selectedProject.name}
                </h1>
                {selectedProject.description && (
                  <p className="text-app-secondary text-xs mt-1 leading-relaxed">
                    {selectedProject.description}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: selectedProject.color }}
              >
                %{progressPct}
              </span>
            </div>
          </div>

          {/* İnce İlerleme Çubuğu */}
          <div
            className="w-full h-1.5 rounded-full overflow-hidden mt-3.5"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: selectedProject.color,
              }}
            />
          </div>

          {/* Alt Meta Satırı: Bugün Özeti + Seri + Tarihler */}
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap text-xs text-app-secondary">
            <div className="inline-flex items-center gap-2">
              {todayTotalCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-app-primary font-medium">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>
                    Bugün {completedTodayCount}/{todayTotalCount} tamamlandı
                  </span>
                </span>
              ) : (
                <span className="text-app-muted">
                  {completedItems}/{totalItems} adım tamamlandı
                </span>
              )}

              {projectStreak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-amber-400 font-medium tabular-nums">
                  <Flame size={12} className="fill-amber-400" />
                  <span>{projectStreak}</span>
                </span>
              )}
            </div>

            {(selectedProject.start_date || selectedProject.target_date) && (
              <div className="inline-flex items-center gap-1 text-xs text-app-muted tabular-nums">
                <Calendar size={12} />
                <span>
                  {selectedProject.start_date
                    ? new Date(selectedProject.start_date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : ''}
                  {selectedProject.target_date
                    ? ` → ${new Date(selectedProject.target_date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                      })}`
                    : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Son 7 Günlük Proje Ritmi (Yalnızca tamamlanan görev varsa gösterilir) */}
        {completedProjectTasks.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-app-muted text-xs font-medium uppercase">
                Son 7 Gün
              </p>
              <span className="text-app-secondary text-xs font-medium tabular-nums">
                {completedProjectTasks.length} tamamlanan
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-16">
              {last7Days.map((d) => {
                const barH = d.doneCount > 0 ? Math.max(14, Math.round((d.doneCount / maxDayDone) * 40)) : 4;
                const isToday = d.dStr === todayPrefix;
                return (
                  <div key={d.dStr} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[20px] rounded-md transition-all duration-300"
                      style={{
                        height: `${barH}px`,
                        background:
                          d.doneCount > 0 ? selectedProject.color : 'var(--surface-2)',
                        opacity: isToday ? 1 : 0.75,
                      }}
                    />
                    <span
                      className={`text-xs ${
                        isToday ? 'text-app-primary font-semibold' : 'text-app-muted'
                      }`}
                    >
                      {d.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kilometre Taşları (Sade Satırlar + Taşmayan Form) */}
        <section
          className="rounded-2xl p-4 mb-4"
          style={{ background: 'var(--surface)' }}
          aria-label="Kilometre taşları"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-app-muted text-xs font-medium uppercase flex items-center gap-1.5">
              <Flag size={13} style={{ color: selectedProject.color }} />
              <span>Kilometre Taşları</span>
            </h3>
            <span className="text-app-secondary text-xs font-semibold tabular-nums">
              {selectedProject.milestones.filter((m) => m.completed).length}/
              {selectedProject.milestones.length}
            </span>
          </div>

          {selectedProject.milestones.length > 0 && (
            <div
              className="divide-y mb-3"
              style={{ borderColor: 'var(--border)' }}
            >
              {selectedProject.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => void onToggleMilestone(selectedProject.id, ms.id)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={
                        ms.completed
                          ? { background: 'var(--success)', color: '#ffffff' }
                          : { border: `1.5px solid ${selectedProject.color}` }
                      }
                    >
                      {ms.completed && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span
                      className={`text-sm font-medium truncate ${
                        ms.completed ? 'line-through text-app-muted' : 'text-app-primary'
                      }`}
                    >
                      {ms.title}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {ms.target_date && (
                      <span className="text-xs text-app-muted tabular-nums">
                        {new Date(ms.target_date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => void onDeleteMilestone(selectedProject.id, ms.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted hover:text-red-400 transition-colors cursor-pointer"
                      aria-label="Kilometre taşını sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Taşmasız Kilometre Taşı Ekleme Formu */}
          <form
            onSubmit={(e) => void handleAddMilestoneSubmit(e)}
            className="space-y-2"
          >
            <div
              className="flex items-center gap-1.5 p-1.5 rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
            >
              <input
                type="text"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="Kilometre taşı ekle…"
                maxLength={80}
                className="select-text flex-1 min-w-0 bg-transparent text-xs text-app-primary placeholder-app-muted outline-none px-2 py-1.5"
              />

              <button
                type="button"
                onClick={() => setShowMilestoneDate((v) => !v)}
                aria-label="Hedef tarih seç"
                title="Hedef tarih ekle"
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
                style={{
                  background:
                    showMilestoneDate || milestoneDate ? 'var(--primary-dim)' : 'transparent',
                  color:
                    showMilestoneDate || milestoneDate
                      ? 'var(--primary-light)'
                      : 'var(--text-muted)',
                }}
              >
                <Calendar size={15} />
              </button>

              <button
                type="submit"
                disabled={!milestoneTitle.trim()}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-transform active:scale-95 flex-shrink-0 cursor-pointer"
                style={{ background: selectedProject.color }}
                aria-label="Kilometre taşı ekle"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>

            {showMilestoneDate && (
              <div className="flex items-center justify-between gap-2 px-1 animate-fade-in">
                <label className="text-xs text-app-secondary font-medium">
                  Hedef tarih (isteğe bağlı)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={milestoneDate}
                    onChange={(e) => setMilestoneDate(e.target.value)}
                    aria-label="Hedef tarih"
                    className="text-xs text-app-primary px-2.5 py-1.5 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
                  />
                  {milestoneDate && (
                    <button
                      type="button"
                      onClick={() => setMilestoneDate('')}
                      aria-label="Tarihi temizle"
                      className="p-1.5 rounded-lg text-app-muted hover:text-app-primary cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </section>

        {/* Projeye Hızlı Görev Ekle */}
        <form
          onSubmit={(e) => void handleAddProjectTask(e)}
          className="rounded-2xl p-1.5 pl-3 mb-4 flex items-center gap-2 border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <input
            type="text"
            value={projectTaskTitle}
            onChange={(e) => setProjectTaskTitle(e.target.value)}
            placeholder="Bu projeye görev ekle…"
            maxLength={120}
            className="select-text flex-1 min-w-0 bg-transparent text-sm text-app-primary placeholder-app-muted outline-none py-1.5"
          />
          <button
            type="submit"
            disabled={!projectTaskTitle.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-transform active:scale-95 flex-shrink-0 cursor-pointer"
            style={{ background: selectedProject.color }}
            aria-label="Projeye görev ekle"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </form>

        {/* Proje Görevleri (Bekleyen & Tamamlanan) */}
        <div className="space-y-4">
          <div>
            <p className="text-app-muted text-xs font-medium uppercase mb-2">
              Bekleyen Görevler · {activeProjectTasks.length}
            </p>
            {activeProjectTasks.length > 0 ? (
              <div className="space-y-2">
                {activeProjectTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    project={selectedProject}
                    onToggle={(id) => void onToggleTask(id)}
                    onDelete={(id) => void onDeleteTask(id)}
                    onUpdateSubtasks={(tid, subs) => void onUpdateSubtasks(tid, subs)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-app-muted text-xs py-4 text-center">
                Bu projede bekleyen görev yok.
              </p>
            )}
          </div>

          {completedProjectTasks.length > 0 && (
            <div>
              <p className="text-app-muted text-xs font-medium uppercase mb-2">
                Tamamlanan Görevler · {completedProjectTasks.length}
              </p>
              <div className="space-y-2">
                {completedProjectTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    project={selectedProject}
                    onToggle={(id) => void onToggleTask(id)}
                    onDelete={(id) => void onDeleteTask(id)}
                    onUpdateSubtasks={(tid, subs) => void onUpdateSubtasks(tid, subs)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bu Projeye Ait Öğrenme Notları */}
          {projectLearnings.length > 0 && (
            <div className="pt-2">
              <p className="text-app-muted text-xs font-medium uppercase mb-2 flex items-center gap-1.5">
                <BookOpen size={12} className="text-indigo-400" />
                <span>Öğrenme Notları · {projectLearnings.length}</span>
              </p>
              <div className="space-y-2">
                {projectLearnings.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-2xl p-3.5"
                    style={{ background: 'var(--surface)' }}
                  >
                    <p className="text-app-primary text-xs leading-relaxed">{l.content}</p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {l.tags.map((tg) => (
                          <span
                            key={tg}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/12 text-indigo-300"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-app-muted">{l.learned_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ANA PROJELER & ÖĞRENDİKLERİM EKRANI
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="px-5 pb-8 select-none animate-fade-in">
      {/* Üst Başlık */}
      <div
        className="pb-4 flex items-center justify-between gap-3"
        style={{
          paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))',
        }}
      >
        <div>
          <p className="text-app-muted text-[11px] font-semibold uppercase tracking-[0.14em]">
            Üretkenlik & Gelişim
          </p>
          <div className="flex items-center gap-2.5 mt-1">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-dim)' }}
            >
              {subView === 'projects' ? (
                <FolderKanban size={16} className="text-indigo-400" />
              ) : subView === 'routines' ? (
                <Repeat size={16} className="text-amber-400" />
              ) : (
                <BookOpen size={16} className="text-emerald-400" />
              )}
            </div>
            <h1 className="text-app-primary text-2xl font-bold tracking-tight">
              {subView === 'projects'
                ? 'Projeler'
                : subView === 'routines'
                  ? 'Rutinler'
                  : 'Öğrendiklerim'}
            </h1>
          </div>
        </div>

        {subView === 'projects' && (
          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            style={{
              background: 'var(--primary)',
              boxShadow: '0 6px 20px var(--primary-glow)',
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Yeni Proje</span>
          </button>
        )}
      </div>

      {/* Alt Sekme Geçişi: Projeler / Rutinler / Öğrendiklerim */}
      <div
        className="grid grid-cols-3 p-1 rounded-2xl border mb-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setSubView('projects')}
          className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            subView === 'projects' ? 'text-white shadow-sm' : 'text-app-secondary'
          }`}
          style={
            subView === 'projects'
              ? { background: 'var(--primary)' }
              : { background: 'transparent' }
          }
        >
          <FolderKanban size={13} />
          <span>Projeler ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('routines')}
          className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            subView === 'routines' ? 'text-white shadow-sm' : 'text-app-secondary'
          }`}
          style={
            subView === 'routines'
              ? { background: 'var(--primary)' }
              : { background: 'transparent' }
          }
        >
          <Repeat size={13} />
          <span>Rutinler ({routines.filter((r) => r.status !== 'archived').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('learnings')}
          className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            subView === 'learnings' ? 'text-white shadow-sm' : 'text-app-secondary'
          }`}
          style={
            subView === 'learnings'
              ? { background: 'var(--primary)' }
              : { background: 'transparent' }
          }
        >
          <BookOpen size={13} />
          <span>Öğrendiklerim ({learnings.length})</span>
        </button>
      </div>

      {/* ─── RUTİNLER YÖNETİMİ & DETAY GÖRÜNÜMÜ ─── */}
      {subView === 'routines' && onAddRoutine && onUpdateRoutine && onSetRoutineStatus && (
        <RoutinesManagerView
          routines={routines}
          projects={projects}
          routineStatsMap={routineStatsMap}
          initialRoutineId={initialRoutineId}
          onClearInitialRoutine={onClearInitialRoutine}
          onAddRoutine={onAddRoutine}
          onUpdateRoutine={onUpdateRoutine}
          onSetRoutineStatus={onSetRoutineStatus}
        />
      )}

      {/* ─── PROJELER LİSTESİ GÖRÜNÜMÜ ─── */}
      {subView === 'projects' && (
        <div>
          {/* Durum Filtre Çipleri */}
          <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'all', label: 'Tümü' },
                { id: 'active', label: 'Aktif' },
                { id: 'on_hold', label: 'Beklemede' },
                { id: 'completed', label: 'Tamamlandı' },
              ] as const
            ).map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={
                    active
                      ? {
                          background: 'var(--primary-dim)',
                          color: 'var(--primary-light)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                        }
                      : {
                          background: 'var(--surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredProjects.length > 0 ? (
            <div className="space-y-3">
              {filteredProjects.map((project) => {
                const statusCfg = PROJECT_STATUS_CONFIG[project.status];
                const pTasks = tasks.filter((t) => t.project_id === project.id);
                const pActive = pTasks.filter((t) => !t.completed);
                const pDone = pTasks.filter((t) => t.completed);
                const doneToday = pDone.filter((t) =>
                  (t.completed_at ?? t.created_at).startsWith(todayPrefix)
                ).length;
                const todayTotal = pActive.length + doneToday;

                const totalUnits = pTasks.length + project.milestones.length;
                const doneUnits =
                  pDone.length + project.milestones.filter((m) => m.completed).length;
                const pct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

                return (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="rounded-2xl p-4 border transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border-strong)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `${project.color}20`,
                            color: project.color,
                            border: `1px solid ${project.color}38`,
                          }}
                        >
                          <ProjectIcon icon={project.icon} size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-app-primary text-sm font-bold truncate">
                              {project.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                            >
                              {statusCfg.label}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-app-muted text-xs truncate mt-0.5">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className="text-sm font-extrabold tabular-nums flex-shrink-0"
                        style={{ color: project.color }}
                      >
                        %{pct}
                      </span>
                    </div>

                    {/* İlerleme Çubuğu */}
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden mt-3 mb-2.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: project.color }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-app-secondary">
                      <span>
                        {todayTotal > 0
                          ? `Bugün ${todayTotal}'ün ${doneToday}'si yapıldı`
                          : `${pDone.length}/${pTasks.length} görev tamamlandı`}
                      </span>
                      {project.target_date && (
                        <span className="inline-flex items-center gap-1 text-app-muted">
                          <Target size={11} />
                          <span>
                            Hedef:{' '}
                            {new Date(project.target_date).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-3xl p-8 border text-center my-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--primary-dim)' }}
              >
                <Layers size={24} className="text-indigo-400" />
              </div>
              <h3 className="text-app-primary font-bold text-sm">Henüz proje eklenmedi</h3>
              <p className="text-app-secondary text-xs mt-1 max-w-xs mx-auto">
                Hedeflerini projelere bölerek kilometre taşlarını, alt görevleri ve günlük ilerlemeni takip et. Sağ üstteki Yeni Proje butonuyla başlayabilirsin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── ÖĞRENDİKLERİM ("BUGÜN NE ÖĞRENDİM?") GÖRÜNÜMÜ ─── */}
      {subView === 'learnings' && (
        <div className="space-y-4">
          {/* Yeni Öğrenme Notu Formu */}
          <form
            onSubmit={(e) => void handleAddLearningSubmit(e)}
            className="rounded-2xl p-4 border space-y-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)' }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Sparkles size={13} />
              <span>Bugün ne öğrendim?</span>
            </div>

            <textarea
              value={learningContent}
              onChange={(e) => setLearningContent(e.target.value)}
              placeholder="Yeni bir kavram, teknik ipucu veya önemli bir çıkarım not et…"
              rows={2}
              maxLength={500}
              className="select-text w-full bg-transparent text-xs sm:text-sm text-app-primary placeholder-app-muted outline-none resize-none leading-relaxed"
            />

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-app">
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                <Tag size={12} className="text-app-muted flex-shrink-0" />
                <input
                  type="text"
                  value={learningTagsInput}
                  onChange={(e) => setLearningTagsInput(e.target.value)}
                  placeholder="Etiketler (örn: react, sql, tasarım)"
                  maxLength={80}
                  className="select-text flex-1 bg-transparent text-xs text-app-secondary placeholder-app-muted outline-none"
                />
              </div>

              {projects.length > 0 && (
                <select
                  value={learningProjectId ?? ''}
                  onChange={(e) => setLearningProjectId(e.target.value || null)}
                  aria-label="Projeye bağla"
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <option value="">Projesiz</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                disabled={!learningContent.trim()}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all active:scale-95"
                style={{ background: 'var(--primary)' }}
              >
                Kaydet
              </button>
            </div>
          </form>

          {/* Arama & Proje Filtresi */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Search size={13} className="text-app-muted flex-shrink-0" />
              <input
                type="text"
                value={learningSearch}
                onChange={(e) => setLearningSearch(e.target.value)}
                placeholder="Notlarda veya #etiketlerde ara…"
                className="select-text flex-1 bg-transparent text-xs text-app-primary placeholder-app-muted outline-none"
              />
              {learningSearch && (
                <button
                  type="button"
                  onClick={() => setLearningSearch('')}
                  className="text-app-muted hover:text-app-primary"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {projects.length > 0 && (
              <select
                value={learningFilterProject}
                onChange={(e) => setLearningFilterProject(e.target.value)}
                aria-label="Proje filtresi"
                className="text-xs font-semibold px-3 py-2 rounded-xl border outline-none"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option value="all">Tüm Projeler</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Öğrenme Notları Listesi */}
          {filteredLearnings.length > 0 ? (
            <div className="space-y-2.5">
              {filteredLearnings.map((item) => {
                const linkedProj = projects.find((p) => p.id === item.project_id);
                const formattedDate = new Date(item.learned_date).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl p-4 border transition-all"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-app-primary text-xs sm:text-sm leading-relaxed whitespace-pre-wrap flex-1">
                        {item.content}
                      </p>
                      <button
                        type="button"
                        onClick={() => void onDeleteLearning(item.id)}
                        className="text-app-muted hover:text-red-400 p-1 flex-shrink-0"
                        aria-label="Öğrenme notunu sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-app flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {linkedProj && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              background: `${linkedProj.color}18`,
                              color: linkedProj.color,
                              border: `1px solid ${linkedProj.color}38`,
                            }}
                          >
                            <FolderKanban size={9} />
                            <span>{linkedProj.name}</span>
                          </span>
                        )}
                        {item.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setLearningSearch(tag)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/12 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>

                      <span className="text-[10px] text-app-muted font-medium">
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-3xl p-8 border text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <BookOpen size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-app-primary text-sm font-bold">Öğrenme günlüğün boş</p>
              <p className="text-app-secondary text-xs mt-1">
                Her gün öğrendiğin küçük bir bilgiyi buraya ekleyerek kişisel bilgi hazineni oluştur.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── YENİ PROJE OLUŞTURMA MODALI (Portal ile tam ekran üst katman) ─── */}
      {showNewProjectModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: 'var(--overlay)' }}
              onClick={() => setShowNewProjectModal(false)}
            />
            <div
              className="relative w-full max-w-md max-h-[86dvh] overflow-y-auto border rounded-3xl pt-5 px-5 animate-scale-in shadow-2xl z-10"
              style={{
                background: 'var(--sheet-bg)',
                borderColor: 'var(--border-strong)',
                paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase tracking-widest">
                    Yeni Hedef
                  </p>
                  <h2 className="text-app-primary text-lg font-bold">Proje Oluştur</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  aria-label="Modalı kapat"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-colors"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={(e) => void handleCreateProject(e)} className="space-y-3.5">
                <input
                  type="text"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="Proje adı (örn. Mobil Uygulama Lansmanı)"
                  maxLength={80}
                  autoFocus
                  required
                  className="select-text input-base"
                />

                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Kısa açıklama veya proje amacı (isteğe bağlı)"
                  rows={2}
                  maxLength={240}
                  className="select-text input-base resize-none"
                />

                {/* Renk Seçimi */}
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Proje Rengi
                  </p>
                  <div className="flex items-center gap-2">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setProjColor(c.hex)}
                        aria-label={c.label}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform active:scale-90"
                        style={{
                          background: c.hex,
                          boxShadow:
                            projColor === c.hex
                              ? `0 0 0 2px var(--sheet-bg), 0 0 0 4px ${c.hex}`
                              : 'none',
                        }}
                      >
                        {projColor === c.hex && <Check size={14} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* İkon Seçimi */}
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    İkon
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ICON_OPTIONS.map((opt) => {
                      const active = projIcon === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setProjIcon(opt.id)}
                          className="py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all active:scale-95"
                          style={
                            active
                              ? {
                                  background: `${projColor}22`,
                                  color: projColor,
                                  border: `1px solid ${projColor}`,
                                }
                              : {
                                  background: 'var(--surface)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border)',
                                }
                          }
                        >
                          <ProjectIcon icon={opt.id} size={13} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Başlangıç & Hedef Tarih */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-app-muted text-[10px] font-bold uppercase tracking-wider block mb-1">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={projStartDate}
                      onChange={(e) => setProjStartDate(e.target.value)}
                      className="input-base !py-2 !text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-app-muted text-[10px] font-bold uppercase tracking-wider block mb-1">
                      Hedef Tarih
                    </label>
                    <input
                      type="date"
                      value={projTargetDate}
                      onChange={(e) => setProjTargetDate(e.target.value)}
                      className="input-base !py-2 !text-xs"
                    />
                  </div>
                </div>

                {/* Durum */}
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Durum
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['active', 'on_hold', 'completed'] as const).map((st) => {
                      const cfg = PROJECT_STATUS_CONFIG[st];
                      const active = projStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setProjStatus(st)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all ${
                            active ? `${cfg.badgeBg} ${cfg.badgeText}` : 'text-app-muted'
                          }`}
                          style={{
                            background: active ? undefined : 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!projName.trim()}
                  className="btn-primary w-full py-3.5"
                >
                  <Plus size={16} />
                  <span>Projeyi Kaydet</span>
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
