import { RotateCcw, Trash2, X } from 'lucide-react';

type UndoToastProps = {
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoToast({ taskTitle, onUndo, onDismiss }: UndoToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm select-none animate-slide-up"
    >
      <div
        className="relative rounded-2xl px-3.5 py-2.5 border shadow-2xl overflow-hidden flex items-center gap-2.5"
        style={{
          background: 'var(--sheet-bg)',
          borderColor: 'var(--border-strong)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
        }}
      >
        {/* 5 Saniyelik Geri Sayım Çubuğu */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 animate-toast-countdown"
          style={{
            background: 'linear-gradient(90deg, #6366F1, #10B981)',
          }}
        />

        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(239, 68, 68, 0.14)',
            color: '#F87171',
          }}
        >
          <Trash2 size={13} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-app-primary text-xs font-semibold truncate">
            “{taskTitle}” silindi
          </p>
        </div>

        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-300 transition-all active:scale-95 flex-shrink-0 cursor-pointer"
          style={{
            background: 'var(--primary-dim)',
            border: '1px solid rgba(99, 102, 241, 0.30)',
          }}
        >
          <RotateCcw size={12} />
          <span>Geri Al</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Bildirimi kapat"
          className="w-6 h-6 rounded-lg flex items-center justify-center text-app-muted hover:text-app-primary transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
