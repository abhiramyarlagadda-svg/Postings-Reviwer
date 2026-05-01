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

export interface AiScore {
  index: number;
  suitable: boolean;
  skillMatchScore: number;
  experienceScore: number;
  locationScore: number;
  reasons: string[];
}

export function calculateScores(candidate: Candidate, job: Job, aiScore: AiScore): JobResult {
  const reasons = Array.isArray(aiScore.reasons) ? [...aiScore.reasons] : [];
  let suitable = !!aiScore.suitable;

  // Company conflict — reliable rule-based check kept client-side
  const companies = Array.isArray(candidate.companies_worked) ? candidate.companies_worked : [];
  const jobCompany = (job.company || '').toLowerCase().trim();
  if (jobCompany && companies.some(c => {
    const cc = (c || '').toLowerCase().trim();
    return cc && (cc === jobCompany || cc.includes(jobCompany) || jobCompany.includes(cc));
  })) {
    reasons.unshift(`Candidate previously worked at ${job.company} — company conflict`);
    suitable = false;
  }

  const skillMatchScore  = Math.round(Math.max(0, Math.min(100, aiScore.skillMatchScore  ?? 50)));
  const experienceScore  = Math.round(Math.max(0, Math.min(100, aiScore.experienceScore  ?? 50)));
  const locationScore    = Math.round(Math.max(0, Math.min(100, aiScore.locationScore    ?? 50)));
  const overallScore     = Math.round((skillMatchScore + experienceScore + locationScore) / 3);

  return { job, suitable, reasons, skillMatchScore, experienceScore, locationScore, overallScore };
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
