const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ID_RE = /(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g;
const WECHAT_RE = /(?:微信|wechat|wx)\s*[:：号]?\s*[A-Za-z][-_A-Za-z0-9]{5,19}/gi;

export function sanitizeSensitive(text: string): string {
  return text
    .replace(EMAIL_RE, "")
    .replace(ID_RE, "")
    .replace(PHONE_RE, "")
    .replace(WECHAT_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanList(values: string[], maxItems = 30): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = sanitizeSensitive(value).replace(/^[,，、;；\s]+|[,，、;；\s]+$/g, "").trim();
    const key = clean.toLowerCase();
    if (!clean || clean.length > 120 || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function splitList(value: string): string[] {
  return cleanList(value.split(/[,，、;；\n|]+/));
}
