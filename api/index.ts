import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';

function getDb() {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const jobsDb = createClient(
  process.env.JOBS_SUPABASE_URL || '',
  process.env.JOBS_SUPABASE_ANON_KEY || ''
);

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

// ─── In-memory rate limiter (10 attempts per 15 min per IP) ───────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Clean stale entries hourly
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (val.resetAt < now) loginAttempts.delete(key);
  }
}, 60 * 60 * 1000);

// ─── Sanitize strings used in AI prompt ───────────────────────────────────────
const sanitize = (s: any, maxLen = 200): string =>
  String(s || '').replace(/[\r\n]/g, ' ').trim().substring(0, maxLen);

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const ALLOWED_RESUME_MIMES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_RESUME_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX are allowed.'));
    }
  }
});

// ─── Auth middleware ────────────────────────────────────────────────────────────
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await getDb().from('users').select('*').eq('token', token).maybeSingle();
  if (error || !data) return res.status(401).json({ error: 'Unauthorized' });

  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.user = data;
  next();
};

// ─── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = getDb();
    const { data: existing } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('users')
      .insert({ name: String(name).trim(), email, password: password_hash, token_expires_at })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      user: { id: data.id, name: data.name, email: data.email },
      token: data.token
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
      .split(',')[0].trim();
    if (!checkLoginRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    const { password } = req.body;
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const { data, error } = await db.from('users').select('*').eq('email', email).maybeSingle();
    if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });

    const isBcrypt = data.password?.startsWith('$2');
    let passwordMatch: boolean;

    if (isBcrypt) {
      passwordMatch = await bcrypt.compare(password, data.password);
    } else {
      // Plain text password (legacy) — compare then upgrade to bcrypt
      passwordMatch = data.password === password;
      if (passwordMatch) {
        const newHash = await bcrypt.hash(password, 10);
        await db.from('users').update({ password: newHash }).eq('id', data.id);
      }
    }

    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.from('users').update({ token_expires_at }).eq('id', data.id);

    res.json({
      user: { id: data.id, name: data.name, email: data.email },
      token: data.token
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

app.post('/api/auth/logout', authenticate, async (req: any, res) => {
  await getDb()
    .from('users')
    .update({ token_expires_at: new Date(0).toISOString() })
    .eq('id', req.user.id);
  res.json({ ok: true });
});

// ─── CANDIDATES ────────────────────────────────────────────────────────────────

app.get('/api/candidates', authenticate, async (req: any, res) => {
  const { data, error } = await getDb()
    .from('candidates')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/candidates', authenticate, (req: any, res: any, next: any) => {
  upload.single('resume')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: any, res) => {
  try {
    const { name, email, technology, country, experience_years, companies_worked } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!technology) return res.status(400).json({ error: 'Technology is required' });
    if (!country) return res.status(400).json({ error: 'Country is required' });

    const db = getDb();
    let resume_url: string | null = null;
    if (req.file) {
      const ext = req.file.originalname.split('.').pop() || 'pdf';
      const filePath = `${req.user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await db.storage
        .from('resumes')
        .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('resumes').getPublicUrl(filePath);
        resume_url = urlData.publicUrl;
      }
    }

    let companies: string[] = [];
    if (companies_worked) {
      try {
        companies = typeof companies_worked === 'string' ? JSON.parse(companies_worked) : companies_worked;
      } catch {
        companies = String(companies_worked).split(',').map((c: string) => c.trim()).filter(Boolean);
      }
    }

    const { data, error } = await db
      .from('candidates')
      .insert({
        user_id: req.user.id,
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
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

app.delete('/api/candidates/:id', authenticate, async (req: any, res) => {
  try {
    const db = getDb();
    const { data: candidate } = await db
      .from('candidates')
      .select('resume_url')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    if (candidate.resume_url) {
      const urlParts = candidate.resume_url.split('/resumes/');
      if (urlParts[1]) {
        await db.storage.from('resumes').remove([decodeURIComponent(urlParts[1])]);
      }
    }

    const { error } = await db
      .from('candidates')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: 1 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete candidate: ' + err.message });
  }
});

// ─── JOBS (from external Supabase) ─────────────────────────────────────────────

app.get('/api/jobs', authenticate, async (req: any, res) => {
  try {
    const { date_from, date_to, technology, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = jobsDb.from('jobs').select('*', { count: 'exact' }).eq('status', 'active');
    if (date_from) query = query.gte('posted_at', date_from);
    if (date_to) query = query.lt('posted_at', date_to);
    if (technology) {
      const tech = String(technology).replace(/[,()%{}*]/g, ' ').trim();
      if (tech) query = query.or(`title.ilike.%${tech}%,description.ilike.%${tech}%`);
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
  let query = getDb()
    .from('applications')
    .select('*, candidates(name, technology, country, experience_years)')
    .eq('user_id', req.user.id);
  if (candidate_id) query = query.eq('candidate_id', String(candidate_id));
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.delete('/api/applications/:id', authenticate, async (req: any, res) => {
  const { error } = await getDb()
    .from('applications')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: 1 });
});

app.post('/api/applications/bulk-delete', authenticate, async (req: any, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const { error } = await getDb()
    .from('applications')
    .delete()
    .in('id', ids)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: ids.length });
});

app.post('/api/applications/analyse', authenticate, async (req: any, res) => {
  try {
    const { candidate_id, results } = req.body;
    if (!candidate_id || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'candidate_id and results array required' });
    }
    const db = getDb();
    const records = results.map((r: any) => ({
      user_id: req.user.id,
      candidate_id,
      job_id: String(r.job_id),
      status: r.status,
      score: r.score ?? null,
      skill_match_score: r.skill_match_score ?? null,
      experience_score: r.experience_score ?? null,
      location_score: r.location_score ?? null,
      reasons: r.reasons ?? [],
      job_title: r.job_title ?? null,
      job_company: r.job_company ?? null,
      job_location: r.job_location ?? null,
      job_url: r.job_url ?? null
    }));
    const { error } = await db
      .from('applications')
      .upsert(records, { onConflict: 'candidate_id,job_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ saved: records.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save analysis: ' + err.message });
  }
});

// ─── AI ANALYSIS ───────────────────────────────────────────────────────────────

app.post('/api/ai/analyse', authenticate, async (req: any, res) => {
  try {
    const { candidate, jobs } = req.body;
    if (!candidate || !Array.isArray(jobs) || jobs.length === 0) return res.json({ scores: [] });

    const truncatedJobs = jobs.slice(0, 50);
    const jobList = truncatedJobs.map((j: any, i: number) => {
      const skills = Array.isArray(j.skills) ? j.skills.join(', ') : '';
      const location = j.is_remote ? 'Remote' : `${j.location || ''} ${j.country || ''}`.trim();
      return [
        `--- JOB ${i} ---`,
        `Title: ${j.title}`,
        `Company: ${j.company}`,
        `Location: ${location || 'Not specified'}`,
        `Required Skills: ${skills || 'Not listed'}`,
        `Description: ${(j.description || 'No description').substring(0, 600)}`,
      ].join('\n');
    }).join('\n\n');

    const companies = sanitize((candidate.companies_worked || []).join(', ') || 'none', 500);
    const tech = sanitize(candidate.technology);
    const country = sanitize(candidate.country);
    const expYears = parseInt(candidate.experience_years) || 0;

    const prompt = `You are an expert technical recruiter. Carefully evaluate whether this candidate is a genuine match for each job listed.

=== CANDIDATE PROFILE ===
Primary Technology / Domain: ${tech}
Total Work Experience: ${expYears} years
Location / Country: ${country}
Previous Employers: ${companies}

=== JOBS TO EVALUATE ===
${jobList}

=== YOUR TASK ===
For EACH job (index 0 to ${truncatedJobs.length - 1}), evaluate the candidate honestly and return:

- skillMatchScore (0–100): How well does the candidate's domain and skillset align with what the job PRIMARILY requires?
  • Base this on the job's CORE requirements, NOT incidental keyword overlap.
  • Example: A Python/Data Science/ML candidate is NOT a match for a Cloud DevOps/Kubernetes role just because the job description mentions Python once.
  • If the candidate's primary domain (${tech}) doesn't match the job's primary domain, score LOW (under 40).

- experienceScore (0–100): Does the candidate's experience level fit?
  • 100 = perfect fit. 0 = massive gap.
  • Only infer required years from EXPLICIT statements in the description (e.g. "5+ years required") or very clear title signals (Senior = ~5 yrs, Junior = 0–2 yrs).
  • Do NOT invent experience requirements. If nothing is stated or implied, score 70 (neutral).

- locationScore (0–100):
  • 100 = remote job, or candidate's country matches job location.
  • 50 = international but job mentions visa sponsorship.
  • 0 = location mismatch with no sponsorship mentioned.
  Candidate is in: ${country}

- suitable (true/false): Is this genuinely a good match overall?
  • true only if skillMatchScore >= 60 AND no disqualifying issues.

- reasons (string array): For unsuitable or borderline jobs only — state SPECIFIC, FACTUAL reasons.
  • Good: "Job primarily requires Azure/Kubernetes/DevOps; candidate's background is Python/Data Science/ML"
  • Good: "Job explicitly requires 5+ years cloud architecture experience; candidate has ${expYears} years"
  • Bad: Do NOT invent experience requirements not stated in the job description
  • Empty array [] if the job is a genuine match.

Return ONLY a valid JSON array, one object per job, in index order:
[{"index":0,"suitable":true,"skillMatchScore":80,"experienceScore":70,"locationScore":100,"reasons":[]}, ...]`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 90000)
    );

    let response: any;
    try {
      response = await Promise.race([
        getAI().models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.1 }
        }),
        timeoutPromise
      ]);
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        return res.status(408).json({ error: 'Analysis timed out after 90 seconds. Try selecting fewer jobs or a narrower date range.' });
      }
      throw err;
    }

    let scores: any[] = [];
    try {
      const parsed = JSON.parse(response.text || '[]');
      scores = Array.isArray(parsed) ? parsed : [];
    } catch {
      return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
    }

    if (scores.length === 0) {
      return res.status(500).json({ error: 'AI returned empty results. Please try again.' });
    }

    res.json({ scores });
  } catch (err: any) {
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

export default app;
