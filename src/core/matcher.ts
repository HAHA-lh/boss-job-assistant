import { educationRank, parseExperienceRange } from "./jobParser";
import { generateGreeting } from "./greeting";
import type {
  JobRecord,
  MatchFactor,
  MatchPreferences,
  MatchResult,
  MatchWeights,
  ResumeProfile
} from "./types";

const FACTOR_LABELS: Record<keyof MatchWeights, string> = {
  skills: "技能",
  role: "目标岗位",
  experience: "经验",
  projectIndustry: "项目/行业",
  location: "地点",
  salary: "薪资",
  activity: "活跃度"
};

const SYNONYM_GROUPS = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["node.js", "nodejs", "node"],
  ["react", "react.js", "reactjs"],
  ["vue", "vue.js", "vuejs"],
  ["golang", "go语言", "go"],
  ["spring boot", "springboot"],
  ["kubernetes", "k8s"],
  ["postgresql", "postgres"],
  ["机器学习", "machine learning", "ml"],
  ["大模型", "llm", "生成式ai", "aigc"],
  ["产品经理", "产品管理", "产品设计"],
  ["前端开发", "web前端", "前端工程师"],
  ["后端开发", "服务端开发", "后端工程师"]
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s_\-./·（）()【】\[\],，、;；:：]+/g, "");
}

function aliases(value: string): string[] {
  const normalized = normalize(value);
  const group = SYNONYM_GROUPS.find((items) => items.some((item) => normalize(item) === normalized));
  return group ? group.map(normalize) : [normalized];
}

function includesConcept(haystack: string, needle: string): boolean {
  const normalizedText = normalize(haystack);
  return aliases(needle).some((alias) => alias.length >= 2 && normalizedText.includes(alias));
}

function overlapScore(values: string[], text: string): { score: number; matches: string[] } {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return { score: 0, matches: [] };
  const matches = unique.filter((value) => includesConcept(text, value));
  return { score: matches.length / unique.length, matches };
}

function locationMatch(targets: string[], location?: string): boolean {
  if (!location || targets.length === 0) return false;
  return targets.some((target) => normalize(location).includes(normalize(target)) || normalize(target).includes(normalize(location)));
}

function addFactor(
  factors: MatchFactor[],
  key: keyof MatchWeights,
  available: boolean,
  score: number,
  weight: number,
  detail: string
): void {
  factors.push({ key, label: FACTOR_LABELS[key], available, score: Math.max(0, Math.min(1, score)), weight, detail });
}

function hardFilterReasons(profile: ResumeProfile, job: JobRecord, preferences: MatchPreferences): string[] {
  const reasons: string[] = [];
  const text = `${job.title}\n${job.company}\n${job.description}`;
  if (preferences.excludedCompanies.some((company) => includesConcept(job.company, company))) {
    reasons.push("公司命中排除名单");
  }
  const excluded = preferences.excludedKeywords.find((keyword) => includesConcept(text, keyword));
  if (excluded) reasons.push(`命中排除关键词：${excluded}`);
  if (preferences.jobTypes.length > 0 && !preferences.jobTypes.some((type) => includesConcept(text, type))) {
    reasons.push("岗位类型不符合要求");
  }

  const targetCities = preferences.cities.length > 0 ? preferences.cities : profile.locations;
  if (preferences.hardFilters.requireCity && !locationMatch(targetCities, job.location)) {
    reasons.push(job.location ? "城市不符合硬性要求" : "岗位缺少城市信息");
  }

  const salaryFloor = preferences.salaryFloorK ?? profile.salary?.minK;
  if (preferences.hardFilters.requireSalary && salaryFloor !== undefined) {
    if (!job.salary?.maxK) reasons.push("岗位缺少可解析的薪资信息");
    else if (job.salary.maxK < salaryFloor) reasons.push("岗位薪资低于硬性下限");
  }

  if (preferences.hardFilters.requireEducation) {
    const profileRank = educationRank(profile.education);
    const requiredRank = educationRank(job.education);
    if (requiredRank !== undefined && (profileRank === undefined || profileRank < requiredRank)) {
      reasons.push("学历不符合硬性要求");
    }
  }

  if (preferences.hardFilters.requireExperience) {
    const range = parseExperienceRange(job.experienceText);
    if (range?.min !== undefined && (profile.yearsExperience === undefined || profile.yearsExperience < range.min)) {
      reasons.push("工作年限不符合硬性要求");
    }
  }
  return reasons;
}

function detectRisks(job: JobRecord): string[] {
  const text = `${job.title}\n${job.company}\n${job.description}`;
  const rules: Array<[RegExp, string]> = [
    [/培训贷|付费培训|先交费|押金|保证金/, "疑似收费或培训风险"],
    [/劳务派遣|人力外包|驻场外包|外包项目/, "可能是派遣或外包岗位"],
    [/薪资面议|上不封顶|轻松月入|日结高薪/, "薪资描述需要进一步核实"],
    [/招聘助理.*销售|储备干部.*销售/, "岗位名称与职责可能不一致"]
  ];
  return rules.filter(([rule]) => rule.test(text)).map(([, label]) => label);
}

