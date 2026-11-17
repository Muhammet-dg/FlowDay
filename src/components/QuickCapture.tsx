import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Clock,
  Sparkles,
  X,
  FolderKanban,
  Flag,
} from 'lucide-react';
import type { Category, Priority, Project, TaskFormData } from '../types';
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from '../types';

type QuickCaptureProps = {
  onAdd: (data: TaskFormData) => void;
  defaultCategory?: Category;
  defaultProjectId?: string | null;
  projects?: Project[];
};

type ParsedTimeResult = {
  cleanTitle: string;
  hour: number;
  minute: number;
  isTomorrow: boolean;
  label: string;
  matchedText: string;
} | null;

/**
 * Doğal dilde saat algılama:
 * Örn: "Rapor yaz 15:00", "Yarın 09:30 ekip toplantısı", "Su iç 14.30"
 */
function parseNaturalTime(input: string): ParsedTimeResult {
  const regex = /(?:(yarın|yarin)\s+)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i;
  const match = input.match(regex);
  if (!match) return null;

  const isTomorrow = Boolean(match[1]);
  const hour = parseInt(match[2], 10);
  const minute = parseInt(match[3], 10);
  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const label = isTomorrow ? `Yarın ${formattedTime}` : formattedTime;

  const cleanTitle = input.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();

  return {
    cleanTitle: cleanTitle || input.trim(),
    hour,
    minute,
    isTomorrow,
    label,
    matchedText: match[0],
  };
}

