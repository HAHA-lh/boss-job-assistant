import { useEffect, useMemo, useState } from "react";
import { splitList } from "../core/privacy";
import type { MatchPreferences, MatchWeights, PageConsent } from "../core/types";

interface Props {
  preferences: MatchPreferences;
  consent: PageConsent;
  onSave(preferences: MatchPreferences): Promise<void>;
  onConsentChange(accepted: boolean): Promise<void>;
  onExport(): Promise<void>;
  onClear(): Promise<void>;
}

const WEIGHT_LABELS: Record<keyof MatchWeights, string> = {
  skills: "技能",
  role: "目标岗位",
  experience: "工作经验",
  projectIndustry: "项目/行业",
  location: "地点",
  salary: "薪资",
  activity: "活跃度"
};

export default function SettingsPanel({ preferences, consent, onSave, onConsentChange, onExport, onClear }: Props) {
  const [draft, setDraft] = useState(preferences);
  const [error, setError] = useState("");
  const weightTotal = useMemo(() => Object.values(draft.weights).reduce((sum, value) => sum + value, 0), [draft.weights]);

  useEffect(() => setDraft(preferences), [preferences]);

  function updateWeight(key: keyof MatchWeights, value: number): void {
    setDraft({ ...draft, weights: { ...draft.weights, [key]: Math.max(0, value) } });
  }

  async function save(): Promise<void> {
    setError("");
    try {
      if (weightTotal <= 0) throw new Error("至少保留一个大于 0 的评分权重。");
      if (draft.threshold < 10 || draft.threshold > 100) throw new Error("高匹配阈值应在 10–100 之间。");
      await onSave(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  return (
    <div className="stack">
      <section className="card form-card">
        <div className="section-heading"><div><span className="step-index">01</span><h3>筛选边界</h3></div></div>
        <label>
          优先城市
          <input value={draft.cities.join("，")} onChange={(event) => setDraft({ ...draft, cities: splitList(event.target.value) })} placeholder="留空则使用简历中的期望城市" />
        </label>
        <div className="form-grid two">
          <label>
            最低月薪（K）
            <input type="number" min="0" value={draft.salaryFloorK ?? ""} onChange={(event) => setDraft({ ...draft, salaryFloorK: event.target.value === "" ? undefined : Number(event.target.value) })} />
          </label>
          <label>
            岗位类型
            <input value={draft.jobTypes.join("，")} onChange={(event) => setDraft({ ...draft, jobTypes: splitList(event.target.value) })} placeholder="全职，远程" />
          </label>
        </div>
        <label>
          排除公司
          <textarea rows={2} value={draft.excludedCompanies.join("，")} onChange={(event) => setDraft({ ...draft, excludedCompanies: splitList(event.target.value) })} />
        </label>
        <label>
          排除关键词
          <textarea rows={2} value={draft.excludedKeywords.join("，")} onChange={(event) => setDraft({ ...draft, excludedKeywords: splitList(event.target.value) })} />
        </label>
        <div className="check-grid">
          {([
            ["requireCity", "城市必须满足"],
            ["requireSalary", "薪资必须满足"],
            ["requireEducation", "学历必须满足"],
            ["requireExperience", "经验必须满足"]
          ] as const).map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input type="checkbox" checked={draft.hardFilters[key]} onChange={(event) => setDraft({ ...draft, hardFilters: { ...draft.hardFilters, [key]: event.target.checked } })} />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="card form-card">
        <div className="section-heading">
          <div><span className="step-index">02</span><h3>评分权重</h3></div>
          <small>合计 {weightTotal}</small>
        </div>
        <div className="weight-list">
          {(Object.keys(WEIGHT_LABELS) as Array<keyof MatchWeights>).map((key) => (
            <label key={key}>
              <span>{WEIGHT_LABELS[key]}</span>
              <input type="range" min="0" max="50" value={draft.weights[key]} onChange={(event) => updateWeight(key, Number(event.target.value))} />
              <b>{draft.weights[key]}</b>
            </label>
          ))}
        </div>
        <div className="form-grid three">
          <label>高匹配阈值<input type="number" min="10" max="100" value={draft.threshold} onChange={(event) => setDraft({ ...draft, threshold: Number(event.target.value) })} /></label>
          <label>每日候选上限<input type="number" min="1" max="100" value={draft.dailyLimit} onChange={(event) => setDraft({ ...draft, dailyLimit: Number(event.target.value) })} /></label>
          <label>去重天数<input type="number" min="1" max="365" value={draft.dedupeDays} onChange={(event) => setDraft({ ...draft, dedupeDays: Number(event.target.value) })} /></label>
        </div>
      </section>

      <section className="card form-card">
        <div className="section-heading"><div><span className="step-index">03</span><h3>每日提醒</h3></div></div>
        <label className="checkbox-label switch-row">
          <input type="checkbox" checked={draft.reminderEnabled} onChange={(event) => setDraft({ ...draft, reminderEnabled: event.target.checked })} />
          启用每日本地提醒
        </label>
        <div className="form-grid two">
          <label>提醒时间<input type="time" value={draft.reminderTime} onChange={(event) => setDraft({ ...draft, reminderTime: event.target.value })} /></label>
          <label>活动保留天数<input type="number" min="7" max="365" value={draft.retentionDays} onChange={(event) => setDraft({ ...draft, retentionDays: Number(event.target.value) })} /></label>
        </div>
        <label>
          每日入口网址
          <input type="url" value={draft.dailyEntryUrl} onChange={(event) => setDraft({ ...draft, dailyEntryUrl: event.target.value })} />
          <small>通知点击后才会打开；后台不会访问该网址。</small>
        </label>
      </section>

      <section className="card form-card compliance-card">
        <div className="section-heading"><div><span className="step-index">04</span><h3>权限与数据</h3></div></div>
        <label className="consent-row inset">
          <input type="checkbox" checked={consent.accepted} onChange={(event) => void onConsentChange(event.target.checked)} />
          <span>我确认已获得页面读取许可，或当前平台规则允许此用途。</span>
        </label>
        <p className="muted">未确认时仍可使用粘贴岗位、评分、话术和看板。扩展不读取 Cookie、聊天记录或登录凭据。</p>
        <div className="link-row">
          <a href="https://about.zhipin.com/agreement" target="_blank" rel="noreferrer">查看当前协议</a>
          <a href="https://www.zhipin.com/web/common/protocol/protocol-2019-09-30.html" target="_blank" rel="noreferrer">查看公开协议文本</a>
        </div>
        <div className="data-actions">
          <button className="button secondary" onClick={() => void onExport()}>导出 CSV</button>
          <button className="button danger" onClick={() => void onClear()}>清空全部本地数据</button>
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}
      <button className="button primary wide" onClick={() => void save()}>保存设置</button>
    </div>
  );
}
