import { Plus } from 'lucide-react';

type EmptyStateProps = {
  type: 'active' | 'completed';
  filteredCategoryName?: string;
};

export function EmptyState({ type, filteredCategoryName }: EmptyStateProps) {
  if (type === 'active') {
    const focusCaptureInput = () => {
      const el = document.getElementById('quick-capture-input') as HTMLInputElement | null;
      el?.focus();
    };

    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center select-none animate-fade-in">
        <p className="text-app-primary font-semibold text-sm mb-1">
          {filteredCategoryName
            ? `${filteredCategoryName} kategorisinde görev yok`
            : 'Bugün için bekleyen görev yok'}
        </p>
        <p className="text-app-secondary text-xs mb-4">
          Yeni bir görev ekleyerek gününü planla.
        </p>
        <button
          type="button"
          onClick={focusCaptureInput}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-white transition-transform duration-150 active:scale-95 cursor-pointer"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          <span>Görev ekle</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center select-none animate-fade-in">
      <p className="text-app-primary font-semibold text-sm mb-1">
        Henüz tamamlanan görev yok
      </p>
      <p className="text-app-secondary text-xs">
        Tamamladığın görevler burada listelenir.
      </p>
    </div>
  );
}
