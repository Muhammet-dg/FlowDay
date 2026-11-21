import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { QuickCapture } from './components/QuickCapture';
import { CategoryPills } from './components/CategoryPills';
import { TodayProjectsStrip } from './components/TodayProjectsStrip';
import { TodayRoutinesSection } from './components/TodayRoutinesSection';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { SettingsModal } from './components/SettingsModal';
import { FocusModal } from './components/FocusModal';
import { Confetti } from './components/Confetti';
import { UndoToast } from './components/UndoToast';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { useTasks } from './hooks/useTasks';
import { useProjects } from './hooks/useProjects';
import { useLearnings } from './hooks/useLearnings';
import { useRoutines } from './hooks/useRoutines';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useStreak } from './hooks/useStreak';
import type { Tab, FilterCategory, Task, Category } from './types';
import { CATEGORY_CONFIG } from './types';
import { AlertCircle, RefreshCw, Loader2, BarChart3 } from 'lucide-react';

// Sekme bazlı Lazy Loading (Performans optimizasyonu)
const ProjectsView = lazy(() =>
  import('./components/ProjectsView').then((m) => ({ default: m.ProjectsView }))
);
const StatsView = lazy(() =>
  import('./components/StatsView').then((m) => ({ default: m.StatsView }))
);

