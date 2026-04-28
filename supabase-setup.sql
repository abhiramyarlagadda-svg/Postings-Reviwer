-- Run this in the candidates Supabase SQL editor
-- Project: iuleoikrcxpvtajekksy.supabase.co
-- This sets up tables for storing candidates and applications
-- Users are managed via Supabase Auth (auth.users) - no custom users table needed

-- Candidates table
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

-- Applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  status TEXT DEFAULT 'applied',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON public.applications(candidate_id);

-- Storage bucket for resumes (public read so resume_url works directly)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;
