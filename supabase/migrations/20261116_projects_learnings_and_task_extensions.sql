-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20261116_projects_learnings_and_task_extensions.sql
--
-- Amaç:
--   1. public.projects tablosunu oluşturma (Proje takibi, kilometre taşları, durum)
--   2. public.learnings tablosunu oluşturma ("Bugün ne öğrendim?" öğrenme günlüğü)
--   3. public.tasks tablosuna geriye uyumlu olarak project_id (nullable),
--      category, subtasks (jsonb) ve completed_at sütunlarını ekleme
--   4. Tüm tablolarda Row Level Security (RLS) ve auth.uid() = user_id politikaları
--   5. Mevcut görevlerde project_id = NULL kalarak veri bütünlüğünün korunması
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. PROJELER TABLOSU (public.projects) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#6366F1',
  icon        text        NOT NULL DEFAULT 'folder',
  description text,
  start_date  date,
  target_date date,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'on_hold', 'completed')),
  milestones  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status  ON public.projects(user_id, status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects: select own'
  ) THEN
    CREATE POLICY "projects: select own"
      ON public.projects FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects: insert own'
  ) THEN
    CREATE POLICY "projects: insert own"
      ON public.projects FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects: update own'
  ) THEN
    CREATE POLICY "projects: update own"
      ON public.projects FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects: delete own'
  ) THEN
    CREATE POLICY "projects: delete own"
      ON public.projects FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at otomatik güncelleme trigger'ı
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. ÖĞRENDİKLERİM TABLOSU (public.learnings) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.learnings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text        NOT NULL,
  project_id   uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  tags         text[]      NOT NULL DEFAULT '{}',
  learned_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learnings_user_id      ON public.learnings(user_id);
CREATE INDEX IF NOT EXISTS idx_learnings_project_id   ON public.learnings(project_id);
CREATE INDEX IF NOT EXISTS idx_learnings_learned_date ON public.learnings(user_id, learned_date DESC);

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'learnings' AND policyname = 'learnings: select own'
  ) THEN
    CREATE POLICY "learnings: select own"
      ON public.learnings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'learnings' AND policyname = 'learnings: insert own'
  ) THEN
    CREATE POLICY "learnings: insert own"
      ON public.learnings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'learnings' AND policyname = 'learnings: update own'
  ) THEN
    CREATE POLICY "learnings: update own"
      ON public.learnings FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'learnings' AND policyname = 'learnings: delete own'
  ) THEN
    CREATE POLICY "learnings: delete own"
      ON public.learnings FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 3. TASKS TABLOSU GERİYE UYUMLU GENİŞLETMELERİ ────────────────────────────
-- Mevcut veriler korunur; eski görevlerde project_id = NULL ve subtasks = '[]' kalır.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('work', 'personal', 'urgent')),
  ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_user_id      ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(user_id, completed_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks: users own tasks'
  ) THEN
    CREATE POLICY "tasks: users own tasks"
      ON public.tasks FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE  public.projects  IS 'Kullanıcı projeleri, hedef tarihleri ve kilometre taşları.';
COMMENT ON TABLE  public.learnings IS 'Günlük "Bugün ne öğrendim?" notları, proje ve etiket bağlantıları.';
COMMENT ON COLUMN public.tasks.project_id IS 'Görevin bağlı olduğu proje (opsiyonel / nullable).';
COMMENT ON COLUMN public.tasks.subtasks   IS 'Görevin alt adımları (JSONB checklist dizisi).';
