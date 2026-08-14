export interface ExtractedPageJob {
  url?: string;
  title: string;
  company: string;
  location?: string;
  salaryText?: string;
  experienceText?: string;
  educationText?: string;
  tags: string[];
  description: string;
  activityText?: string;
}

/**
 * This function is serialized by chrome.scripting.executeScript. Keep every
 * helper inside the function and do not reference extension or page globals
 * other than standard DOM APIs.
 */
export function extractVisibleJobsFromPage(): ExtractedPageJob[] {
  const clean = (value?: string | null): string => (value || "").replace(/\s+/g, " ").trim();
  const firstText = (element: Element, selectors: string[]): string => {
    for (const selector of selectors) {
      const found = element.querySelector(selector);
      const text = clean(found?.textContent);
      if (text) return text;
    }
    return "";
  };
  const textMatching = (text: string, expression: RegExp): string | undefined => {
    const match = text.match(expression);
    return match ? clean(match[0]) : undefined;
  };
  const salaryPattern = /\d+(?:\.\d+)?\s*[-~—至]\s*\d+(?:\.\d+)?\s*[Kk万Ww](?:[·x×*]\d{1,2}薪)?/;
  const salaryCount = (text: string): number => text.match(/\d+(?:\.\d+)?\s*[-~—至]\s*\d+(?:\.\d+)?\s*[Kk万Ww](?:[·x×*]\d{1,2}薪)?/gi)?.length || 0;
  const textSegments = (element: Element): string[] => {
    const seen = new Set<string>();
    return Array.from(element.querySelectorAll("a, span, p, h1, h2, h3, h4, strong, b, em, small"))
      .map((child) => clean(child.textContent))
      .filter((text) => {
        const key = text.toLowerCase();
        if (!text || text.length > 120 || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };
  const isMetadataText = (text: string): boolean =>
    /^(?:猎头|急聘|推荐|精选|置顶|收藏|立即沟通|经验不限|学历不限|应届生|在校生|\d+\s*(?:[-~—至]\s*\d+)?\s*年(?:以上)?|博士|硕士|本科|大专|中专|高中|北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|苏州|天津)(?:[·\s].*)?$/.test(text);
  const normalizeCompany = (text: string): string => clean(text)
    .replace(/\s+(?:北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|苏州|天津)(?:[·\s].*)?$/, "")
    .slice(0, 100);

  if (location.hostname !== "zhipin.com" && !location.hostname.endsWith(".zhipin.com")) {
    throw new Error("当前页面不是 BOSS 直聘页面");
  }

  const cardSelectors = [
    ".job-card-wrapper",
    ".job-card-wrap",
    ".job-card-box",
    ".job-list-item",
    ".job-item",
    ".job-list-box > li",
    ".job-list-container > li",
    ".job-list-container > div",
    ".rec-job-list > li",
    "li[class*='job-card']",
    "[role='listitem']",
    "[class*='job-list-item']",
    "[class*='job-item']",
    "[class*='position-item']",
    "[class*='job-card-wrapper']",
    "[class*='job-card-wrap']",
    "[data-jobid]",
    "[data-job-id]",
    "[data-position-id]"
  ];
  const cards = new Set<Element>();
  for (const selector of cardSelectors) {
    document.querySelectorAll(selector).forEach((card) => cards.add(card));
  }
  document.querySelectorAll("a[href*='/job_detail/']").forEach((anchor) => {
    const card = anchor.closest("li, [class*='job-card'], [class*='job-list']");
    if (card) cards.add(card);
  });
  const salaryNodes = new Set<Element>();
  document.querySelectorAll(".salary, [class*='salary'], span, b, strong, em").forEach((element) => {
    const text = clean(element.textContent);
    if (text.length <= 80 && salaryPattern.test(text)) salaryNodes.add(element);
  });
  salaryNodes.forEach((salaryNode) => {
    let current = salaryNode.parentElement;
    let best: Element | undefined;
    for (let depth = 0; current && current !== document.body && depth < 9; depth += 1) {
      const text = clean(current.textContent);
      const salaries = salaryCount(text);
      if (salaries > 1 || text.length > 1800) break;
      if (salaries === 1 && text.length >= 20) best = current;
      current = current.parentElement;
    }
    if (best) cards.add(best);
  });

  const seen = new Set<string>();
  const result: ExtractedPageJob[] = [];
  for (const card of cards) {
    let parent = card.parentElement;
    let hasCardAncestor = false;
    while (parent && parent !== document.body) {
      if (cards.has(parent) && salaryCount(clean(parent.textContent)) === 1) {
        hasCardAncestor = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (hasCardAncestor || clean(card.textContent).length < 12) continue;
    const anchor = card.querySelector<HTMLAnchorElement>("a[href*='/job_detail/'], a[href*='job_detail'], a[href]");
    let url: string | undefined;
    if (anchor?.href) {
      try {
        url = new URL(anchor.getAttribute("href") || anchor.href, location.href).href;
      } catch {
        url = anchor.href;
      }
    }
    const fullText = clean(card.textContent).slice(0, 8000);
    const segments = textSegments(card);
    const salaryText = firstText(card, [".salary", "[class*='salary']"]) ||
      textMatching(fullText, salaryPattern);
    let title = firstText(card, [
      ".job-name", "[class*='job-name']", ".job-title", "[class*='job-title']", "[class*='position-name']", "a[href*='/job_detail/']"
    ]);
    if (!title) {
      title = segments
        .map((text) => clean(text.replace(salaryPattern, "")))
        .find((text) => text.length >= 2 && text.length <= 100 && !isMetadataText(text) && !salaryPattern.test(text)) || "";
    }
    let company = firstText(card, [
      ".company-name", "[class*='company-name']", ".company-info h3", ".company-info a", "[class*='company-info'] a",
      "[class*='brand-name']", "[class*='company'] [class*='name']"
    ]);
    if (!company) {
      company = segments.find((text) =>
        text !== title && text.length >= 2 && text.length <= 100 &&
        /(?:公司|集团|工作室|事务所|银行|学校|医院|中心|有限|股份)$/.test(normalizeCompany(text))
      ) || "";
    }
    if (!company) {
      company = [...segments].reverse().find((text) =>
        text !== title && text !== salaryText && text.length >= 2 && text.length <= 80 &&
        !isMetadataText(text) && !salaryPattern.test(text)
      ) || "公司未显示";
    }
    company = normalizeCompany(company) || "公司未显示";
    if (!title || !salaryText) continue;
    if (company === "公司未显示" && segments.length < 3) continue;
    const locationText = firstText(card, [
      ".job-area", "[class*='job-area']", ".job-location", "[class*='job-location']", ".job-address"
    ]) || textMatching(fullText, /(?:北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|苏州|天津)(?:[·\s][\u4e00-\u9fa5]{1,12})?/);
    const experienceText = textMatching(fullText, /(?:经验不限|应届生|在校生|\d+\s*(?:[-~—至]\s*\d+)?\s*年(?:以上)?)/);
    const educationText = textMatching(fullText, /(?:学历不限|博士|硕士|本科|大专|中专|高中)/);
    const tags = Array.from(card.querySelectorAll(".tag-list li, [class*='tag-list'] span, [class*='tag'] li"))
      .map((element) => clean(element.textContent))
      .filter((tag) => tag.length >= 1 && tag.length <= 24)
      .slice(0, 20);
    const activityText = textMatching(fullText, /(?:刚刚活跃|今日活跃|本周活跃|当前在线|在线|活跃)/);
    const key = `${url || ""}|${title}|${company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      url,
      title: title.slice(0, 100),
      company: company.slice(0, 100),
      location: locationText || undefined,
      salaryText: salaryText || undefined,
      experienceText,
      educationText,
      tags: [...new Set(tags)],
      description: fullText,
      activityText
    });
    if (result.length >= 200) break;
  }
  return result;
}
