type EmptyStateProps = {
  type: 'active' | 'completed';
  filteredCategoryName?: string;
};

export function EmptyState({ type, filteredCategoryName }: EmptyStateProps) {
  if (type === 'active') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center select-none animate-fade-in">
        <p className="text-app-secondary font-medium text-sm">
          {filteredCategoryName
            ? `${filteredCategoryName} kategorisinde görev yok`
            : 'Bugün için bekleyen görev yok'}
        </p>
        <p className="text-app-muted text-xs mt-1">
          Yukarıdaki alandan hızlıca yeni görev ekleyebilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center select-none animate-fade-in">
      <p className="text-app-secondary font-medium text-sm">
        Henüz tamamlanan görev yok
      </p>
      <p className="text-app-muted text-xs mt-1">
        Tamamladığın görevler burada listelenir.
      </p>
    </div>
  );
}
