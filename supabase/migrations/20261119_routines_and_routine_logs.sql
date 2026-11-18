-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20261119_routines_and_routine_logs.sql
--
-- Amaç:
--   1. public.routines tablosunu oluşturma (Rutin şablonları, tekrar kuralları,
--      hedef sayı, başlangıç/bitiş tarihi, aktif/duraklatıldı/arşiv durumu)
--   2. public.routine_logs tablosunu oluşturma (Günlük rutin kayıtları:
--      pending | done | skipped, sayaç ilerlemesi ve UNIQUE(routine_id, date) kısıtı)
--   3. Tüm tablolarda Row Level Security (RLS) ve auth.uid() = user_id politikaları
--   4. Performans için (user_id, date) ve (routine_id, date) index'leri
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. RUTİNLER TABLOSU (public.routines) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routines (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  icon         text        NOT NULL DEFAULT '💧',
  color        text        NOT NULL DEFAULT '#6366F1',
  category     text        NOT NULL DEFAULT 'personal'
                           CHECK (category IN ('work', 'personal', 'urgent')),
  project_id   uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  time         text,       -- 'HH:MM' formatında isteğe bağlı saat (örn. '09:00')
  reminder     boolean     NOT NULL DEFAULT false,
  repeat_type  text        NOT NULL DEFAULT 'daily'
                           CHECK (repeat_type IN ('daily', 'weekdays', 'weekends', 'custom')),
  repeat_days  integer[]   NOT NULL DEFAULT '{1,2,3,4,5,6,0}', -- 0=Paz, 1=Pzt ... 6=Cmt
  target_count integer     NOT NULL DEFAULT 1 CHECK (target_count >= 1 AND target_count <= 100),
  start_date   date        NOT NULL DEFAULT CURRENT_DATE,
  end_date     date,
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'paused', 'archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON public.routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_status  ON public.routines(user_id, status);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routines' AND policyname = 'routines: select own'
  ) THEN
    CREATE POLICY "routines: select own"
      ON public.routines FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routines' AND policyname = 'routines: insert own'
  ) THEN
    CREATE POLICY "routines: insert own"
      ON public.routines FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routines' AND policyname = 'routines: update own'
  ) THEN
    CREATE POLICY "routines: update own"
      ON public.routines FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routines' AND policyname = 'routines: delete own'
  ) THEN
    CREATE POLICY "routines: delete own"
      ON public.routines FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. GÜNLÜK RUTİN KAYITLARI TABLOSU (public.routine_logs) ──────────────────
CREATE TABLE IF NOT EXISTS public.routine_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id   uuid        NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  date         date        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'done', 'skipped')),
  count        integer     NOT NULL DEFAULT 0 CHECK (count >= 0),
  target_count integer     NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_routine_logs_routine_date UNIQUE (routine_id, date)
);

CREATE INDEX IF NOT EXISTS idx_routine_logs_user_date    ON public.routine_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_date ON public.routine_logs(routine_id, date DESC);

ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routine_logs' AND policyname = 'routine_logs: select own'
  ) THEN
    CREATE POLICY "routine_logs: select own"
      ON public.routine_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routine_logs' AND policyname = 'routine_logs: insert own'
  ) THEN
    CREATE POLICY "routine_logs: insert own"
      ON public.routine_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routine_logs' AND policyname = 'routine_logs: update own'
  ) THEN
    CREATE POLICY "routine_logs: update own"
      ON public.routine_logs FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'routine_logs' AND policyname = 'routine_logs: delete own'
  ) THEN
    CREATE POLICY "routine_logs: delete own"
      ON public.routine_logs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.routines     IS 'Kullanıcının tekrarlayan günlük/haftalık rutin tanımları.';
COMMENT ON TABLE public.routine_logs IS 'Rutinlerin gün bazlı idempotent durum ve sayaç kayıtları.';
