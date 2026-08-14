import * as pdfjs from "pdfjs-dist";
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import mammoth from "mammoth/mammoth.browser";
import { parseEducation, parseSalary } from "./jobParser";
import { cleanList, sanitizeSensitive, splitList } from "./privacy";
import type { ResumeProfile, ResumeSkill } from "./types";

type PromiseWithResolvers = PromiseConstructor & {
  withResolvers?<T>(): {
    promise: Promise<T>;
    resolve(value: T | PromiseLike<T>): void;
    reject(reason?: unknown): void;
  };
};

const promiseConstructor = Promise as PromiseWithResolvers;
if (!promiseConstructor.withResolvers) {
  promiseConstructor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });
    return { promise, resolve, reject };
  };
}

// Chrome extension pages can reject PDF.js' dynamic worker-module fallback in
// some browser builds. Register the packaged worker handler in the same local
// script so PDF.js uses its supported in-process fallback without fetching an
// additional extension resource.
const pdfjsGlobal = globalThis as typeof globalThis & {
  pdfjsWorker?: typeof pdfjsWorker;
};
pdfjsGlobal.pdfjsWorker = pdfjsWorker;

const SKILL_DICTIONARY = [
  "Java", "JavaScript", "TypeScript", "Python", "Golang", "Go", "C++", "C#", ".NET", "PHP", "Rust",
  "React", "Vue", "Angular", "Node.js", "Spring", "Spring Boot", "Django", "Flask", "FastAPI", "MySQL",
  "PostgreSQL", "Redis", "MongoDB", "Elasticsearch", "Kafka", "Docker", "Kubernetes", "Linux", "AWS",
  "Azure", "阿里云", "Git", "微服务", "分布式", "数据分析", "SQL", "Excel", "Power BI", "Tableau",
  "机器学习", "深度学习", "大模型", "LLM", "NLP", "计算机视觉", "产品设计", "用户研究", "项目管理",
  "增长", "运营", "新媒体", "SEO", "SEM", "销售", "招聘", "绩效", "财务分析", "审计"
];

const INDUSTRY_DICTIONARY = [
  "互联网", "人工智能", "电子商务", "金融", "银行", "证券", "游戏", "教育", "医疗", "制造业", "汽车",
  "物流", "零售", "新能源", "房地产", "企业服务", "消费品", "文化传媒", "广告", "咨询"
];

const CITY_DICTIONARY = [
  "北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "苏州", "西安", "重庆", "天津",
  "长沙", "厦门", "青岛", "郑州", "合肥", "宁波", "东莞", "佛山", "无锡", "珠海", "济南"
];

async function extractPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

async function extractDocx(file: File): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function extractResumeText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  let text: string;
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdf(file);
  } else if (lower.endsWith(".docx") || file.type.includes("officedocument.wordprocessingml")) {
    text = await extractDocx(file);
  } else {
    throw new Error("仅支持 PDF 或 DOCX 文件；旧版 .doc 请先另存为 DOCX。");
  }
  const sanitized = sanitizeSensitive(text);
  if (sanitized.replace(/\s/g, "").length < 30) {
    throw new Error("未提取到足够文字。该文件可能是扫描件、图片型或加密 PDF，请改用 DOCX 或粘贴文本。");
  }
  return sanitized;
}

function extractLabeledValues(lines: string[], labels: RegExp): string[] {
  const matches: string[] = [];
  for (const line of lines) {
    if (!labels.test(line)) continue;
    const value = line.replace(labels, "").replace(/^\s*[:：-]\s*/, "").trim();
    if (value) matches.push(...splitList(value));
  }
  return matches;
}

function findSkills(text: string): ResumeSkill[] {
  const lower = text.toLowerCase();
  return cleanList(SKILL_DICTIONARY.filter((skill) => lower.includes(skill.toLowerCase())), 40)
    .map((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const years = text.match(new RegExp(`${escaped}[^。；;\\n]{0,16}?(\\d+(?:\\.\\d+)?)\\s*年`, "i"));
      return { name, years: years ? Number(years[1]) : undefined };
    });
}

function extractHighlights(lines: string[]): string[] {
  const candidates = lines.filter((line) => {
    if (line.length < 16 || line.length > 110) return false;
    return /(负责|主导|参与|完成|实现|优化|提升|降低|搭建|设计|开发|增长|节省|项目)/.test(line);
  });
  return cleanList(candidates, 8);
}

export function extractProfileFromText(text: string, sourceName?: string): ResumeProfile {
  const sanitized = sanitizeSensitive(text);
  const lines = sanitized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const targetRoles = cleanList(extractLabeledValues(lines, /^(?:求职意向|期望职位|目标岗位|意向岗位)/), 10);
  const locations = cleanList([
    ...extractLabeledValues(lines, /^(?:期望城市|目标城市|工作地点)/),
    ...CITY_DICTIONARY.filter((city) => lines.some((line) => /期望|意向|地点/.test(line) && line.includes(city)))
  ], 10);
  const yearsMatch = sanitized.match(/(\d+(?:\.\d+)?)\s*年(?:以上)?(?:工作|从业)?经验/);
  const salaryLine = lines.find((line) => /期望薪资|薪资期望/.test(line));
  const projectLines = lines.filter((line) => /项目|系统|平台|产品|模型|方案/.test(line) && line.length <= 80);

  return {
    version: 1,
    sourceName,
    extractedAt: new Date().toISOString(),
    targetRoles,
    skills: findSkills(sanitized),
    yearsExperience: yearsMatch ? Number(yearsMatch[1]) : undefined,
    education: parseEducation(sanitized),
    industries: cleanList(INDUSTRY_DICTIONARY.filter((industry) => sanitized.includes(industry)), 12),
    projectKeywords: cleanList(projectLines.flatMap((line) => line.split(/[、，,；;\s]/)).filter((item) => item.length >= 2 && item.length <= 16), 20),
    locations,
    salary: parseSalary(salaryLine),
    highlights: extractHighlights(lines)
  };
}

export async function parseResumeFile(file: File): Promise<ResumeProfile> {
  const text = await extractResumeText(file);
  return extractProfileFromText(text, file.name);
}
