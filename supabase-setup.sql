-- Run this in your Supabase SQL editor
-- Project: vrkuuddaglyxtdaesbnv.supabase.co
-- Paste the entire file and click "Run"

-- ─── TABLES ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
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

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own candidates
CREATE POLICY "users_own_candidates" ON public.candidates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only see and modify their own applications
CREATE POLICY "users_own_applications" ON public.applications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── STORAGE ───────────────────────────────────────────────────────────────────

-- Public bucket so resume_url links work directly
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload resumes
CREATE POLICY "authenticated_upload_resumes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes');

-- Anyone can read resume files (links are public)
CREATE POLICY "public_read_resumes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');

-- Authenticated users can delete their own resumes
CREATE POLICY "users_delete_own_resumes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
