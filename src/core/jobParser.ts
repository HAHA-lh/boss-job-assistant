import type { EducationLevel, JobRecord, SalaryRange } from "./types";
import { cleanList, sanitizeSensitive } from "./privacy";

const EDUCATION_ORDER: EducationLevel[] = ["未知", "不限", "高中", "中专", "大专", "本科", "硕士", "博士"];

export function parseEducation(text?: string): EducationLevel {
  if (!text) return "未知";
  for (const level of ["博士", "硕士", "本科", "大专", "中专", "高中"] as EducationLevel[]) {
    if (text.includes(level)) return level;
  }
  if (/学历不限|不限学历|经验不限/.test(text)) return "不限";
  return "未知";
}

export function educationRank(level?: EducationLevel): number | undefined {
  if (!level || level === "未知" || level === "不限") return undefined;
  return EDUCATION_ORDER.indexOf(level);
}

function salaryUnitToK(value: number, unit: string): number {
  if (/万|w/i.test(unit)) return value * 10;
  return value;
}

export function parseSalary(text?: string): SalaryRange | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s/g, "");
  const match = clean.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*([Kk万Ww])/);
  if (!match) return undefined;
  const minK = salaryUnitToK(Number(match[1]), match[3]);
  const maxK = salaryUnitToK(Number(match[2]), match[3]);
  const monthsMatch = clean.match(/[·x×*](\d{2})薪/);
  return { minK, maxK, months: monthsMatch ? Number(monthsMatch[1]) : undefined };
}

export function parseExperienceRange(text?: string): { min?: number; max?: number } | undefined {
  if (!text) return undefined;
  if (/经验不限|不限经验|应届|在校/.test(text)) return {};
  const range = text.match(/(\d+)\s*[-~—至]\s*(\d+)\s*年/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const min = text.match(/(\d+)\s*年(?:以上|\+)/);
  if (min) return { min: Number(min[1]) };
  const single = text.match(/(?:经验)?\s*(\d+)\s*年/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : undefined;
}

export function makeFingerprint(job: Pick<JobRecord, "url" | "title" | "company" | "location" | "salaryText">): string {
  const canonicalUrl = job.url?.split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
  const input = canonicalUrl || [job.title, job.company, job.location, job.salaryText]
    .map((part) => (part || "").toLowerCase().replace(/\s+/g, ""))
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `job_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function pickFirst(lines: string[], matcher: RegExp): string | undefined {
  return lines.find((line) => matcher.test(line));
}

export function parsePastedJobs(text: string, now = new Date()): JobRecord[] {
  const blocks = text
    .split(/\n\s*(?:---+|===+)\s*\n|\n{3,}/)
    .map((block) => sanitizeSensitive(block).trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const url = pickFirst(lines, /^https?:\/\//i);
    const salaryText = pickFirst(lines, /\d+(?:\.\d+)?\s*[-~—至]\s*\d+(?:\.\d+)?\s*[Kk万Ww]/);
    const experienceText = pickFirst(lines, /(?:经验不限|应届|在校|\d+\s*(?:[-~—至]\s*\d+)?\s*年)/);
    const educationLine = pickFirst(lines, /(博士|硕士|本科|大专|中专|高中|学历不限|不限学历)/);
    const locationLine = pickFirst(lines, /(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|重庆|天津|长沙|厦门|青岛|郑州|合肥|宁波|东莞|佛山)/);
    const companyLine = lines.find((line, lineIndex) => lineIndex > 0 && /(?:公司|集团|科技|网络|信息|有限|工作室|事务所)/.test(line));
    const title = (lines[0] || `未命名岗位 ${index + 1}`).replace(/^职位[:：]\s*/, "").slice(0, 80);
    const company = (companyLine || lines[1] || "未知公司").replace(/^公司[:：]\s*/, "").slice(0, 80);
    const tagsLine = lines.find((line) => /^(?:技能|标签|关键词)[:：]/.test(line));
    const record: JobRecord = {
      fingerprint: "",
      url,
      title,
      company,
      location: locationLine?.replace(/^地点[:：]\s*/, ""),
      salaryText,
      salary: parseSalary(salaryText),
      experienceText,
      education: parseEducation(educationLine),
      tags: tagsLine ? cleanList(tagsLine.replace(/^[^:：]+[:：]/, "").split(/[,，、\s]+/), 20) : [],
      description: block.slice(0, 8000),
      activityText: pickFirst(lines, /(刚刚活跃|今日活跃|本周活跃|在线|活跃)/),
      source: "paste",
      firstSeenAt: now.toISOString(),
      lastSeenAt: now.toISOString()
    };
    record.fingerprint = makeFingerprint(record);
    return record;
  });
}
