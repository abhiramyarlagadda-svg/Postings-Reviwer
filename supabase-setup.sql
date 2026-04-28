-- Run this in your Supabase SQL editor
-- Project: vrkuuddaglyxtdaesbnv.supabase.co
-- Paste the entire file and click "Run"

-- ─── USERS TABLE (replaces Supabase Auth) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLES ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  technology TEXT,
  country TEXT,
  resume_url TEXT,
  experience_years INTEGER DEFAULT 0,
  companies_worked JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates(user_id);

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  status TEXT DEFAULT 'applied',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON public.applications(candidate_id);

-- ─── DISABLE RLS (service role key bypasses it anyway) ─────────────────────────

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;

-- ─── STORAGE ───────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read resume files (public bucket)
CREATE POLICY "public_read_resumes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');

-- Allow anon key (server-side API) to upload resumes
CREATE POLICY "anon_upload_resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'resumes');
