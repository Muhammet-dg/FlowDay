import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Clock,
  Sparkles,
  X,
  FolderKanban,
  Flag,
  Check,
} from 'lucide-react';
import type { Category, Priority, Project, TaskFormData } from '../types';
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from '../types';

type QuickCaptureProps = {
  onAdd: (data: TaskFormData) => void;
  defaultCategory?: Category;
  defaultProjectId?: string | null;
  projects?: Project[];
  inputId?: string;
};

type ParsedNaturalInput = {
  cleanTitle: string;
  time: {
    hour: number;
    minute: number;
    isTomorrow: boolean;
    label: string;
  } | null;
  priority: Priority | null;
  category: Category | null;
};

/**
 * Doğal dilde tarih, saat, öncelik (!acil, !orta, !düşük) ve kategori (#iş, #kişisel, #acil) algılama.
 * Örn: "Sunum hazırla yarın 15:00 !acil #iş", "Su iç +1s #kişisel", "Toplantı notları akşam !orta"
 */
function parseNaturalInput(input: string): ParsedNaturalInput {
  let working = input;
  let detectedPriority: Priority | null = null;
  let detectedCategory: Category | null = null;
  let timeResult: ParsedNaturalInput['time'] = null;

  // 1. Öncelik algılama: !acil, !yüksek, !yuksek, !!!, !orta, !düşük, !dusuk
  const prioRegex = /(?:^|\s)(!(?:acil|yüksek|yuksek|orta|düşük|dusuk)|!!!|!!)(?=\s|$)/i;
  const prioMatch = working.match(prioRegex);
  if (prioMatch) {
    const token = prioMatch[1].toLowerCase();
    if (token === '!acil' || token === '!yüksek' || token === '!yuksek' || token === '!!!' || token === '!!') {
      detectedPriority = 'high';
    } else if (token === '!orta') {
      detectedPriority = 'medium';
    } else if (token === '!düşük' || token === '!dusuk') {
      detectedPriority = 'low';
    }
    working = working.replace(prioMatch[0], ' ');
  }

  // 2. Kategori algılama: #iş, #is, #proje, #kişisel, #kisisel, #ev, #acil
  const catRegex = /(?:^|\s)#(iş|is|proje|kişisel|kisisel|ev|acil)\b/i;
  const catMatch = working.match(catRegex);
  if (catMatch) {
    const token = catMatch[1].toLowerCase();
    if (token === 'iş' || token === 'is' || token === 'proje') {
      detectedCategory = 'work';
    } else if (token === 'kişisel' || token === 'kisisel' || token === 'ev') {
      detectedCategory = 'personal';
    } else if (token === 'acil') {
      detectedCategory = 'urgent';
      if (!detectedPriority) detectedPriority = 'high';
    }
    working = working.replace(catMatch[0], ' ');
  }

  // 3. Saat ve tarih algılama:
  // a) Açık saat: "(yarın|bugün)? 15:00" veya "14.30"
  const explicitTimeRegex = /(?:(yarın|yarin|bugün|bugun)\s+)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i;
  const explicitMatch = working.match(explicitTimeRegex);

  if (explicitMatch) {
    const dayWord = (explicitMatch[1] ?? '').toLowerCase();
    const isTomorrow = dayWord === 'yarın' || dayWord === 'yarin';
    const hour = parseInt(explicitMatch[2], 10);
    const minute = parseInt(explicitMatch[3], 10);
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const label = isTomorrow ? `Yarın ${formattedTime}` : formattedTime;
    working = working.replace(explicitMatch[0], ' ');
    timeResult = { hour, minute, isTomorrow, label };
  } else {
    // b) "+1s" veya "1 saat sonra"
    const relHourRegex = /(?:^|\s)(\+1s|1\s+saat\s+sonra)\b/i;
    const relMatch = working.match(relHourRegex);
    if (relMatch) {
      const target = new Date();
      target.setHours(target.getHours() + 1);
      const hour = target.getHours();
      const minute = target.getMinutes();
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      working = working.replace(relMatch[0], ' ');
      timeResult = { hour, minute, isTomorrow: false, label };
    } else {
      // c) "yarın sabah", "yarın akşam", "yarın", "bu akşam", "akşam", "sabah", "öğlen"
      const namedTimeRegex =
        /(?:^|\s)(?:(yarın|yarin)\s*(sabah|öğlen|oglen|akşam|aksam|gece)?|(bu\s+)?(sabah|öğlen|oglen|akşam|aksam|gece))\b/i;
      const namedMatch = working.match(namedTimeRegex);
      if (namedMatch) {
        const isTomorrow = Boolean(namedMatch[1]);
        const period = (namedMatch[2] || namedMatch[4] || '').toLowerCase();
        let hour = 9;
        let minute = 0;
        if (period === 'öğlen' || period === 'oglen') {
          hour = 12;
          minute = 30;
        } else if (period === 'akşam' || period === 'aksam') {
          hour = 19;
          minute = 0;
        } else if (period === 'gece') {
          hour = 21;
          minute = 30;
        }
        const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const label = isTomorrow ? `Yarın ${formattedTime}` : formattedTime;
        working = working.replace(namedMatch[0], ' ');
        timeResult = { hour, minute, isTomorrow, label };
      }
    }
  }

  const cleanTitle = working.replace(/\s{2,}/g, ' ').trim();

  return {
    cleanTitle: cleanTitle || input.trim(),
    time: timeResult,
    priority: detectedPriority,
    category: detectedCategory,
  };
}

