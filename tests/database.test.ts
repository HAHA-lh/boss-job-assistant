import { beforeEach, describe, expect, it } from "vitest";
import { clearAppDatabase, getPriorDayFingerprints, putJobs, summarizeActivities } from "../src/core/database";
import type { ActivityRecord, JobRecord } from "../src/core/types";

describe("local data helpers", () => {
  beforeEach(async () => {
    await clearAppDatabase();
  });

  it("suppresses jobs seen on a prior day within the dedupe window", async () => {
    const job: JobRecord = {
      fingerprint: "job_test",
      title: "测试岗位",
      company: "测试公司",
      tags: [],
      description: "",
      source: "paste",
      firstSeenAt: "2026-08-13T01:00:00.000Z",
      lastSeenAt: "2026-08-13T01:00:00.000Z"
    };
    await putJobs([job]);
    const fingerprints = await getPriorDayFingerprints(30, new Date("2026-08-14T08:00:00.000Z"));
    expect(fingerprints.has("job_test")).toBe(true);
  });

  it("summarizes activity counts by day", () => {
    const records: ActivityRecord[] = [
      { type: "scan", timestamp: "2026-08-14T01:00:00.000Z", count: 8 },
      { type: "sent", timestamp: "2026-08-14T02:00:00.000Z", count: 2 },
      { type: "replied", timestamp: "2026-08-14T03:00:00.000Z", count: 1 }
    ];
    expect(summarizeActivities(records)[0]).toMatchObject({ date: "2026-08-14", scan: 8, sent: 2, replied: 1 });
  });
});
