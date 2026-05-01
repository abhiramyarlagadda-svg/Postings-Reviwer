import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';
import pdfParse from 'pdf-parse';

// RLS is disabled on all tables so anon key has full access server-side
function getDb() {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
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

// Auth middleware — looks up token in the users table (no JWT, no expiry)
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await getDb().from('users').select('*').eq('token', token).maybeSingle();
  if (error || !data) return res.status(401).json({ error: 'Unauthorized' });

  req.user = data;
  next();
};

// ─── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();

    const { data: existing } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await db
      .from('users')
      .insert({ name: name || email.split('@')[0], email, password: password_hash })
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
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await getDb()
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });

    const isBcrypt = data.password?.startsWith('$2');
    let passwordMatch: boolean;

    if (isBcrypt) {
      passwordMatch = await bcrypt.compare(password, data.password);
    } else {
      // Plain text password (stored before bcrypt was added) — compare directly then upgrade
      passwordMatch = data.password === password;
      if (passwordMatch) {
        const newHash = await bcrypt.hash(password, 10);
        await getDb().from('users').update({ password: newHash }).eq('id', data.id);
      }
    }

    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      user: { id: data.id, name: data.name, email: data.email },
      token: data.token
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
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

app.post('/api/candidates', authenticate, upload.single('resume'), async (req: any, res) => {
  try {
    const { name, email, technology, country, experience_years, companies_worked } = req.body;
    if (!name || !technology || !country) {
      return res.status(400).json({ error: 'Name, technology, and country are required' });
    }

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
    const { date_from, date_to, technology, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = jobsDb.from('jobs').select('*', { count: 'exact' }).eq('status', 'active');

    if (date_from) query = query.gte('posted_at', date_from);
    // date_to is the exclusive upper bound (e.g. pass "2026-05-01" to get only April 30)
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
        `Description: ${(j.description || 'No description').substring(0, 800)}`,
      ].join('\n');
    }).join('\n\n');

    const companies = (candidate.companies_worked || []).join(', ') || 'none';

    // Fetch and parse resume PDF so Gemini sees actual skills, not just profile fields
    let resumeText = '';
    if (candidate.resume_url) {
      try {
        const pdfRes = await fetch(candidate.resume_url);
        if (pdfRes.ok) {
          const buffer = Buffer.from(await pdfRes.arrayBuffer());
          const parsed = await pdfParse(buffer);
          resumeText = (parsed.text || '').trim().substring(0, 4000);
        }
      } catch { /* fall back to profile fields */ }
    }

    const candidateSection = resumeText
      ? `=== CANDIDATE RESUME ===\n${resumeText}`
      : `=== CANDIDATE PROFILE ===
Primary Technology / Domain: ${candidate.technology}
Total Work Experience: ${candidate.experience_years} years
Location / Country: ${candidate.country}
Previous Employers: ${companies}`;

    const prompt = `You are an expert technical recruiter. Carefully evaluate whether this candidate is a genuine match for each job listed.

${candidateSection}
Location / Country: ${candidate.country}
Previous Employers: ${companies}

=== JOBS TO EVALUATE ===
${jobList}

=== YOUR TASK ===
For EACH job (index 0 to ${truncatedJobs.length - 1}), evaluate the candidate honestly and return:

- skillMatchScore (0–100): How well does the candidate's ACTUAL skills (from their resume above) align with what the job PRIMARILY requires?
  • Read the resume carefully — what domain, technologies, and tools does the candidate actually know?
  • Base this on the job's CORE requirements, NOT incidental keyword overlap.
  • Example: A Data Science/ML candidate is NOT a match for a Cloud DevOps role just because the job description mentions Python once.
  • If the candidate's actual domain doesn't match the job's primary domain, score LOW (under 40).

- experienceScore (0–100): Does the candidate's experience level fit?
  • 100 = perfect fit. 0 = massive gap.
  • Only infer required years from EXPLICIT statements in the description (e.g. "5+ years required") or very clear title signals (Senior = ~5 yrs, Junior = 0–2 yrs).
  • Do NOT invent experience requirements. If nothing is stated or implied, score 70 (neutral).

- locationScore (0–100):
  • 100 = remote job, or candidate's country matches job location.
  • 50 = international but job mentions visa sponsorship.
  • 0 = location mismatch with no sponsorship mentioned.
  Candidate is in: ${candidate.country}

- suitable (true/false): Is this genuinely a good match overall?
  • true only if skillMatchScore >= 60 AND no disqualifying issues.

- reasons (string array): For unsuitable or borderline jobs only — state SPECIFIC, FACTUAL reasons based on the candidate's actual resume.
  • Good: "Job primarily requires Azure/Kubernetes/DevOps; candidate's background is Python/Data Science/ML"
  • Good: "Job explicitly requires 5+ years cloud architecture experience; candidate has ${candidate.experience_years} years total"
  • Bad: Do NOT say "requires 8 years" if the job description doesn't state it explicitly
  • Empty array [] if the job is a genuine match.

Return ONLY a valid JSON array, one object per job, in index order:
[{"index":0,"suitable":true,"skillMatchScore":80,"experienceScore":70,"locationScore":100,"reasons":[]}, ...]`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    let scores: any[] = [];
    try {
      scores = JSON.parse(response.text || '[]');
    } catch {
      scores = truncatedJobs.map((_: any, i: number) => ({
        index: i, suitable: false,
        skillMatchScore: 50, experienceScore: 50, locationScore: 50, reasons: []
      }));
    }

    res.json({ scores });
  } catch (err: any) {
    const fallback = (req.body?.jobs || []).map((_: any, i: number) => ({
      index: i, suitable: false,
      skillMatchScore: 50, experienceScore: 50, locationScore: 50, reasons: []
    }));
    res.json({ scores: fallback, warning: err.message });
  }
});

export default app;
