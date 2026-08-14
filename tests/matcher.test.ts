import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../src/core/defaults";
import { makeFingerprint, parseEducation, parseSalary } from "../src/core/jobParser";
import { scoreJob } from "../src/core/matcher";
import type { JobRecord, ResumeProfile } from "../src/core/types";

const profile: ResumeProfile = {
  version: 1,
  extractedAt: "2026-08-14T00:00:00.000Z",
  targetRoles: ["前端开发工程师"],
  skills: [{ name: "React" }, { name: "TypeScript" }, { name: "Node.js" }],
  yearsExperience: 4,
  education: "本科",
  industries: ["互联网"],
  projectKeywords: ["数据可视化"],
  locations: ["上海"],
  salary: { minK: 20, maxK: 35 },
  highlights: ["主导数据可视化平台建设，首屏速度提升40%"]
};

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  const job: JobRecord = {
    fingerprint: "",
    url: "https://www.zhipin.com/job_detail/example.html",
    title: "高级前端开发工程师",
    company: "示例科技有限公司",
    location: "上海浦东新区",
    salaryText: "22-35K·14薪",
    salary: parseSalary("22-35K·14薪"),
    experienceText: "3-5年",
    education: parseEducation("本科"),
    tags: ["React", "TypeScript"],
    description: "互联网数据可视化平台，使用 React、TypeScript 和 Node.js",
    activityText: "今日活跃",
    source: "paste",
    firstSeenAt: "2026-08-14T00:00:00.000Z",
    lastSeenAt: "2026-08-14T00:00:00.000Z",
    ...overrides
  };
  job.fingerprint = makeFingerprint(job);
  return job;
}

describe("matching engine", () => {
  it("scores a strongly matching job as high and explains the result", () => {
    const result = scoreJob(profile, makeJob(), DEFAULT_PREFERENCES);
    expect(result.status).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.reasons.some((reason) => reason.includes("技能"))).toBe(true);
    expect(result.greetingDraft.length).toBeGreaterThanOrEqual(60);
    expect(result.greetingDraft.length).toBeLessThanOrEqual(100);
    expect(result.greetingDraft).toContain("React");
  });

  it("applies explicit company exclusions as a hard filter", () => {
    const result = scoreJob(profile, makeJob(), {
      ...DEFAULT_PREFERENCES,
      excludedCompanies: ["示例科技"]
    });
    expect(result.status).toBe("filtered");
    expect(result.gaps).toContain("公司命中排除名单");
  });

  it("renormalizes available factors instead of penalizing missing fields", () => {
    const minimalProfile = { ...profile, skills: [], industries: [], projectKeywords: [], locations: [], salary: undefined, yearsExperience: undefined };
    const job = makeJob({ description: "", tags: [], location: undefined, salary: undefined, salaryText: undefined, experienceText: undefined, activityText: undefined });
    const result = scoreJob(minimalProfile, job, DEFAULT_PREFERENCES);
    expect(result.score).toBe(100);
    expect(result.status).toBe("high");
  });
});
