import type { FilterCategory, Project, Task } from '../types';
import { Briefcase, User, Flame, Layers, FolderKanban } from 'lucide-react';

type CategoryPillsProps = {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
  tasks: Task[];
  projects?: Project[];
};

const PILLS: Array<{
  id: 'all' | 'work' | 'personal' | 'urgent';
  label: string;
  Icon: React.ElementType;
  dotColor?: string;
}> = [
  { id: 'all', label: 'Tümü', Icon: Layers },
  { id: 'work', label: 'İş / Proje', Icon: Briefcase, dotColor: '#818CF8' },
  { id: 'personal', label: 'Kişisel', Icon: User, dotColor: '#34D399' },
  { id: 'urgent', label: 'Acil', Icon: Flame, dotColor: '#F87171' },
];

export function CategoryPills({
  selected,
  onSelect,
  tasks,
  projects = [],
}: CategoryPillsProps) {
  const getCount = (cat: FilterCategory): number => {
    if (cat === 'all') return tasks.length;
    if (cat.startsWith('project:')) {
      const pid = cat.replace('project:', '');
      return tasks.filter((t) => t.project_id === pid).length;
    }
    if (cat === 'urgent') {
      return tasks.filter((t) => t.category === 'urgent' || t.priority === 'high').length;
    }
    return tasks.filter((t) => (t.category ?? 'personal') === cat).length;
  };

  const activeProjects = projects.filter((p) => p.status !== 'completed');

  return (
    <div className="px-5 mb-3 overflow-x-auto scrollbar-none select-none">
      <div className="flex items-center gap-2 min-w-max">
        {PILLS.map(({ id, label, Icon, dotColor }) => {
          const isActive = selected === id;
          const count = getCount(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold
                transition-all duration-200 active:scale-95
                ${isActive ? 'text-white shadow-sm' : 'text-app-secondary hover:text-app-primary'}
              `}
              style={
                isActive
                  ? {
                      background: 'var(--primary)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow: '0 4px 14px var(--primary-glow)',
                    }
                  : {
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }
              }
            >
              {dotColor && !isActive ? (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: dotColor }}
                />
              ) : (
                <Icon size={12} strokeWidth={2.2} />
              )}

              <span>{label}</span>

              <span
                className="ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md leading-tight"
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.20)' : 'var(--surface-2)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Proje Filtre Çipleri */}
        {activeProjects.map((proj) => {
          const filterId: FilterCategory = `project:${proj.id}`;
          const isActive = selected === filterId;
          const count = getCount(filterId);

          return (
            <button
              key={proj.id}
              type="button"
              onClick={() => onSelect(filterId)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold
                transition-all duration-200 active:scale-95
                ${isActive ? 'text-white shadow-sm' : 'text-app-secondary hover:text-app-primary'}
              `}
              style={
                isActive
                  ? {
                      background: proj.color,
                      border: '1px solid rgba(255, 255, 255, 0.20)',
                      boxShadow: `0 4px 14px ${proj.color}50`,
                    }
                  : {
                      background: 'var(--surface)',
                      border: `1px solid ${proj.color}35`,
                    }
              }
            >
              {!isActive ? (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: proj.color }}
                />
              ) : (
                <FolderKanban size={12} strokeWidth={2.2} />
              )}

              <span className="max-w-[110px] truncate">{proj.name}</span>

              <span
                className="ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md leading-tight"
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'var(--surface-2)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
