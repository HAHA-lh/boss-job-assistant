import { describe, expect, it } from "vitest";
import { makeFingerprint, parseExperienceRange, parsePastedJobs, parseSalary } from "../src/core/jobParser";
import { extractProfileFromText } from "../src/core/resumeParser";

describe("job and resume parsing", () => {
  it("parses K and 万 salary ranges", () => {
    expect(parseSalary("20-35K·14薪")).toEqual({ minK: 20, maxK: 35, months: 14 });
    expect(parseSalary("2-3万")).toEqual({ minK: 20, maxK: 30, months: undefined });
  });

  it("parses common experience expressions", () => {
    expect(parseExperienceRange("3-5年")).toEqual({ min: 3, max: 5 });
    expect(parseExperienceRange("5年以上")).toEqual({ min: 5 });
    expect(parseExperienceRange("经验不限")).toEqual({});
  });

  it("splits pasted jobs and creates stable fingerprints", () => {
    const jobs = parsePastedJobs(`前端开发工程师\n某某科技有限公司\n上海 20-35K 本科 3-5年\n技能：React、TypeScript\n---\n数据分析师\n示例集团\n杭州 15-25K 本科 1-3年\n技能：SQL、Power BI`);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].salary?.minK).toBe(20);
    expect(jobs[0].tags).toContain("React");
    expect(makeFingerprint(jobs[0])).toBe(jobs[0].fingerprint);
  });

  it("extracts a structured profile and strips identifiers", () => {
    const profile = extractProfileFromText(`
      求职意向：前端开发工程师
      期望城市：上海、杭州
      4年工作经验，本科学历，期望薪资 20-35K
      技能：React TypeScript Node.js SQL
      互联网企业服务经历
      主导开发数据可视化平台，首屏速度提升40%
      电话：13812345678 邮箱：demo@example.com
    `, "resume.txt");
    expect(profile.targetRoles).toContain("前端开发工程师");
    expect(profile.locations).toContain("上海");
    expect(profile.skills.map((skill) => skill.name)).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "SQL"]));
    expect(profile.yearsExperience).toBe(4);
    expect(profile.highlights.join(" ")).not.toContain("13812345678");
  });
});
