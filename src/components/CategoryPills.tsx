import type { FilterCategory } from '../types';
import { Briefcase, User, Flame, Layers } from 'lucide-react';

type CategoryPillsProps = {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
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

export function CategoryPills({ selected, onSelect }: CategoryPillsProps) {
  return (
    <div className="px-4 mb-2.5 overflow-x-auto scrollbar-none select-none">
      <div className="flex items-center gap-1.5 min-w-max">
        {PILLS.map(({ id, label, Icon, dotColor }) => {
          const isActive = selected === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold
                transition-colors duration-150 active:scale-95 cursor-pointer
                ${isActive ? 'text-white' : 'text-app-secondary hover:text-app-primary'}
              `}
              style={
                isActive
                  ? {
                      background: 'var(--primary)',
                    }
                  : {
                      background: 'transparent',
                    }
              }
            >
              {dotColor && !isActive ? (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: dotColor }}
                />
              ) : (
                <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
              )}

              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