export function scoreJob(profile: ResumeProfile, job: JobRecord, preferences: MatchPreferences): MatchResult {
  const filtered = hardFilterReasons(profile, job, preferences);
  const factors: MatchFactor[] = [];
  const jobText = `${job.title}\n${job.tags.join(" ")}\n${job.description}`;

  const skillNames = profile.skills.map((skill) => skill.name);
  const skills = overlapScore(skillNames, jobText);
  addFactor(
    factors,
    "skills",
    skillNames.length > 0,
    skills.score,
    preferences.weights.skills,
    skills.matches.length > 0 ? `匹配 ${skills.matches.join("、")}` : "未识别到技能交集"
  );

  const roles = overlapScore(profile.targetRoles, job.title);
  addFactor(
    factors,
    "role",
    profile.targetRoles.length > 0,
    roles.score,
    preferences.weights.role,
    roles.matches.length > 0 ? `岗位名称匹配 ${roles.matches.join("、")}` : "岗位名称与目标方向重合较少"
  );

  const experienceRange = parseExperienceRange(job.experienceText);
  let experienceScore = 0;
  let experienceDetail = "岗位未提供经验要求";
  let experienceAvailable = profile.yearsExperience !== undefined && experienceRange !== undefined;
  if (experienceAvailable) {
    if (experienceRange?.min === undefined) {
      experienceScore = 1;
      experienceDetail = "岗位经验不限";
    } else {
      const gap = experienceRange.min - (profile.yearsExperience || 0);
      experienceScore = gap <= 0 ? 1 : gap <= 1 ? 0.65 : 0.15;
      experienceDetail = gap <= 0 ? "工作年限满足要求" : `距最低年限约差 ${gap} 年`;
    }
  }
  addFactor(factors, "experience", experienceAvailable, experienceScore, preferences.weights.experience, experienceDetail);

  const projectTerms = [...profile.industries, ...profile.projectKeywords];
  const project = overlapScore(projectTerms, jobText);
  addFactor(
    factors,
    "projectIndustry",
    projectTerms.length > 0,
    project.score,
    preferences.weights.projectIndustry,
    project.matches.length > 0 ? `相关经历：${project.matches.slice(0, 3).join("、")}` : "项目或行业关键词重合较少"
  );

  const targetCities = preferences.cities.length > 0 ? preferences.cities : profile.locations;
  const cityMatched = locationMatch(targetCities, job.location);
  addFactor(
    factors,
    "location",
    targetCities.length > 0 && Boolean(job.location),
    cityMatched ? 1 : 0,
    preferences.weights.location,
    cityMatched ? `地点匹配 ${job.location}` : "地点不匹配"
  );

  const salaryFloor = preferences.salaryFloorK ?? profile.salary?.minK;
  let salaryScore = 0;
  if (salaryFloor !== undefined && job.salary?.maxK !== undefined) {
    salaryScore = job.salary.maxK >= salaryFloor
      ? (job.salary.minK !== undefined && job.salary.minK >= salaryFloor ? 1 : 0.75)
      : 0;
  }
  addFactor(
    factors,
    "salary",
    salaryFloor !== undefined && job.salary?.maxK !== undefined,
    salaryScore,
    preferences.weights.salary,
    salaryFloor === undefined ? "未设置薪资期望" : salaryScore > 0 ? "薪资范围与期望有交集" : "薪资低于期望"
  );

  const activityText = job.activityText || "";
  const activityScore = /在线|刚刚活跃|今日活跃/.test(activityText) ? 1 : /本周活跃|活跃/.test(activityText) ? 0.7 : 0;
  addFactor(
    factors,
    "activity",
    Boolean(activityText),
    activityScore,
    preferences.weights.activity,
    activityText || "未显示活跃信息"
  );

  const available = factors.filter((factor) => factor.available && factor.weight > 0);
  const availableWeight = available.reduce((sum, factor) => sum + factor.weight, 0);
  const weighted = available.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const score = availableWeight > 0 ? Math.round((weighted / availableWeight) * 100) : 0;
  const status = filtered.length > 0
    ? "filtered"
    : score >= preferences.threshold
      ? "high"
      : score >= preferences.threshold - 10
        ? "review"
        : "hidden";

  const rankedFactors = [...available].sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
  const reasons = rankedFactors.filter((factor) => factor.score >= 0.6).slice(0, 4).map((factor) => `${factor.label}：${factor.detail}`);
  const gaps = [
    ...filtered,
    ...available.filter((factor) => factor.score < 0.5).slice(0, 3).map((factor) => `${factor.label}：${factor.detail}`)
  ];
  const matchedFacts = [
    skills.matches.length > 0 ? `熟悉${skills.matches.slice(0, 3).join("、")}` : "",
    project.matches.length > 0 ? `有${project.matches.slice(0, 2).join("、")}相关经历` : ""
  ].filter(Boolean);

  const result: MatchResult = {
    fingerprint: job.fingerprint,
    score,
    status,
    reasons,
    gaps,
    risks: detectRisks(job),
    matchedFacts,
    greetingDraft: "",
    factors
  };
  result.greetingDraft = generateGreeting(profile, job, matchedFacts);
  return result;
}

export function scoreAndRankJobs(profile: ResumeProfile, jobs: JobRecord[], preferences: MatchPreferences): MatchResult[] {
  const results = jobs.map((job) => scoreJob(profile, job, preferences));
  const high = results.filter((result) => result.status === "high").sort((a, b) => b.score - a.score);
  high.slice(preferences.dailyLimit).forEach((result) => {
    result.status = "hidden";
    result.gaps.push("超过今日高匹配候选上限");
  });
  return results.sort((a, b) => {
    const statusOrder = { high: 0, review: 1, hidden: 2, filtered: 3 };
    return statusOrder[a.status] - statusOrder[b.status] || b.score - a.score;
  });
}
