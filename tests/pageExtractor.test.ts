import { beforeEach, describe, expect, it } from "vitest";
import { extractVisibleJobsFromPage } from "../src/content/pageExtractor";

describe("visible page extractor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads only visible DOM job cards and normalizes fields", () => {
    document.body.innerHTML = `
      <ul class="job-list-box">
        <li class="job-card-wrapper">
          <a class="job-name" href="/job_detail/abc.html">前端开发工程师</a>
          <a class="company-name">示例科技有限公司</a>
          <span class="job-area">上海·浦东新区</span>
          <span class="salary">20-35K·14薪</span>
          <ul class="tag-list"><li>React</li><li>TypeScript</li></ul>
          <p>3-5年 本科 今日活跃 负责数据可视化平台</p>
        </li>
      </ul>`;
    const jobs = extractVisibleJobsFromPage();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "前端开发工程师",
      company: "示例科技有限公司",
      location: "上海·浦东新区",
      salaryText: "20-35K·14薪",
      experienceText: "3-5年",
      educationText: "本科"
    });
    expect(jobs[0].tags).toEqual(["React", "TypeScript"]);
  });

  it("returns no result when required title/company fields are absent", () => {
    document.body.innerHTML = `<div class="job-card-wrapper"><p>只有一段无结构文本 20-30K</p></div>`;
    expect(extractVisibleJobsFromPage()).toEqual([]);
  });

  it("supports salary-discovered cards without job links", () => {
    document.body.innerHTML = `
      <main class="search-layout">
        <section class="position-item-v2">
          <div><span>猎头</span><span>设计总负责人（钱包·远程）</span><strong>70-100K·15薪</strong></div>
          <div><span>5-10年</span><span>本科</span><span>UI设计</span><span>交互设计</span></div>
          <footer><span>某大型金融集团公司</span><span>上海</span></footer>
        </section>
      </main>`;

    const jobs = extractVisibleJobsFromPage();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "设计总负责人（钱包·远程）",
      company: "某大型金融集团公司",
      location: "上海",
      salaryText: "70-100K·15薪",
      experienceText: "5-10年",
      educationText: "本科",
      url: undefined
    });
  });

  it("keeps a truthful placeholder when a visible card omits the company", () => {
    document.body.innerHTML = `
      <div class="job-item-v2">
        <span>AI 动画美术总监</span><b>25-50K·13薪</b>
        <span>5-10年</span><span>本科</span><span>上海</span>
      </div>`;

    expect(extractVisibleJobsFromPage()[0]).toMatchObject({
      title: "AI 动画美术总监",
      company: "公司未显示",
      salaryText: "25-50K·13薪"
    });
  });
});