function TabFallbackSkeleton() {
  return (
    <div className="px-5 pt-16 space-y-4 animate-pulse select-none">
      <div className="h-8 w-44 rounded-xl bg-surface" />
      <div className="h-36 rounded-3xl bg-surface" />
      <div className="grid grid-cols-2 gap-3.5">
        <div className="h-24 rounded-2xl bg-surface" />
        <div className="h-24 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [initialProjectDetailId, setInitialProjectDetailId] = useState<string | null>(null);
  const [initialProjectsSubView, setInitialProjectsSubView] = useState<
    'projects' | 'routines' | 'learnings'
  >('projects');
  const [initialRoutineDetailId, setInitialRoutineDetailId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusedTask, setFocusedTask] = useState<Task | null>(null);

  const { theme, toggleTheme } = useTheme();

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const {
    session,
    user,
    loading: authLoading,
    authLoading: authProcessing,
    authError,
    clearError,
    signIn,
    signUp,
    signOut,
  } = useAuth();

  const userId = user?.id ?? '';

  // ─── Görev hook'u ──────────────────────────────────────────────────────────
  const {
    tasks,
    activeTasks,
    completedTasks,
    archivedTasks,
    stats,
    loading,
    isSubmitting,
    error,
    deletedTaskToast,
    addTask,
    toggleTask,
    deleteTask,
    editTask,
    reorderTasks,
    undoDeleteTask,
    dismissDeleteToast,
    updateSubtasks,
    snoozeTask,
    clearCompleted,
    restoreCompleted,
    archiveCompleted,
    restoreFromArchive,
    clearArchive,
    importTasks,
    refetch,
  } = useTasks({ userId });

  // ─── Projeler ve Öğrendiklerim hook'ları ───────────────────────────────────
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
    importProjects,
  } = useProjects({ userId });

  const {
    learnings,
    addLearning,
    deleteLearning,
    importLearnings,
  } = useLearnings({ userId });

  // ─── Rutin Görevler hook'u ─────────────────────────────────────────────────
  const {
    routines,
    routineLogs,
    todayRoutines,
    todayRoutineCounts,
    routineStatsMap,
    addRoutine,
    updateRoutine,
    setRoutineStatus,
    toggleTodayRoutine,
    incrementTodayRoutine,
    skipTodayRoutine,
    importRoutinesData,
  } = useRoutines({ userId });

  // ─── Seri (Daily Streak) & Kutlama (Görevler + Bugünün Planlı Rutinleri) ───
  const { streak, showCelebration, dismissCelebration } = useStreak(
    userId,
    activeTasks.length + todayRoutineCounts.pendingCount,
    completedTasks,
    archivedTasks,
    todayRoutineCounts.doneCount
  );

  // ─── Bildirimler ───────────────────────────────────────────────────────────
  const { permission, status: notifStatus, subscribe, unsubscribe } = useNotifications({
    userId: user?.id ?? null,
  });

  const handleSubscribe = useCallback(async () => {
    await subscribe();
  }, [subscribe]);

  const handleUnsubscribe = useCallback(async () => {
    await unsubscribe();
  }, [unsubscribe]);

  // ─── Kategori & Proje Filtrelemesi ─────────────────────────────────────────
  const filteredActiveTasks = useMemo(() => {
    if (selectedCategory === 'all') return activeTasks;
    if (selectedCategory.startsWith('project:')) {
      const pid = selectedCategory.replace('project:', '');
      return activeTasks.filter((t) => t.project_id === pid);
    }
    if (selectedCategory === 'urgent') {
      return activeTasks.filter(
        (t) => t.category === 'urgent' || t.priority === 'high'
      );
    }
    return activeTasks.filter((t) => (t.category ?? 'personal') === selectedCategory);
  }, [activeTasks, selectedCategory]);

  const resolvedDefaultCategory: Category =
    selectedCategory === 'work' || selectedCategory === 'personal' || selectedCategory === 'urgent'
      ? selectedCategory
      : 'personal';

  const resolvedDefaultProjectId: string | null = selectedCategory.startsWith('project:')
    ? selectedCategory.replace('project:', '')
    : null;

  const filteredCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return undefined;
    if (selectedCategory === 'work' || selectedCategory === 'personal' || selectedCategory === 'urgent') {
      return CATEGORY_CONFIG[selectedCategory].label;
    }
    if (selectedCategory.startsWith('project:')) {
      const pid = selectedCategory.replace('project:', '');
      return projects.find((p) => p.id === pid)?.name ?? 'Seçili Proje';
    }
    return undefined;
  }, [selectedCategory, projects]);

  const showHeader = activeTab === 'tasks' || activeTab === 'completed';

  // ── Auth durumu henüz bilinmiyor → Splash ──────────────────────────────────
  if (authLoading) {
    return (
      <div className="relative min-h-dvh h-dvh w-full flex items-center justify-center select-none overflow-hidden bg-transparent">
        <BackgroundAnimation />
        <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background: 'var(--primary)',
              boxShadow: '0 12px 32px var(--primary-glow)',
            }}
          >
            <Loader2 size={26} className="text-white animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-app-primary font-display font-bold text-base tracking-tight">FlowDay</p>
            <p className="text-app-muted text-xs mt-0.5">Hazırlanıyor...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Oturum açılmamış → Giriş / Kayıt Ekranı ────────────────────────────────
  if (!session) {
    return (
      <AuthScreen
        onSignIn={signIn}
        onSignUp={signUp}
        authLoading={authProcessing}
        authError={authError}
        clearError={clearError}
      />
    );
  }

  // ── Oturum açık → Ana Uygulama ────────────────────────────────────────────
  return (
    <div className="relative min-h-dvh h-dvh w-full bg-transparent flex items-center justify-center overflow-hidden">
      {/* FlowDay Horizon Flow arka planı (Gece / Gündüz uyumlu) */}
      <BackgroundAnimation />

      {/* Gün Tamamlandı Kutlama & Confetti */}
      {showCelebration && (
        <Confetti streak={streak} onDismiss={dismissCelebration} />
      )}

      {/* Mobil / PWA Çerçevesi */}
      <div
        className="relative w-full h-full sm:max-w-md sm:h-[93vh] sm:max-h-[900px] sm:rounded-[32px] sm:border bg-transparent overflow-hidden flex flex-col select-none z-10 transition-shadow duration-300"
        style={{
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--frame-shadow)',
        }}
      >
        {/* ─── İlk Yükleme Katmanı ─── */}
        {loading === 'loading' &&
          activeTasks.length === 0 &&
          completedTasks.length === 0 && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3.5"
              style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'var(--primary-dim)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
              >
                <Loader2 size={22} className="text-indigo-400 animate-spin" />
              </div>
              <p className="text-app-secondary text-xs font-medium">
                Görevler senkronize ediliyor...
              </p>
            </div>
          )}

        {/* ─── PWA Yeni Sürüm Bildirimi ─── */}
        <PwaUpdateToast />

        {/* ─── Hata Banner'ı ─── */}
        {error && (
          <div
            className="mx-5 mt-4 z-30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg animate-fade-in"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.24)',
            }}
          >
            <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-xs flex-1 leading-snug">{error}</p>
            <button
              onClick={() => void refetch()}
              className="flex items-center gap-1 text-red-300 text-xs font-semibold hover:text-white transition-colors active:scale-90 flex-shrink-0"
            >
              <RefreshCw size={11} />
              <span>Tekrar dene</span>
            </button>
          </div>
        )}

        {/* ─── Kaydırılabilir İçerik Alanı ─── */}
        <div
          className="flex-1 overflow-y-auto overscroll-none"
          style={{
            paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {showHeader && (
            <Header
              streak={streak}
              theme={theme}
              onToggleTheme={toggleTheme}
              userEmail={user?.email ?? ''}
              onOpenSettings={() => setShowSettings(true)}
            />
          )}

          {/* ─── GÖREVLER SEKMESİ ─── */}
          {activeTab === 'tasks' && (
            <div>
              {/* 1. Kompakt Yatay Proje Çip Şeridi */}
              <TodayProjectsStrip
                projects={projects}
                tasks={tasks}
                onOpenProjectDetail={(projectId) => {
                  setInitialProjectsSubView('projects');
                  setInitialProjectDetailId(projectId);
                  setActiveTab('projects');
                }}
              />

              {/* 2. Kategori Filtre Çipleri */}
              <CategoryPills
                selected={selectedCategory}
                onSelect={setSelectedCategory}
              />

              {/* 3. Sade Tek Satırlık Görev Ekleme Alanı */}
              <QuickCapture
                onAdd={addTask}
                defaultCategory={resolvedDefaultCategory}
                defaultProjectId={resolvedDefaultProjectId}
                projects={projects}
              />

              {/* 4. Bugünün Rutinleri ("Rutinler X/Y") */}
              <TodayRoutinesSection
                items={
                  selectedCategory === 'all'
                    ? todayRoutines
                    : selectedCategory === 'urgent'
                      ? todayRoutines.filter((item) => item.routine.category === 'urgent')
                      : todayRoutines.filter((item) => item.routine.category === selectedCategory)
                }
                doneCount={todayRoutineCounts.doneCount}
                totalPlanned={todayRoutineCounts.totalPlanned}
                totalRoutinesCount={routines.filter((r) => r.status !== 'archived').length}
                onToggle={(id) => void toggleTodayRoutine(id)}
                onIncrement={(id) => void incrementTodayRoutine(id)}
                onSkip={(id) => void skipTodayRoutine(id)}
                onOpenManager={(routineId) => {
                  setInitialProjectsSubView('routines');
                  setInitialRoutineDetailId(routineId ?? null);
                  setActiveTab('projects');
                }}
              />

              {/* 5. Görev Listesi */}
              <div>
                <TaskList
                  tasks={filteredActiveTasks}
                  projects={projects}
                  type="active"
                  filteredCategoryName={filteredCategoryName}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onEdit={editTask}
                  onReorder={reorderTasks}
                  onSnooze={snoozeTask}
                  onFocus={setFocusedTask}
                  onUpdateSubtasks={updateSubtasks}
                />
              </div>
            </div>
          )}

          {/* ─── PROJELER, RUTİNLER & ÖĞRENDİKLERİM SEKMESİ ─── */}
          {activeTab === 'projects' && (
            <Suspense fallback={<TabFallbackSkeleton />}>
              <ProjectsView
                projects={projects}
                tasks={tasks}
                learnings={learnings}
                routines={routines}
                routineStatsMap={routineStatsMap}
                initialProjectId={initialProjectDetailId}
                initialSubView={initialProjectsSubView}
                initialRoutineId={initialRoutineDetailId}
                onClearInitialProject={() => setInitialProjectDetailId(null)}
                onClearInitialRoutine={() => setInitialRoutineDetailId(null)}
                onAddProject={addProject}
                onUpdateProject={updateProject}
                onDeleteProject={deleteProject}
                onAddMilestone={addMilestone}
                onToggleMilestone={toggleMilestone}
                onDeleteMilestone={deleteMilestone}
                onAddTask={addTask}
                onToggleTask={toggleTask}
                onDeleteTask={deleteTask}
                onUpdateSubtasks={updateSubtasks}
                onAddLearning={addLearning}
                onDeleteLearning={deleteLearning}
                onAddRoutine={addRoutine}
                onUpdateRoutine={updateRoutine}
                onSetRoutineStatus={setRoutineStatus}
              />
            </Suspense>
          )}

          {/* ─── TAMAMLANANLAR SEKMESİ ─── */}
          {activeTab === 'completed' && (
            <div className="pt-1">
              <TaskList
                tasks={completedTasks}
                archivedTasks={archivedTasks}
                projects={projects}
                type="completed"
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdateSubtasks={updateSubtasks}
                onClearCompleted={clearCompleted}
                onRestoreCompleted={restoreCompleted}
                onArchiveCompleted={archiveCompleted}
                onRestoreFromArchive={restoreFromArchive}
                onClearArchive={clearArchive}
              />
            </div>
          )}

          {/* ─── İSTATİSTİKLER SEKMESİ ─── */}
          {activeTab === 'stats' && (
            <Suspense fallback={<TabFallbackSkeleton />}>
              <div>
                <div
                  className="px-5 pb-4"
                  style={{
                    paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))',
                  }}
                >
                  <p className="text-app-muted text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Performans & Analiz
                  </p>
                  <div className="flex items-center gap-2.5 mt-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--primary-dim)' }}
                    >
                      <BarChart3 size={16} className="text-indigo-400" />
                    </div>
                    <h1 className="text-app-primary text-2xl font-bold tracking-tight">
                      İstatistikler
                    </h1>
                  </div>
                </div>

                <StatsView
                  stats={stats}
                  streak={streak}
                  tasks={tasks}
                  archivedTasks={archivedTasks}
                  projects={projects}
                  learnings={learnings}
                  routines={routines}
                  routineLogs={routineLogs}
                  userId={userId}
                  onToggleTask={(id) => void toggleTask(id)}
                  onDeleteTask={(id) => void deleteTask(id)}
                  onImportData={async (payload) => {
                    if (payload.projects) await importProjects(payload.projects);
                    if (payload.tasks) await importTasks(payload.tasks);
                    if (payload.learnings) await importLearnings(payload.learnings);
                    if (payload.routines || payload.routineLogs) {
                      await importRoutinesData(payload.routines, payload.routineLogs);
                    }
                  }}
                />
              </div>
            </Suspense>
          )}
        </div>

        {/* ─── 5 Saniyelik Geri Al (Undo) Toast Bildirimi ─── */}
        {deletedTaskToast && (
          <UndoToast
            taskTitle={deletedTaskToast.title}
            onUndo={undoDeleteTask}
            onDismiss={dismissDeleteToast}
          />
        )}

        {/* ─── Yüzen Alt Navigasyon (Floating Bottom Bar — 4 Öğe) ─── */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={(t) => {
            if (t !== 'projects') {
              setInitialProjectDetailId(null);
              setInitialRoutineDetailId(null);
            }
            setActiveTab(t);
          }}
          hasActiveTasks={activeTasks.length + todayRoutineCounts.pendingCount > 0}
        />
      </div>

      {/* ─── Detaylı Görev Ekleme Modalı ─── */}
      {showForm && (
        <TaskForm
          onAdd={(data) => {
            void addTask(data);
          }}
          onClose={() => setShowForm(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ─── Tek Göreve Odaklanma Modu (Focus / Pomodoro Mini) ─── */}
      {focusedTask && (
        <FocusModal
          task={focusedTask}
          onComplete={(id) => void toggleTask(id)}
          onClose={() => setFocusedTask(null)}
        />
      )}

      {/* ─── Profil, Ayarlar & Geliştirici Menüsü Modalı ─── */}
      {showSettings && (
        <SettingsModal
          userEmail={user?.email ?? ''}
          theme={theme}
          onToggleTheme={toggleTheme}
          streak={streak}
          notifPermission={permission}
          notifStatus={notifStatus}
          onSubscribeNotif={() => void handleSubscribe()}
          onUnsubscribeNotif={() => void handleUnsubscribe()}
          onSignOut={() => void signOut()}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
