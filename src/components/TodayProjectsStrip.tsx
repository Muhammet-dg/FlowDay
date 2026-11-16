import {
  Folder,
  Rocket,
  Code2,
  BookOpen,
  Target,
  Briefcase,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { FilterCategory, Project, ProjectIconName, Task } from '../types';

type TodayProjectsStripProps = {
  projects: Project[];
  tasks: Task[];
  selectedCategory: FilterCategory;
  onSelectProjectFilter: (filter: FilterCategory) => void;
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
  selectedCategory,
  onSelectProjectFilter,
  onOpenProjectDetail,
}: TodayProjectsStripProps) {
  const activeProjects = projects.filter((p) => p.status === 'active');
  if (activeProjects.length === 0) return null;

  const todayPrefix = getTodayDatePrefix();

  return (
    <div className="px-5 mb-3.5 select-none">
      <div className="flex items-center justify-between mb-2">
        <p className="text-app-muted text-[10px] font-bold uppercase tracking-[0.12em]">
          Bugünkü Projelerim
        </p>
        <span className="text-app-faint text-[10px] font-medium">
          {activeProjects.length} aktif
        </span>
      </div>

      <div className="flex items-stretch gap-2.5 overflow-x-auto scrollbar-none pb-0.5">
        {activeProjects.map((project) => {
          const projectTasks = tasks.filter((t) => t.project_id === project.id);
          const activeProjectTasks = projectTasks.filter((t) => !t.completed);
          const completedToday = projectTasks.filter(
            (t) => t.completed && (t.completed_at ?? t.created_at).startsWith(todayPrefix)
          );
          const todayTotal = activeProjectTasks.length + completedToday.length;
          const isAllTodayDone = todayTotal > 0 && activeProjectTasks.length === 0;
          const totalPct =
            projectTasks.length > 0
              ? Math.round(
                  (projectTasks.filter((t) => t.completed).length / projectTasks.length) * 100
                )
              : 0;

          const filterId: FilterCategory = `project:${project.id}`;
          const isFiltered = selectedCategory === filterId;

          return (
            <div
              key={project.id}
              className="min-w-[162px] max-w-[185px] rounded-2xl p-3 border transition-all duration-200 flex flex-col justify-between gap-2 flex-shrink-0"
              style={{
                background: isFiltered ? `${project.color}16` : 'var(--surface)',
                borderColor: isFiltered ? project.color : 'var(--border)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSelectProjectFilter(isFiltered ? 'all' : filterId)
                  }
                  className="flex items-center gap-2 min-w-0 text-left flex-1 active:scale-95 transition-transform"
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${project.color}20`,
                      color: project.color,
                    }}
                  >
                    <ProjectIcon icon={project.icon} size={14} />
                  </div>
                  <p className="text-app-primary text-xs font-bold truncate">
                    {project.name}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenProjectDetail(project.id)}
                  aria-label={`${project.name} proje detayını aç`}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-app-muted hover:text-app-primary transition-colors active:scale-90 flex-shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <ChevronRight size={12} />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-semibold mb-1.5">
                  {isAllTodayDone ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={10} />
                      <span>Bugün tamam ({completedToday.length}/{todayTotal})</span>
                    </span>
                  ) : todayTotal > 0 ? (
                    <span className="inline-flex items-center gap-1 text-app-secondary">
                      <Clock size={10} style={{ color: project.color }} />
                      <span>
                        {completedToday.length}/{todayTotal} yapıldı · {activeProjectTasks.length} bekliyor
                      </span>
                    </span>
                  ) : (
                    <span className="text-app-muted">Görev bekliyor</span>
                  )}
                </div>

                {/* İnce İlerleme Çubuğu */}
                <div
                  className="w-full h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${totalPct}%`,
                      background: isAllTodayDone ? '#10B981' : project.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