const CATEGORIES: Category[] = ['personal', 'work', 'urgent'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export function QuickCapture({
  onAdd,
  defaultCategory = 'personal',
  defaultProjectId = null,
  projects = [],
  inputId = 'quick-capture-input',
}: QuickCaptureProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCategory(defaultCategory);
    setSelectedPriority(defaultCategory === 'urgent' ? 'high' : 'medium');
  }, [defaultCategory]);

  useEffect(() => {
    setSelectedProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !text.trim()
      ) {
        setIsFocused(false);
        setShowTimePresets(false);
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [text]);

  const parsedNatural = useMemo(() => parseNaturalInput(text), [text]);

  const detectedTime = useMemo(() => {
    if (ignoreAutoTime || manualTime) return null;
    return parsedNatural.time;
  }, [parsedNatural.time, ignoreAutoTime, manualTime]);

  const effectiveCategory: Category = parsedNatural.category ?? selectedCategory;
  const effectivePriority: Priority =
    parsedNatural.priority ??
    (parsedNatural.category === 'urgent' ? 'high' : selectedPriority);

  const cyclePriority = () => {
    const idx = PRIORITIES.indexOf(effectivePriority);
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length];
    setSelectedPriority(next);
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setIsFocused(true);
      inputRef.current?.focus();
      return;
    }

    const hasNaturalTokens =
      Boolean(detectedTime) ||
      Boolean(parsedNatural.priority) ||
      Boolean(parsedNatural.category);

    const finalTitle = hasNaturalTokens ? parsedNatural.cleanTitle : text.trim();
    let reminderIso: string | null = null;

    if (manualTime) {
      reminderIso = manualTime.iso;
    } else if (detectedTime) {
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
      title: finalTitle || text.trim(),
      note: '',
      priority: effectivePriority,
      category: effectiveCategory,
      project_id: selectedProjectId,
      reminder_time: reminderIso,
    });

    setText('');
    setManualTime(null);
    setCustomTimeValue('');
    setIgnoreAutoTime(false);
    setShowTimePresets(false);
    setShowProjectPicker(false);

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 240);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const isExpanded = isFocused || Boolean(text.trim()) || showTimePresets || showProjectPicker;
  const activeTimeLabel = manualTime?.label ?? detectedTime?.label ?? null;
  const prioConfig = PRIORITY_CONFIG[effectivePriority];
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  return (
    <div ref={containerRef} className="px-4 mb-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border transition-colors duration-150 overflow-hidden"
        style={{
          background: 'var(--surface)',
          borderColor: justAdded
            ? '#10B981'
            : isExpanded
              ? 'var(--border-focus)'
              : 'var(--border)',
        }}
      >
        {/* ─── Tek Satırlık Sade Giriş ("+ Yeni görev…") ─── */}
        <div className="flex items-center gap-2 px-3 py-1.5 min-h-[44px]">
          <button
            type="submit"
            aria-label="Görevi ekle"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0 cursor-pointer"
            style={{
              background: justAdded
                ? '#10B981'
                : text.trim()
                  ? 'var(--primary)'
                  : 'transparent',
              color: text.trim() || justAdded ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            {justAdded ? (
              <Check size={15} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            )}
          </button>

          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={text}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setText(e.target.value);
              if (ignoreAutoTime) setIgnoreAutoTime(false);
            }}
            placeholder={
              isFocused
                ? 'Yeni görev… (örn: Rapor 15:00 !acil #iş)'
                : 'Yeni görev…'
            }
            aria-label="Yeni görev başlığı"
            maxLength={120}
            className="select-text flex-1 bg-transparent text-app-primary text-sm placeholder-app-muted outline-none min-w-0 font-medium"
          />

          {(parsedNatural.priority || parsedNatural.category) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0"
              style={{
                background:
                  effectivePriority === 'high'
                    ? 'rgba(239, 68, 68, 0.14)'
                    : 'var(--surface-2)',
                color:
                  effectivePriority === 'high'
                    ? '#FCA5A5'
                    : CATEGORY_CONFIG[effectiveCategory].dotColor,
              }}
            >
              <Sparkles size={11} aria-hidden="true" />
              <span>
                {parsedNatural.priority
                  ? PRIORITY_CONFIG[parsedNatural.priority].label
                  : CATEGORY_CONFIG[effectiveCategory].shortLabel}
              </span>
            </span>
          )}

          {activeTimeLabel && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0"
              style={{
                background: 'var(--primary-dim)',
                color: 'var(--primary-light)',
              }}
            >
              <Sparkles size={11} aria-hidden="true" />
              <span>{activeTimeLabel}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (manualTime) setManualTime(null);
                  else setIgnoreAutoTime(true);
                }}
                className="ml-0.5 hover:opacity-80 p-0.5"
                aria-label="Saati kaldır"
              >
                <X size={11} />
              </button>
            </span>
          )}
        </div>

        {/* ─── Focus Olunca Açılan Küçük Çipler (Kategori, Öncelik, Saat, Proje) ─── */}
        {isExpanded && (
          <div
            className="px-3 py-2 border-t flex items-center gap-1.5 overflow-x-auto scrollbar-none animate-fade-in"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-2)',
            }}
          >
            {CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const isSelected = effectiveCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (cat === 'urgent') setSelectedPriority('high');
                    inputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-95 flex-shrink-0 cursor-pointer"
                  style={
                    isSelected
                      ? {
                          background: 'var(--surface)',
                          color: cfg.dotColor,
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--text-secondary)',
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

            <span className="w-px h-3.5 mx-0.5 flex-shrink-0" style={{ background: 'var(--border)' }} />

            <button
              type="button"
              onClick={() => {
                cyclePriority();
                inputRef.current?.focus();
              }}
              title="Öncelik seviyesini değiştir"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-95 flex-shrink-0 cursor-pointer"
              style={{
                background: 'var(--surface)',
                color: prioConfig.hex,
              }}
            >
              <Flag size={11} aria-hidden="true" />
              <span>{prioConfig.label}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowTimePresets((v) => !v);
                setShowProjectPicker(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-95 flex-shrink-0 cursor-pointer"
              style={{
                background:
                  showTimePresets || activeTimeLabel ? 'var(--primary-dim)' : 'var(--surface)',
                color:
                  showTimePresets || activeTimeLabel
                    ? 'var(--primary-light)'
                    : 'var(--text-secondary)',
              }}
            >
              <Clock size={11} aria-hidden="true" />
              <span>{activeTimeLabel ?? 'Saat'}</span>
            </button>

            {activeProjects.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowProjectPicker((v) => !v);
                  setShowTimePresets(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-95 max-w-[125px] flex-shrink-0 cursor-pointer"
                style={{
                  background: selectedProject ? `${selectedProject.color}18` : 'var(--surface)',
                  color: selectedProject ? selectedProject.color : 'var(--text-secondary)',
                }}
              >
                <FolderKanban size={11} className="flex-shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {selectedProject ? selectedProject.name : 'Proje'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ─── Saat Seçenekleri ─── */}
        {showTimePresets && (
          <div
            className="px-3 py-2 border-t flex items-center justify-between gap-1.5 flex-wrap animate-fade-in"
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
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-app-secondary hover:text-app-primary transition-colors active:scale-95"
                  style={{
                    background: 'var(--surface-2)',
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
              className="px-2 py-1 rounded-lg text-xs font-semibold text-app-primary outline-none"
              style={{
                background: 'var(--surface-2)',
              }}
            />
          </div>
        )}

        {/* ─── Proje Seçenekleri ─── */}
        {showProjectPicker && activeProjects.length > 0 && (
          <div
            className="px-3 py-2 border-t flex items-center gap-1.5 flex-wrap animate-fade-in"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setShowProjectPicker(false);
                inputRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95"
              style={{
                background:
                  selectedProjectId === null ? 'var(--primary-dim)' : 'var(--surface-2)',
                color:
                  selectedProjectId === null ? 'var(--primary-light)' : 'var(--text-secondary)',
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95"
                  style={{
                    background: isSel ? `${proj.color}22` : 'var(--surface-2)',
                    color: isSel ? proj.color : 'var(--text-secondary)',
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
      </form>
    </div>
  );
}
