import { useEffect, useMemo, useState } from "react";
import { extractVisibleJobsFromPage, type ExtractedPageJob } from "../content/pageExtractor";
import { buildCsv, downloadCsv } from "../core/csv";
import {
  addActivity,
  cleanupOldData,
  clearAppDatabase,
  deleteJob,
  getPriorDayFingerprints,
  listActivities,
  listJobs,
  putJobs,
  summarizeActivities
} from "../core/database";
import { DEFAULT_PREFERENCES } from "../core/defaults";
import { makeFingerprint, parseEducation, parsePastedJobs, parseSalary } from "../core/jobParser";
import { scoreAndRankJobs } from "../core/matcher";
import {
  clearExtensionStorage,
  loadCandidates,
  loadConsent,
  loadPreferences,
  loadProfile,
  saveCandidates,
  saveConsent,
  savePreferences,
  saveProfile
} from "../core/storage";
import type {
  CandidateItem,
  DashboardDay,
  JobRecord,
  MatchPreferences,
  PageConsent,
  ResumeProfile
} from "../core/types";
import DashboardPanel from "./DashboardPanel";
import MatchPanel from "./MatchPanel";
import ProfilePanel from "./ProfilePanel";
import SettingsPanel from "./SettingsPanel";

type TabKey = "match" | "profile" | "dashboard" | "settings";

function extractedToJob(item: ExtractedPageJob): JobRecord {
  const now = new Date().toISOString();
  const record: JobRecord = {
    fingerprint: "",
    url: item.url,
    title: item.title,
    company: item.company,
    location: item.location,
    salaryText: item.salaryText,
    salary: parseSalary(item.salaryText),
    experienceText: item.experienceText,
    education: parseEducation(item.educationText),
    tags: item.tags,
    description: item.description,
    activityText: item.activityText,
    source: "page",
    firstSeenAt: now,
    lastSeenAt: now
  };
  record.fingerprint = makeFingerprint(record);
  return record;
}

function isAllowedJobUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "zhipin.com" || parsed.hostname.endsWith(".zhipin.com"));
  } catch {
    return false;
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("match");
  const [profile, setProfile] = useState<ResumeProfile>();
  const [preferences, setPreferences] = useState<MatchPreferences>(DEFAULT_PREFERENCES);
  const [consent, setConsentState] = useState<PageConsent>({ accepted: false });
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardDay[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const counts = useMemo(() => ({
    high: candidates.filter((item) => item.match.status === "high").length,
    approved: candidates.filter((item) => item.approved).length,
    sent: candidates.filter((item) => item.sent).length
  }), [candidates]);

  useEffect(() => {
    void (async () => {
      try {
        const [savedProfile, savedPreferences, savedConsent, savedCandidates] = await Promise.all([
          loadProfile(), loadPreferences(), loadConsent(), loadCandidates()
        ]);
        setProfile(savedProfile);
        setPreferences(savedPreferences);
        setConsentState(savedConsent);
        setCandidates(savedCandidates);
        if (!savedProfile) setTab("profile");
        await cleanupOldData(savedPreferences.retentionDays);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "加载本地数据失败");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3600);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function persistCandidates(next: CandidateItem[]): Promise<void> {
    setCandidates(next);
    await saveCandidates(next);
  }

  async function processJobs(incoming: JobRecord[]): Promise<void> {
    if (!profile) throw new Error("请先导入并保存简历资料。");
    if (incoming.length === 0) throw new Error("没有识别到岗位。请确认页面已加载职位卡片，或改用粘贴模式。");

    const prior = await getPriorDayFingerprints(preferences.dedupeDays);
    const currentFingerprints = new Set(candidates.map((item) => item.job.fingerprint));
    const uniqueIncoming = incoming.filter((job) => !prior.has(job.fingerprint) || currentFingerprints.has(job.fingerprint));
    const skipped = incoming.length - uniqueIncoming.length;
    const combined = new Map<string, JobRecord>(candidates.map((item) => [item.job.fingerprint, item.job]));
    uniqueIncoming.forEach((job) => combined.set(job.fingerprint, job));

    const jobs = [...combined.values()];
    const matches = scoreAndRankJobs(profile, jobs, preferences);
    const previous = new Map(candidates.map((item) => [item.job.fingerprint, item]));
    const next = matches.map((match) => {
      const job = combined.get(match.fingerprint)!;
      const old = previous.get(match.fingerprint);
      return {
        job,
        match: old?.match.greetingDraft ? { ...match, greetingDraft: old.match.greetingDraft } : match,
        selected: old?.selected || false,
        approved: old?.approved || false,
        copied: old?.copied || false,
        sent: old?.sent || false,
        replied: old?.replied || false
      } satisfies CandidateItem;
    });

    await putJobs(uniqueIncoming);
    await Promise.all([
      addActivity("scan", { count: incoming.length, metadata: { skippedDuplicates: skipped } }),
      addActivity("shortlisted", { count: next.filter((item) => item.match.status === "high" && !previous.has(item.job.fingerprint)).length })
    ]);
    await persistCandidates(next);
    setMessage(`已分析 ${incoming.length} 个岗位，高匹配 ${next.filter((item) => item.match.status === "high").length} 个${skipped ? `，跳过 ${skipped} 个跨日重复岗位` : ""}。`);
  }

  async function runPageScan(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      if (!consent.accepted) throw new Error("请先确认你有权使用页面读取功能。未确认时可使用粘贴岗位模式。");
      const hostGranted = await chrome.permissions.request({ origins: ["https://www.zhipin.com/*"] });
      if (!hostGranted) throw new Error("未获得 BOSS 直聘页面的临时站点权限，已停止扫描。你仍可使用粘贴岗位模式。");
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !isAllowedJobUrl(activeTab.url)) {
        throw new Error("请在已登录且已展示岗位列表的 BOSS 直聘标签页中点击扩展图标，再启动扫描。");
      }
      const execution = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractVisibleJobsFromPage
      });
      const extracted = execution[0]?.result as ExtractedPageJob[] | undefined;
      if (!extracted?.length) throw new Error("网页结构可能已更新，或当前页面尚未显示岗位卡片。已停止扫描，未执行任何站内操作。");
      await processJobs(extracted.map(extractedToJob));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    } finally {
      setBusy(false);
    }
  }

  async function runPasteScan(text: string): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await processJobs(parsePastedJobs(text));
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : String(pasteError));
    } finally {
      setBusy(false);
    }
  }

  async function handleProfileSave(next: ResumeProfile): Promise<void> {
    await saveProfile(next);
    setProfile(next);
    setMessage("简历资料已保存在本机，请确认目标岗位和技能提取是否准确。");
    setTab("match");
  }

  async function handleConsentChange(accepted: boolean): Promise<void> {
    const next = { accepted, acceptedAt: accepted ? new Date().toISOString() : undefined };
    setConsentState(next);
    await saveConsent(next);
    if (!accepted) await chrome.permissions.remove({ origins: ["https://www.zhipin.com/*"] });
  }

  async function handlePreferencesSave(next: MatchPreferences): Promise<void> {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.reminderTime)) throw new Error("提醒时间格式无效。");
    if (next.dailyEntryUrl) {
      const parsed = new URL(next.dailyEntryUrl);
      if (parsed.protocol !== "https:" || (parsed.hostname !== "zhipin.com" && !parsed.hostname.endsWith(".zhipin.com"))) {
        throw new Error("每日入口必须是 zhipin.com 的 HTTPS 地址。");
      }
    }
    await savePreferences(next);
    setPreferences(next);
    await chrome.runtime.sendMessage({ type: "CONFIGURE_REMINDER" });
    setMessage("设置与每日提醒已更新。");
  }

  async function updateCandidate(fingerprint: string, patch: Partial<CandidateItem>): Promise<void> {
    await persistCandidates(candidates.map((item) => item.job.fingerprint === fingerprint ? { ...item, ...patch } : item));
  }

  async function approveSelected(): Promise<void> {
    const selected = candidates.filter((item) => item.selected && !item.approved && item.match.status !== "filtered");
    if (selected.length === 0) {
      setError("请先勾选要批准的岗位。");
      return;
    }
    const fingerprints = new Set(selected.map((item) => item.job.fingerprint));
    await persistCandidates(candidates.map((item) => fingerprints.has(item.job.fingerprint)
      ? { ...item, selected: false, approved: true }
      : item));
    await addActivity("approved", { count: selected.length });
    setMessage(`已批准 ${selected.length} 个岗位，发送仍需逐条由你完成。`);
  }

  async function openAndCopy(item: CandidateItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.match.greetingDraft);
      await updateCandidate(item.job.fingerprint, { copied: true });
      if (!item.copied) await addActivity("copied", { fingerprint: item.job.fingerprint });
      if (isAllowedJobUrl(item.job.url)) await chrome.tabs.create({ url: item.job.url, active: true });
      setMessage(item.job.url ? "招呼语已复制并打开岗位；请自行粘贴、核对和发送。" : "招呼语已复制；该岗位没有可用链接。"
      );
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "复制失败");
    }
  }

  async function markActivity(item: CandidateItem, type: "sent" | "replied"): Promise<void> {
    if ((type === "sent" && item.sent) || (type === "replied" && item.replied)) return;
    await updateCandidate(item.job.fingerprint, type === "sent" ? { sent: true } : { replied: true, sent: true });
    if (type === "replied" && !item.sent) await addActivity("sent", { fingerprint: item.job.fingerprint });
    await addActivity(type, { fingerprint: item.job.fingerprint });
    setMessage(type === "sent" ? "已手动标记为已发送。" : "已手动标记为有回复。"
    );
  }

  async function removeCandidate(item: CandidateItem): Promise<void> {
    await deleteJob(item.job.fingerprint);
    await persistCandidates(candidates.filter((candidate) => candidate.job.fingerprint !== item.job.fingerprint));
    setMessage("已删除该岗位的本地记录。");
  }

  async function refreshDashboard(): Promise<void> {
    const records = await listActivities(preferences.retentionDays);
    setDashboard(summarizeActivities(records));
  }

  async function exportData(): Promise<void> {
    const [jobs, activities] = await Promise.all([listJobs(), listActivities(preferences.retentionDays)]);
    downloadCsv(buildCsv(jobs, activities), `求职匹配记录-${new Date().toISOString().slice(0, 10)}.csv`);
    setMessage("CSV 已导出。");
  }

  async function clearAllData(): Promise<void> {
    if (!window.confirm("确定清空简历、岗位、设置和全部活动记录吗？此操作无法撤销。")) return;
    await Promise.all([clearExtensionStorage(), clearAppDatabase()]);
    setProfile(undefined);
    setPreferences(DEFAULT_PREFERENCES);
    setConsentState({ accepted: false });
    setCandidates([]);
    setDashboard([]);
    setTab("profile");
    setMessage("本地数据已全部清空。");
  }

  function changeTab(next: TabKey): void {
    setTab(next);
    setError("");
    if (next === "dashboard") void refreshDashboard();
  }

  if (!ready) return <main className="loading-screen">正在读取本地数据…</main>;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">LOCAL JOB MATCHER</span>
          <h1>求职匹配助手</h1>
        </div>
        <div className="header-stats" title="高匹配 / 已批准 / 已发送">
          <span>{counts.high}</span><i>/</i><span>{counts.approved}</span><i>/</i><span>{counts.sent}</span>
        </div>
      </header>

      <nav className="tab-nav" aria-label="主要功能">
        <button className={tab === "match" ? "active" : ""} onClick={() => changeTab("match")}>今日匹配</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => changeTab("profile")}>简历</button>
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => changeTab("dashboard")}>看板</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => changeTab("settings")}>设置</button>
      </nav>

      {message && <div className="notice success" role="status">{message}</div>}
      {error && <div className="notice error" role="alert">{error}<button onClick={() => setError("")}>关闭</button></div>}

      <section className="panel-content">
        {tab === "profile" && <ProfilePanel profile={profile} onSave={handleProfileSave} />}
        {tab === "match" && (
          <MatchPanel
            profileExists={Boolean(profile)}
            consent={consent}
            candidates={candidates}
            busy={busy}
            onConsentChange={handleConsentChange}
            onPageScan={runPageScan}
            onPasteScan={runPasteScan}
            onCandidatesChange={persistCandidates}
            onApproveSelected={approveSelected}
            onOpenAndCopy={openAndCopy}
            onMarkActivity={markActivity}
            onRemove={removeCandidate}
            onGoProfile={() => changeTab("profile")}
          />
        )}
        {tab === "dashboard" && <DashboardPanel days={dashboard} onRefresh={refreshDashboard} />}
        {tab === "settings" && (
          <SettingsPanel
            preferences={preferences}
            consent={consent}
            onSave={handlePreferencesSave}
            onConsentChange={handleConsentChange}
            onExport={exportData}
            onClear={clearAllData}
          />
        )}
      </section>
    </main>
  );
}
