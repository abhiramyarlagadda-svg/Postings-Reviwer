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

// Map a free-form experience_level string (or job title/description) to required years
function inferRequiredYears(level?: string, title?: string, description?: string): number {
  const checkText = (text: string): number => {
    const l = text.toLowerCase();
    if (/(intern|fresher|entry[\s-]level|junior|graduate|trainee|0\s*-\s*[12]\s*year|0-2)/.test(l)) return 1;
    if (/(mid[\s-]level|intermediate|associate|2\s*-\s*[45]\s*year|3\s*-\s*5)/.test(l)) return 3;
    if (/(senior|sr\.[\s,]|5\+\s*year|5\s*-\s*[89]\s*year|experienced)/.test(l)) return 5;
    if (/(lead|principal|staff\s+engineer|architect|10\+|director|head\s+of|vp\s+of|8\+\s*year|7\+\s*year)/.test(l)) return 8;
    const rangeMatch = l.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:year|yr)/);
    if (rangeMatch) return parseInt(rangeMatch[1]);
    const plusMatch = l.match(/(\d+)\s*\+\s*(?:year|yr)/);
    if (plusMatch) return parseInt(plusMatch[1]);
    return 0;
  };

  if (level) {
    const r = checkText(level);
    if (r > 0) return r;
  }
  if (title) {
    const r = checkText(title);
    if (r > 0) return r;
  }
  if (description) {
    const snippet = description.substring(0, 500);
    const r = checkText(snippet);
    if (r > 0) return r;
  }
  return 0;
}

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

  // 1. Same company conflict
  const companies = Array.isArray(candidate.companies_worked) ? candidate.companies_worked : [];
  const jobCompany = (job.company || '').toLowerCase().trim();
  if (jobCompany && companies.some(c => {
    const cc = (c || '').toLowerCase().trim();
    return cc && (cc === jobCompany || cc.includes(jobCompany) || jobCompany.includes(cc));
  })) {
    reasons.push(`Candidate previously worked at ${job.company} — company conflict`);
    suitable = false;
  }

  // 2. Experience checks
  const requiredYears = inferRequiredYears(job.experience_level, job.title, job.description);
  if (requiredYears > 0) {
    const levelSource = job.experience_level || job.title || 'job description';
    const gap = requiredYears - candidate.experience_years;
    if (gap > 2) {
      reasons.push(`Significant experience gap — job requires ~${requiredYears} yrs (inferred from: ${levelSource}), candidate has ${candidate.experience_years} yrs`);
      suitable = false;
    } else if (gap > 0) {
      reasons.push(`Slightly below experience requirement — needs ~${requiredYears} yrs (inferred from: ${levelSource}), candidate has ${candidate.experience_years} yrs`);
    }
  }

  // 3. Location / visa
  const locationOk = locationMatches(candidate.country, job);
  if (!locationOk) {
    const hasVisa = inferVisaSponsorship(job);
    const jobLoc = job.location || job.country || 'a different location';
    if (!hasVisa) {
      reasons.push(`Location mismatch — candidate is in ${candidate.country}, job is in ${jobLoc} with no visa sponsorship`);
      suitable = false;
    } else {
      reasons.push(`Location mismatch — candidate is in ${candidate.country}, job is in ${jobLoc} (visa sponsorship may be available)`);
    }
  }

  return { suitable, reasons };
}

export function calculateScores(candidate: Candidate, job: Job, skillMatchScore: number): JobResult {
  const { suitable: rulesSuitable, reasons } = applyRedFlagRules(candidate, job);
  let suitable = rulesSuitable;

  const requiredYears = inferRequiredYears(job.experience_level, job.title, job.description);
  const experienceScore = requiredYears === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((candidate.experience_years / requiredYears) * 100)));

  const locOk = locationMatches(candidate.country, job);
  const locationScore = locOk ? 100 : (inferVisaSponsorship(job) ? 50 : 0);

  // 4. Low skill match from AI — always evaluated and added if low
  if (skillMatchScore < 60) {
    const jobSkills = Array.isArray(job.skills) && job.skills.length > 0
      ? ` (requires: ${job.skills.slice(0, 5).join(', ')})`
      : '';
    reasons.push(`Low skill match — AI scored ${skillMatchScore}% alignment${jobSkills}`);
    if (skillMatchScore < 40) suitable = false;
  }

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
