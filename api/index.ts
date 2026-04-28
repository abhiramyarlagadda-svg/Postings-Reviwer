import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Base client (anon key, no user context) — used only for auth token validation + signUp/signIn
function getCandidatesClient(token?: string) {
  const opts: any = { auth: { autoRefreshToken: false, persistSession: false } };
  if (token) opts.global = { headers: { Authorization: `Bearer ${token}` } };
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    opts
  );
}

// Jobs Supabase (read-only via anon key)
const jobsDb = createClient(
  process.env.JOBS_SUPABASE_URL || '',
  process.env.JOBS_SUPABASE_ANON_KEY || ''
);

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Auth middleware - validates Supabase Auth JWT
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await getCandidatesClient().auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' });

  req.user = data.user;
  req.token = token;
  next();
};

// ─── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await getCandidatesClient().auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split('@')[0] } }
    });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.session) {
      return res.status(400).json({
        error: 'Check your email to confirm your account, then log in. (Or disable "Confirm email" in Supabase Auth settings to skip this step.)'
      });
    }

    res.json({
      user: {
        id: data.user!.id,
        name: name || email.split('@')[0],
        email
      },
      token: data.session.access_token
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await getCandidatesClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || email.split('@')[0],
        email: data.user.email
      },
      token: data.session.access_token
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ─── CANDIDATES ────────────────────────────────────────────────────────────────

app.get('/api/candidates', authenticate, async (req: any, res) => {
  const db = getCandidatesClient(req.token);
  const { data, error } = await db
    .from('candidates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/candidates', authenticate, upload.single('resume'), async (req: any, res) => {
  try {
    const { name, email, technology, country, experience_years, companies_worked } = req.body;
    if (!name || !technology || !country) {
      return res.status(400).json({ error: 'Name, technology, and country are required' });
    }

    const db = getCandidatesClient(req.token);

    let resume_url: string | null = null;
    if (req.file) {
      const ext = req.file.originalname.split('.').pop() || 'pdf';
      const path = `${req.user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await db.storage
        .from('resumes')
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (!uploadError) {
        const { data: urlData } = db.storage.from('resumes').getPublicUrl(path);
        resume_url = urlData.publicUrl;
      }
    }

    let companies: string[] = [];
    if (companies_worked) {
      try {
        companies = typeof companies_worked === 'string' ? JSON.parse(companies_worked) : companies_worked;
      } catch {
        companies = String(companies_worked).split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    const { data, error } = await db
      .from('candidates')
      .insert({
        user_id: req.user.id,
        name,
        email: email || null,
        technology,
        country,
        resume_url,
        experience_years: parseInt(experience_years) || 0,
        companies_worked: companies
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add candidate: ' + err.message });
  }
});

// ─── JOBS (from external Supabase) ─────────────────────────────────────────────

app.get('/api/jobs', authenticate, async (req: any, res) => {
  try {
    const {
      date_from,
      technology,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = jobsDb
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('status', 'active');

    if (date_from) {
      query = query.gte('posted_at', date_from);
    }

    if (technology) {
      // Strip characters that would break PostgREST or() syntax
      const tech = String(technology).replace(/[,()%{}*]/g, ' ').trim();
      if (tech) {
        query = query.or(`title.ilike.%${tech}%,description.ilike.%${tech}%`);
      }
    }

    const { data, error, count } = await query
      .order('posted_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      jobs: data || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil((count || 0) / limitNum))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch jobs: ' + err.message });
  }
});

// ─── APPLICATIONS ──────────────────────────────────────────────────────────────

app.get('/api/applications', authenticate, async (req: any, res) => {
  const { candidate_id } = req.query;
  const db = getCandidatesClient(req.token);
  let query = db.from('applications').select('*');

  if (candidate_id) query = query.eq('candidate_id', candidate_id);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/applications', authenticate, async (req: any, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    if (!candidate_id || !job_id) return res.status(400).json({ error: 'candidate_id and job_id required' });

    const db = getCandidatesClient(req.token);

    const { data: existing } = await db
      .from('applications')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: 'Already applied' });

    const { data, error } = await db
      .from('applications')
      .insert({
        user_id: req.user.id,
        candidate_id,
        job_id,
        status: 'applied'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to apply: ' + err.message });
  }
});

// ─── AI ANALYSIS ───────────────────────────────────────────────────────────────

app.post('/api/ai/analyse', authenticate, async (req: any, res) => {
  try {
    const { candidate, jobs } = req.body;
    if (!candidate || !Array.isArray(jobs) || jobs.length === 0) {
      return res.json({ scores: [] });
    }

    const truncatedJobs = jobs.slice(0, 50);
    const jobList = truncatedJobs.map((j: any, i: number) => {
      const skills = Array.isArray(j.skills) ? j.skills.join(', ') : '';
      return `${i}: "${j.title}" at ${j.company}. Skills: [${skills}]. Description: ${(j.description || '').substring(0, 300)}`;
    }).join('\n');

    const prompt = `You are a recruitment AI. Score how well a candidate's skills match each job.

Candidate primary technology: ${candidate.technology}
Candidate experience: ${candidate.experience_years} years
Candidate companies worked at: ${(candidate.companies_worked || []).join(', ') || 'none'}

Jobs:
${jobList}

For each job, return a skill match score from 0 to 100 based on technology/skills overlap.
Return ONLY a JSON array in this exact format: [{"index": 0, "score": 85}, {"index": 1, "score": 40}, ...]`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    let scores: any[] = [];
    try {
      scores = JSON.parse(response.text || '[]');
    } catch {
      scores = truncatedJobs.map((_: any, i: number) => ({ index: i, score: 50 }));
    }

    res.json({ scores });
  } catch (err: any) {
    const fallback = (req.body?.jobs || []).map((_: any, i: number) => ({ index: i, score: 50 }));
    res.json({ scores: fallback, warning: err.message });
  }
});

export default app;
