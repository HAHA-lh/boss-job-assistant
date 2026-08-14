import type { ActivityRecord, JobRecord } from "./types";

function escapeCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(jobs: JobRecord[], activities: ActivityRecord[]): string {
  const jobByFingerprint = new Map(jobs.map((job) => [job.fingerprint, job]));
  const rows = [
    ["时间", "事件", "数量", "岗位", "公司", "地点", "薪资", "链接"]
  ];
  for (const activity of activities) {
    const job = activity.fingerprint ? jobByFingerprint.get(activity.fingerprint) : undefined;
    rows.push([
      activity.timestamp,
      activity.type,
      String(activity.count),
      job?.title || "",
      job?.company || "",
      job?.location || "",
      job?.salaryText || "",
      job?.url || ""
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\n")}`;
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
