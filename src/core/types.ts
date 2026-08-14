export type EducationLevel = "不限" | "高中" | "中专" | "大专" | "本科" | "硕士" | "博士" | "未知";

export interface SalaryRange {
  minK?: number;
  maxK?: number;
  months?: number;
}

export interface ResumeSkill {
  name: string;
  years?: number;
}

export interface ResumeProfile {
  version: 1;
  sourceName?: string;
  extractedAt: string;
  targetRoles: string[];
  skills: ResumeSkill[];
  yearsExperience?: number;
  education: EducationLevel;
  industries: string[];
  projectKeywords: string[];
  locations: string[];
  salary?: SalaryRange;
  highlights: string[];
}

export interface MatchWeights {
  skills: number;
  role: number;
  experience: number;
  projectIndustry: number;
  location: number;
  salary: number;
  activity: number;
}

export interface HardFilterSettings {
  requireCity: boolean;
  requireSalary: boolean;
  requireEducation: boolean;
  requireExperience: boolean;
}

export interface MatchPreferences {
  cities: string[];
  salaryFloorK?: number;
  excludedCompanies: string[];
  excludedKeywords: string[];
  jobTypes: string[];
  weights: MatchWeights;
  threshold: number;
  dailyLimit: number;
  dedupeDays: number;
  retentionDays: number;
  hardFilters: HardFilterSettings;
  reminderEnabled: boolean;
  reminderTime: string;
  dailyEntryUrl: string;
}

export interface JobRecord {
  fingerprint: string;
  url?: string;
  title: string;
  company: string;
  location?: string;
  salaryText?: string;
  salary?: SalaryRange;
  experienceText?: string;
  education?: EducationLevel;
  tags: string[];
  description: string;
  activityText?: string;
  source: "page" | "paste";
  firstSeenAt: string;
  lastSeenAt: string;
}

export type MatchStatus = "high" | "review" | "hidden" | "filtered";

export interface MatchFactor {
  key: keyof MatchWeights;
  label: string;
  available: boolean;
  score: number;
  weight: number;
  detail: string;
}

export interface MatchResult {
  fingerprint: string;
  score: number;
  status: MatchStatus;
  reasons: string[];
  gaps: string[];
  risks: string[];
  matchedFacts: string[];
  greetingDraft: string;
  factors: MatchFactor[];
}

export interface CandidateItem {
  job: JobRecord;
  match: MatchResult;
  selected: boolean;
  approved: boolean;
  copied: boolean;
  sent: boolean;
  replied: boolean;
}

export type ActivityType = "scan" | "shortlisted" | "approved" | "copied" | "sent" | "replied";

export interface ActivityRecord {
  id?: number;
  type: ActivityType;
  timestamp: string;
  fingerprint?: string;
  count: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface PageConsent {
  accepted: boolean;
  acceptedAt?: string;
}

export interface DashboardDay {
  date: string;
  scan: number;
  shortlisted: number;
  approved: number;
  copied: number;
  sent: number;
  replied: number;
}
