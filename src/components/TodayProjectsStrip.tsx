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
    <div className="px-4 mb-2 select-none">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
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
              className="min-w-[116px] max-w-[144px] min-h-[38px] px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 transition-colors duration-150 active:scale-95 flex-shrink-0 cursor-pointer"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: project.color }}
                />
                <span className="text-app-primary text-xs font-semibold truncate">
                  {project.name}
                </span>
              </span>

              {isAllTodayDone ? (
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check size={10} strokeWidth={3} />
                </span>
              ) : todayTotal > 0 ? (
                <span className="text-app-secondary text-xs font-medium tabular-nums flex-shrink-0">
                  {completedToday.length}/{todayTotal}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
