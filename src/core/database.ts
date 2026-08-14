import type { ActivityRecord, ActivityType, DashboardDay, JobRecord } from "./types";

const DB_NAME = "boss-job-assistant";
const DB_VERSION = 1;

function localDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 操作失败"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB 事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB 事务已取消"));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("jobs")) {
        const store = database.createObjectStore("jobs", { keyPath: "fingerprint" });
        store.createIndex("lastSeenAt", "lastSeenAt");
      }
      if (!database.objectStoreNames.contains("activities")) {
        const store = database.createObjectStore("activities", { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地数据库"));
  });
}

export async function putJobs(jobs: JobRecord[]): Promise<void> {
  if (jobs.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction("jobs", "readwrite");
  const store = transaction.objectStore("jobs");
  for (const job of jobs) {
    const existing = await requestToPromise(store.get(job.fingerprint)) as JobRecord | undefined;
    store.put({ ...job, firstSeenAt: existing?.firstSeenAt || job.firstSeenAt });
  }
  await transactionDone(transaction);
  database.close();
}

export async function listJobs(): Promise<JobRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction("jobs", "readonly");
  const result = await requestToPromise(transaction.objectStore("jobs").getAll()) as JobRecord[];
  await transactionDone(transaction);
  database.close();
  return result;
}

export async function getPriorDayFingerprints(days: number, now = new Date()): Promise<Set<string>> {
  const cutoff = new Date(now.getTime() - days * 86_400_000).getTime();
  const today = localDateKey(now);
  const jobs = await listJobs();
  return new Set(
    jobs
      .filter((job) => new Date(job.lastSeenAt).getTime() >= cutoff && localDateKey(job.firstSeenAt) !== today)
      .map((job) => job.fingerprint)
  );
}

export async function deleteJob(fingerprint: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("jobs", "readwrite");
  transaction.objectStore("jobs").delete(fingerprint);
  await transactionDone(transaction);
  database.close();
}

export async function addActivity(
  type: ActivityType,
  options: { fingerprint?: string; count?: number; metadata?: ActivityRecord["metadata"] } = {}
): Promise<void> {
  const record: ActivityRecord = {
    type,
    timestamp: new Date().toISOString(),
    fingerprint: options.fingerprint,
    count: options.count ?? 1,
    metadata: options.metadata
  };
  const database = await openDatabase();
  const transaction = database.transaction("activities", "readwrite");
  transaction.objectStore("activities").add(record);
  await transactionDone(transaction);
  database.close();
}

export async function listActivities(days = 90, now = new Date()): Promise<ActivityRecord[]> {
  const cutoff = now.getTime() - days * 86_400_000;
  const database = await openDatabase();
  const transaction = database.transaction("activities", "readonly");
  const records = await requestToPromise(transaction.objectStore("activities").getAll()) as ActivityRecord[];
  await transactionDone(transaction);
  database.close();
  return records.filter((record) => new Date(record.timestamp).getTime() >= cutoff);
}

export function summarizeActivities(records: ActivityRecord[]): DashboardDay[] {
  const byDate = new Map<string, DashboardDay>();
  for (const record of records) {
    const date = localDateKey(record.timestamp);
    const current = byDate.get(date) || {
      date,
      scan: 0,
      shortlisted: 0,
      approved: 0,
      copied: 0,
      sent: 0,
      replied: 0
    };
    current[record.type] += record.count;
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export async function cleanupOldData(retentionDays: number, now = new Date()): Promise<void> {
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  const database = await openDatabase();
  const transaction = database.transaction(["jobs", "activities"], "readwrite");
  const jobs = transaction.objectStore("jobs");
  const activities = transaction.objectStore("activities");
  const allJobs = await requestToPromise(jobs.getAll()) as JobRecord[];
  const allActivities = await requestToPromise(activities.getAll()) as ActivityRecord[];
  allJobs.filter((job) => new Date(job.lastSeenAt).getTime() < cutoff).forEach((job) => jobs.delete(job.fingerprint));
  allActivities.filter((activity) => new Date(activity.timestamp).getTime() < cutoff).forEach((activity) => activities.delete(activity.id!));
  await transactionDone(transaction);
  database.close();
}

export async function clearAppDatabase(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(["jobs", "activities"], "readwrite");
  transaction.objectStore("jobs").clear();
  transaction.objectStore("activities").clear();
  await transactionDone(transaction);
  database.close();
}
