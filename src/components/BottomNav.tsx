import { ListTodo, FolderKanban, CheckCircle2, BarChart3 } from 'lucide-react';
import type { Tab } from '../types';

type BottomNavProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasActiveTasks?: boolean;
};

type TabItem = {
  id: Tab;
  label: string;
  Icon: React.ElementType;
};

const TABS: TabItem[] = [
  { id: 'tasks', label: 'Görevler', Icon: ListTodo },
  { id: 'projects', label: 'Projeler', Icon: FolderKanban },
  { id: 'completed', label: 'Tamamlanan', Icon: CheckCircle2 },
  { id: 'stats', label: 'İstatistik', Icon: BarChart3 },
];

export function BottomNav({
  activeTab,
  onTabChange,
  hasActiveTasks = false,
}: BottomNavProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-4 pointer-events-none select-none z-20"
      style={{
        paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <nav
        aria-label="Alt navigasyon"
        className="pointer-events-auto mx-auto max-w-sm rounded-2xl glass-nav px-2 py-1.5 shadow-xl transition-colors duration-200"
      >
        <div className="flex items-center justify-around">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            const showDot = id === 'tasks' && hasActiveTasks && !isActive;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className="flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors duration-150 active:scale-95 relative cursor-pointer"
              >
                {isActive && (
                  <div
                    className="absolute inset-x-1.5 inset-y-0.5 rounded-xl"
                    style={{
                      background: 'var(--primary-dim)',
                    }}
                  />
                )}

                <div className="relative z-10 flex items-center justify-center">
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.75}
                    className={isActive ? 'text-indigo-400' : 'text-app-secondary'}
                    aria-hidden="true"
                  />

                  {showDot && (
                    <span
                      className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                  )}
                </div>

                <span
                  className={`text-xs font-semibold tracking-tight z-10 ${
                    isActive ? 'text-app-primary' : 'text-app-secondary'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
