import {
  Folder,
  Rocket,
  Code2,
  BookOpen,
  Target,
  Briefcase,
  Sparkles,
  Layers,
  Check,
  ChevronRight,
} from 'lucide-react';
import type { Project, ProjectIconName, Task } from '../types';

type TodayProjectsStripProps = {
  projects: Project[];
  tasks: Task[];
  onOpenProjectDetail: (projectId: string) => void;
};

export function ProjectIcon({
  icon,
  size = 16,
}: {
  icon: ProjectIconName;
  size?: number;
}) {
  switch (icon) {
    case 'rocket':
      return <Rocket size={size} />;
    case 'code':
      return <Code2 size={size} />;
    case 'book':
      return <BookOpen size={size} />;
    case 'target':
      return <Target size={size} />;
    case 'briefcase':
      return <Briefcase size={size} />;
    case 'sparkles':
      return <Sparkles size={size} />;
    case 'layers':
      return <Layers size={size} />;
    default:
      return <Folder size={size} />;
  }
}

function getTodayDatePrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function TodayProjectsStrip({
  projects,
  tasks,
  onOpenProjectDetail,
}: TodayProjectsStripProps) {
  const activeProjects = projects.filter((p) => p.status === 'active');
  if (activeProjects.length === 0) return null;

  const todayPrefix = getTodayDatePrefix();

  return (
    <section className="px-4 mb-3 select-none" aria-label="Aktif projeler">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {activeProjects.map((project) => {
          const projectTasks = tasks.filter((t) => t.project_id === project.id);
          const activeProjectTasks = projectTasks.filter((t) => !t.completed);
          const completedToday = projectTasks.filter(
            (t) => t.completed && (t.completed_at ?? t.created_at).startsWith(todayPrefix)
          );
          const todayTotal = activeProjectTasks.length + completedToday.length;
          const isAllTodayDone = todayTotal > 0 && activeProjectTasks.length === 0;

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpenProjectDetail(project.id)}
              title={`${project.name} proje detayını aç`}
              className="min-h-[40px] max-w-[216px] px-3 py-2 rounded-xl flex items-center gap-2 transition-colors duration-150 active:scale-[0.98] flex-shrink-0 cursor-pointer hover:bg-surface-hover"
              style={{
                background: 'var(--surface)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: project.color }}
                aria-hidden="true"
              />
              <span className="text-app-primary text-xs font-medium truncate">
                {project.name}
              </span>

              {isAllTodayDone ? (
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check size={10} strokeWidth={3} />
                </span>
              ) : todayTotal > 0 ? (
                <span className="text-app-muted text-xs font-medium tabular-nums flex-shrink-0">
                  {completedToday.length}/{todayTotal}
                </span>
              ) : (
                <ChevronRight
                  size={13}
                  className="text-app-muted flex-shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
