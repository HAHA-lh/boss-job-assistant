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

  if (location.hostname !== "zhipin.com" && !location.hostname.endsWith(".zhipin.com")) {
    throw new Error("当前页面不是 BOSS 直聘页面");
  }

  const cardSelectors = [
    ".job-card-wrapper",
    ".job-card-box",
    ".job-list-box > li",
    ".rec-job-list > li",
    "li[class*='job-card']",
    "[class*='job-card-wrapper']",
    "[data-jobid]"
  ];
  const cards = new Set<Element>();
  for (const selector of cardSelectors) {
    document.querySelectorAll(selector).forEach((card) => cards.add(card));
  }
  document.querySelectorAll("a[href*='/job_detail/']").forEach((anchor) => {
    const card = anchor.closest("li, [class*='job-card'], [class*='job-list']");
    if (card) cards.add(card);
  });

  const seen = new Set<string>();
  const result: ExtractedPageJob[] = [];
  for (const card of cards) {
    if ((card.parentElement && cards.has(card.parentElement)) || clean(card.textContent).length < 12) continue;
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
    const title = firstText(card, [
      ".job-name", "[class*='job-name']", ".job-title", "[class*='job-title']", "a[href*='/job_detail/']"
    ]);
    const company = firstText(card, [
      ".company-name", "[class*='company-name']", ".company-info h3", ".company-info a", "[class*='company-info'] a"
    ]);
    if (!title || !company) continue;
    const salaryText = firstText(card, [".salary", "[class*='salary']"]) ||
      textMatching(fullText, /\d+(?:\.\d+)?\s*[-~—至]\s*\d+(?:\.\d+)?\s*[Kk万Ww](?:[·x×*]\d{2}薪)?/);
    const locationText = firstText(card, [
      ".job-area", "[class*='job-area']", ".job-location", "[class*='job-location']", ".job-address"
    ]);
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
