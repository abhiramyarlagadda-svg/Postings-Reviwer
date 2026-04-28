export interface Candidate {
  id: string;
  name: string;
  email?: string;
  technology: string;
  country: string;
  experience_years: number;
  companies_worked?: string[];
  resume_url?: string | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  country?: string;
  description?: string;
  experience_level?: string;
  skills?: string[];
  tags?: string[];
  is_remote?: boolean;
  posted_at?: string;
  url?: string;
}

export interface JobResult {
  job: Job;
  suitable: boolean;
  reasons: string[];
  skillMatchScore: number;
  experienceScore: number;
  locationScore: number;
  overallScore: number;
}

// Map a free-form experience_level string to required years (rough estimate)
function inferRequiredYears(level?: string): number {
  if (!level) return 0;
  const l = level.toLowerCase();
  if (/(intern|fresher|entry|junior|0\s*-\s*1|0-2)/.test(l)) return 1;
  if (/(mid|intermediate|2\s*-\s*5|3\s*-\s*5)/.test(l)) return 3;
  if (/(senior|sr\.?\s|5\+|5\s*-\s*8)/.test(l)) return 6;
  if (/(lead|principal|staff|architect|10\+|director)/.test(l)) return 10;
  const m = l.match(/(\d+)\s*\+?\s*year/);
  if (m) return parseInt(m[1]);
  return 0;
}

// Visa sponsorship is not a column in the schema — derive from description/tags
function inferVisaSponsorship(job: Job): boolean {
  const text = `${job.description || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  if (/no\s+(visa|sponsorship)/.test(text)) return false;
  if (/(visa\s+sponsor|will\s+sponsor|sponsorship\s+available|h1b|h-1b)/.test(text)) return true;
  return false;
}

function locationMatches(candidateCountry: string, job: Job): boolean {
  if (job.is_remote) return true;
  const c = (candidateCountry || '').toLowerCase().trim();
  if (!c) return false;
  const loc = `${job.location || ''} ${job.country || ''}`.toLowerCase();
  if (loc.includes('remote')) return true;
  return loc.includes(c);
}

export function applyRedFlagRules(candidate: Candidate, job: Job): { suitable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let suitable = true;

  // 1. Same Company Conflict
  const companies = Array.isArray(candidate.companies_worked) ? candidate.companies_worked : [];
  const jobCompany = (job.company || '').toLowerCase().trim();
  if (jobCompany && companies.some(c => {
    const cc = (c || '').toLowerCase().trim();
    return cc && (cc === jobCompany || cc.includes(jobCompany) || jobCompany.includes(cc));
  })) {
    reasons.push('Candidate previously worked at this company');
    suitable = false;
  }

  // 2. Experience Mismatch
  const requiredYears = inferRequiredYears(job.experience_level);
  if (requiredYears > 0 && candidate.experience_years < requiredYears - 2) {
    reasons.push(`Experience required (${job.experience_level}) is higher than candidate profile (${candidate.experience_years} yrs)`);
    suitable = false;
  }

  // 3 & 4. Location / visa
  const locationOk = locationMatches(candidate.country, job);
  if (!locationOk) {
    const hasVisa = inferVisaSponsorship(job);
    if (!hasVisa) {
      reasons.push('Location mismatch and no visa sponsorship indicated');
      suitable = false;
    } else {
      reasons.push('Location mismatch (visa sponsorship may be available)');
    }
  }

  return { suitable, reasons };
}

export function calculateScores(candidate: Candidate, job: Job, skillMatchScore: number): JobResult {
  const { suitable, reasons } = applyRedFlagRules(candidate, job);

  const requiredYears = inferRequiredYears(job.experience_level);
  const experienceScore = requiredYears === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((candidate.experience_years / requiredYears) * 100)));

  const locOk = locationMatches(candidate.country, job);
  const locationScore = locOk ? 100 : (inferVisaSponsorship(job) ? 50 : 0);

  const overallScore = Math.round((skillMatchScore + experienceScore + locationScore) / 3);

  return {
    job,
    suitable,
    reasons,
    skillMatchScore: Math.round(skillMatchScore),
    experienceScore,
    locationScore,
    overallScore
  };
}

export function sortResults(results: JobResult[]): JobResult[] {
  return [...results].sort((a, b) => {
    if (a.suitable !== b.suitable) return a.suitable ? -1 : 1;
    if (a.overallScore !== b.overallScore) return b.overallScore - a.overallScore;
    const aDate = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
    const bDate = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
    return bDate - aDate;
  });
}
