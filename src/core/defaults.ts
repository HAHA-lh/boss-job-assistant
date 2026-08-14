import type { MatchPreferences, ResumeProfile } from "./types";

export const DEFAULT_PREFERENCES: MatchPreferences = {
  cities: [],
  excludedCompanies: [],
  excludedKeywords: ["培训贷", "收费入职", "押金"],
  jobTypes: [],
  weights: {
    skills: 30,
    role: 25,
    experience: 15,
    projectIndustry: 10,
    location: 8,
    salary: 7,
    activity: 5
  },
  threshold: 75,
  dailyLimit: 20,
  dedupeDays: 30,
  retentionDays: 90,
  hardFilters: {
    requireCity: false,
    requireSalary: false,
    requireEducation: false,
    requireExperience: false
  },
  reminderEnabled: true,
  reminderTime: "09:00",
  dailyEntryUrl: "https://www.zhipin.com/web/geek/job"
};

export const EMPTY_PROFILE: ResumeProfile = {
  version: 1,
  extractedAt: new Date(0).toISOString(),
  targetRoles: [],
  skills: [],
  education: "未知",
  industries: [],
  projectKeywords: [],
  locations: [],
  highlights: []
};

export const STORAGE_KEYS = {
  profile: "resumeProfile",
  preferences: "matchPreferences",
  consent: "pageConsent",
  candidates: "currentCandidates"
} as const;
