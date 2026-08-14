import type { JobRecord, ResumeProfile } from "./types";
import { sanitizeSensitive } from "./privacy";

function clampGreeting(text: string): string {
  let clean = sanitizeSensitive(text).replace(/\s+/g, "").trim();
  if (clean.length < 60) clean += "希望有机会进一步了解岗位和团队情况，谢谢。";
  if (clean.length > 100) clean = `${clean.slice(0, 98).replace(/[，、；。]+$/, "")}。`;
  return clean;
}

export function generateGreeting(
  profile: ResumeProfile,
  job: JobRecord,
  matchedFacts: string[]
): string {
  const role = job.title || profile.targetRoles[0] || "该岗位";
  const factParts: string[] = [];
  if (profile.yearsExperience !== undefined) factParts.push(`${profile.yearsExperience}年相关经验`);
  factParts.push(...matchedFacts.slice(0, 2));
  if (factParts.length < 2 && profile.highlights[0]) factParts.push(profile.highlights[0].slice(0, 28));
  if (factParts.length === 0 && profile.education !== "未知") factParts.push(`${profile.education}学历`);

  const facts = factParts.slice(0, 2).join("，");
  const body = facts
    ? `您好，关注到贵司的${role}岗位。我具备${facts}，与岗位要求较为契合，期待进一步沟通。`
    : `您好，关注到贵司的${role}岗位，我对岗位方向很感兴趣，已认真阅读职位要求，期待进一步沟通。`;
  return clampGreeting(body);
}
