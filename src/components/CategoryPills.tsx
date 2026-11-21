import type { FilterCategory } from '../types';

type CategoryPillsProps = {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
};

const PILLS: Array<{
  id: 'all' | 'work' | 'personal' | 'urgent';
  label: string;
  dotColor?: string;
}> = [
  { id: 'all', label: 'Tümü' },
  { id: 'work', label: 'İş / Proje', dotColor: '#818CF8' },
  { id: 'personal', label: 'Kişisel', dotColor: '#34D399' },
  { id: 'urgent', label: 'Acil', dotColor: '#F87171' },
];

export function CategoryPills({ selected, onSelect }: CategoryPillsProps) {
  return (
    <div
      className="px-4 mb-3 overflow-x-auto scrollbar-none select-none"
      role="tablist"
      aria-label="Kategori filtresi"
    >
      <div className="flex items-center gap-1 min-w-max">
        {PILLS.map(({ id, label, dotColor }) => {
          const isActive = selected === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(id)}
              className="min-h-[44px] py-1.5 flex items-center cursor-pointer active:scale-95 transition-transform duration-150"
            >
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-app-secondary hover:text-app-primary'
                }`}
                style={
                  isActive
                    ? { background: 'var(--primary)' }
                    : { background: 'transparent' }
                }
              >
                {dotColor && !isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: dotColor }}
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