const CATEGORIES: Category[] = ['personal', 'work', 'urgent'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export function QuickCapture({
  onAdd,
  defaultCategory = 'personal',
  defaultProjectId = null,
  projects = [],
}: QuickCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(defaultCategory);
  const [selectedPriority, setSelectedPriority] = useState<Priority>(
    defaultCategory === 'urgent' ? 'high' : 'medium'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId);
  const [showTimePresets, setShowTimePresets] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [customTimeValue, setCustomTimeValue] = useState('');
  const [manualTime, setManualTime] = useState<{ label: string; iso: string } | null>(null);
  const [ignoreAutoTime, setIgnoreAutoTime] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedCategory(defaultCategory);
    setSelectedPriority(defaultCategory === 'urgent' ? 'high' : 'medium');
  }, [defaultCategory]);

  useEffect(() => {
    setSelectedProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const detectedTime = useMemo(() => {
    if (ignoreAutoTime || manualTime) return null;
    return parseNaturalTime(text);
  }, [text, ignoreAutoTime, manualTime]);

  const applyPreset = (type: '1h' | '15:00' | '18:00' | '21:00' | 'tomorrow9') => {
    const now = new Date();
    const target = new Date(now);
    let label = '';

    if (type === '1h') {
      target.setHours(target.getHours() + 1);
      label = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
    } else if (type === '15:00') {
      target.setHours(15, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      label = '15:00';
    } else if (type === '18:00') {
      target.setHours(18, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      label = '18:00';
    } else if (type === '21:00') {
      target.setHours(21, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      label = '21:00';
    } else if (type === 'tomorrow9') {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      label = 'Yarın 09:00';
    }

    setManualTime({ label, iso: target.toISOString() });
    setShowTimePresets(false);
    inputRef.current?.focus();
  };

  const applyCustomTime = (val: string) => {
    setCustomTimeValue(val);
    const match = val.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return;
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      0,
      0
    );
    const isTomorrow = target <= now;
    if (isTomorrow) target.setDate(target.getDate() + 1);
    setManualTime({
      label: isTomorrow ? `Yarın ${val}` : val,
      iso: target.toISOString(),
    });
    setShowTimePresets(false);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowTimePresets(false);
    setShowProjectPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      inputRef.current?.focus();
      return;
    }

    let finalTitle = text.trim();
    let reminderIso: string | null = null;

    if (manualTime) {
      reminderIso = manualTime.iso;
    } else if (detectedTime) {
      finalTitle = detectedTime.cleanTitle;
      const now = new Date();
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        detectedTime.hour,
        detectedTime.minute,
        0,
        0
      );
      if (detectedTime.isTomorrow || target <= now) {
        target.setDate(target.getDate() + 1);
      }
      reminderIso = target.toISOString();
    }

    onAdd({
      title: finalTitle,
      note: '',
      priority: selectedPriority,
      category: selectedCategory,
      project_id: selectedProjectId,
      reminder_time: reminderIso,
    });

    setText('');
    setManualTime(null);
    setCustomTimeValue('');
    setIgnoreAutoTime(false);
    setShowTimePresets(false);
    setShowProjectPicker(false);
    setIsOpen(false);
  };

  const activeTimeLabel = manualTime?.label ?? detectedTime?.label ?? null;
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  return (
    <>
      {/* ─── Köşe Tetikleyici Buton (+ Yeni Görev) ─── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Yeni görev ekle"
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-95 flex-shrink-0 cursor-pointer select-none"
        style={{
          background: 'var(--primary)',
          boxShadow: '0 6px 20px var(--primary-glow)',
        }}
      >
        <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
        <span>Yeni Görev</span>
      </button>

      {/* ─── Ortalanmış Görev Ekleme Modalı ─── */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-modal-title"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: 'var(--overlay)' }}
              onClick={handleClose}
            />

            {/* Modal Kartı */}
            <div
              className="relative w-full max-w-md max-h-[86dvh] overflow-y-auto border rounded-3xl pt-5 px-5 animate-scale-in shadow-2xl z-10"
              style={{
                background: 'var(--sheet-bg)',
                borderColor: 'var(--border-strong)',
                paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Başlık */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-app-muted text-[10px] font-bold uppercase tracking-widest">
                    Hızlı Ekle
                  </p>
                  <h2
                    id="quick-capture-modal-title"
                    className="text-app-primary text-lg font-bold tracking-tight"
                  >
                    Yeni Görev
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Modalı kapat"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-app-secondary hover:text-app-primary transition-colors active:scale-90"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* ─── Sade Tek Satırlık Görev Girişi + Doğal Saat Rozeti ─── */}
                <div
                  className="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: text.trim() ? 'var(--border-focus)' : 'var(--border-strong)',
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (ignoreAutoTime) setIgnoreAutoTime(false);
                    }}
                    placeholder="Yeni görev…"
                    aria-label="Yeni görev başlığı"
                    maxLength={120}
                    className="select-text flex-1 bg-transparent text-app-primary text-sm placeholder-app-muted outline-none min-w-0 font-medium"
                  />

                  {activeTimeLabel && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold flex-shrink-0 animate-scale-in"
                      style={{
                        background: 'var(--primary-dim)',
                        color: 'var(--primary-light)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    >
                      <Sparkles size={10} aria-hidden="true" />
                      <span>{activeTimeLabel}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (manualTime) setManualTime(null);
                          else setIgnoreAutoTime(true);
                        }}
                        className="ml-0.5 hover:opacity-80 p-0.5"
                        aria-label="Saati kaldır"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </div>

                {/* ─── Kompakt Çipler: Kategori, Öncelik, Saat, Proje ─── */}
                <div className="space-y-2.5">
                  {/* Kategori Çipleri */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CATEGORIES.map((cat) => {
                      const cfg = CATEGORY_CONFIG[cat];
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            if (cat === 'urgent') setSelectedPriority('high');
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                          style={
                            isSelected
                              ? {
                                  background: 'var(--surface)',
                                  border: `1px solid ${cfg.borderColor}`,
                                  color: cfg.dotColor,
                                }
                              : {
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-muted)',
                                }
                          }
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: isSelected ? cfg.dotColor : 'var(--text-faint)' }}
                          />
                          <span>{cfg.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Öncelik, Saat ve Proje Çipleri */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRIORITIES.map((prio) => {
                      const cfg = PRIORITY_CONFIG[prio];
                      const isSelected = selectedPriority === prio;
                      return (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => {
                            setSelectedPriority(prio);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                          style={
                            isSelected
                              ? {
                                  background: `${cfg.hex}1A`,
                                  border: `1px solid ${cfg.hex}55`,
                                  color: cfg.hex,
                                }
                              : {
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-muted)',
                                }
                          }
                        >
                          <Flag size={10} aria-hidden="true" />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setShowTimePresets((v) => !v);
                        setShowProjectPicker(false);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                      style={{
                        background:
                          showTimePresets || activeTimeLabel
                            ? 'var(--primary-dim)'
                            : 'var(--surface)',
                        border:
                          showTimePresets || activeTimeLabel
                            ? '1px solid rgba(99, 102, 241, 0.35)'
                            : '1px solid var(--border)',
                        color:
                          showTimePresets || activeTimeLabel
                            ? 'var(--primary-light)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      <Clock size={10} aria-hidden="true" />
                      <span>{activeTimeLabel ?? 'Saat'}</span>
                    </button>

                    {activeProjects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProjectPicker((v) => !v);
                          setShowTimePresets(false);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 active:scale-95 max-w-[140px] cursor-pointer"
                        style={{
                          background: selectedProject
                            ? `${selectedProject.color}18`
                            : 'var(--surface)',
                          border: selectedProject
                            ? `1px solid ${selectedProject.color}45`
                            : '1px solid var(--border)',
                          color: selectedProject
                            ? selectedProject.color
                            : 'var(--text-secondary)',
                        }}
                      >
                        <FolderKanban size={10} className="flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {selectedProject ? selectedProject.name : 'Proje'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ─── Saat / Hatırlatıcı Seçenekleri ─── */}
                {showTimePresets && (
                  <div
                    className="p-3 rounded-2xl border flex items-center justify-between gap-2 flex-wrap animate-fade-in"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: '1h', label: '+1s' },
                        { id: '15:00', label: '15:00' },
                        { id: '18:00', label: '18:00' },
                        { id: '21:00', label: '21:00' },
                        { id: 'tomorrow9', label: 'Yarın 09:00' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            applyPreset(
                              preset.id as '1h' | '15:00' | '18:00' | '21:00' | 'tomorrow9'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-app-secondary hover:text-app-primary transition-all active:scale-95"
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="time"
                      value={customTimeValue}
                      onChange={(e) => applyCustomTime(e.target.value)}
                      aria-label="Özel hatırlatıcı saati"
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-app-primary outline-none"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>
                )}

                {/* ─── Proje Seçici Çekmecesi ─── */}
                {showProjectPicker && activeProjects.length > 0 && (
                  <div
                    className="p-3 rounded-2xl border flex items-center gap-1.5 flex-wrap animate-fade-in"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(null);
                        setShowProjectPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                      style={{
                        background:
                          selectedProjectId === null ? 'var(--primary-dim)' : 'var(--surface-2)',
                        color:
                          selectedProjectId === null
                            ? 'var(--primary-light)'
                            : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      Projesiz
                    </button>
                    {activeProjects.map((proj) => {
                      const isSel = selectedProjectId === proj.id;
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(proj.id);
                            setShowProjectPicker(false);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                          style={{
                            background: isSel ? `${proj.color}22` : 'var(--surface-2)',
                            color: isSel ? proj.color : 'var(--text-secondary)',
                            border: isSel
                              ? `1px solid ${proj.color}55`
                              : '1px solid var(--border)',
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: proj.color }}
                          />
                          <span>{proj.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="btn-primary w-full py-3.5"
                >
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  <span>Görevi Ekle</span>
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
