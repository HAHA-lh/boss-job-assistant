import { useMemo, useState } from "react";
import type { CandidateItem, MatchStatus, PageConsent } from "../core/types";

interface Props {
  profileExists: boolean;
  consent: PageConsent;
  candidates: CandidateItem[];
  busy: boolean;
  onConsentChange(accepted: boolean): Promise<void>;
  onPageScan(): Promise<void>;
  onPasteScan(text: string): Promise<void>;
  onCandidatesChange(candidates: CandidateItem[]): Promise<void>;
  onApproveSelected(): Promise<void>;
  onOpenAndCopy(item: CandidateItem): Promise<void>;
  onMarkActivity(item: CandidateItem, type: "sent" | "replied"): Promise<void>;
  onRemove(item: CandidateItem): Promise<void>;
  onGoProfile(): void;
}

const STATUS_LABELS: Record<MatchStatus | "all", string> = {
  all: "全部",
  high: "高匹配",
  review: "备选",
  hidden: "低匹配",
  filtered: "已过滤"
};

export default function MatchPanel(props: Props) {
  const [pasteText, setPasteText] = useState("");
  const [filter, setFilter] = useState<MatchStatus | "all">("high");

  const visible = useMemo(
    () => props.candidates.filter((item) => filter === "all" || item.match.status === filter),
    [filter, props.candidates]
  );
  const nextApproved = props.candidates.find((item) => item.approved && !item.copied);

  async function toggleItem(fingerprint: string, selected: boolean): Promise<void> {
    await props.onCandidatesChange(props.candidates.map((item) => item.job.fingerprint === fingerprint ? { ...item, selected } : item));
  }

  async function selectAllHigh(): Promise<void> {
    await props.onCandidatesChange(props.candidates.map((item) => ({
      ...item,
      selected: item.match.status === "high" && !item.approved && !item.sent
    })));
    setFilter("high");
  }

  async function editGreeting(fingerprint: string, greetingDraft: string): Promise<void> {
    await props.onCandidatesChange(props.candidates.map((item) => item.job.fingerprint === fingerprint
      ? { ...item, match: { ...item.match, greetingDraft } }
      : item));
  }

  if (!props.profileExists) {
    return (
      <section className="empty-state">
        <span className="empty-icon">01</span>
        <h2>先建立匹配基准</h2>
        <p>导入并校对简历后，才能对岗位做可解释评分。</p>
        <button className="button primary" onClick={props.onGoProfile}>前往导入简历</button>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="hero-card">
        <div>
          <span className="pill safe">用户主动触发</span>
          <h2>扫描当前可见岗位</h2>
          <p>只读取当前页面已展示的卡片，不翻页、不调用私有接口，也不会开聊或发送。</p>
        </div>
        <button className="button primary" disabled={props.busy || !props.consent.accepted} onClick={() => void props.onPageScan()}>
          {props.busy ? "分析中…" : "扫描本页"}
        </button>
      </section>

      <label className="consent-row">
        <input type="checkbox" checked={props.consent.accepted} onChange={(event) => void props.onConsentChange(event.target.checked)} />
        <span>我确认已获得平台许可，或当前规则允许扩展读取本页已显示信息。</span>
      </label>

      <details className="card disclosure">
        <summary>无页面读取许可？粘贴岗位文本进行匹配</summary>
        <p className="muted">多个岗位之间用单独一行 <code>---</code> 分隔；第一行作为岗位名。</p>
        <textarea rows={9} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"前端开发工程师\n某某科技有限公司\n上海 20-35K 本科 3-5年\nReact、TypeScript…\n---\n第二个岗位…"} />
        <button className="button secondary" disabled={props.busy || !pasteText.trim()} onClick={() => void props.onPasteScan(pasteText)}>解析并匹配</button>
      </details>

      {props.candidates.length > 0 && (
        <>
          <section className="review-toolbar card">
            <div>
              <strong>{props.candidates.filter((item) => item.match.status === "high").length}</strong>
              <span>个高匹配岗位</span>
            </div>
            <div className="toolbar-actions">
              <button className="button ghost" onClick={() => void selectAllHigh()}>选择全部高匹配</button>
              <button className="button primary" onClick={() => void props.onApproveSelected()}>批准已选</button>
            </div>
          </section>

          {nextApproved && (
            <button className="next-action" onClick={() => void props.onOpenAndCopy(nextApproved)}>
              <span><small>下一条待处理</small>{nextApproved.job.title} · {nextApproved.job.company}</span>
              <b>复制并打开 →</b>
            </button>
          )}

          <div className="filter-row">
            {(Object.keys(STATUS_LABELS) as Array<MatchStatus | "all">).map((status) => (
              <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>
                {STATUS_LABELS[status]}
                <span>{status === "all" ? props.candidates.length : props.candidates.filter((item) => item.match.status === status).length}</span>
              </button>
            ))}
          </div>

          <div className="candidate-list">
            {visible.map((item) => (
              <article className={`candidate-card status-${item.match.status}`} key={item.job.fingerprint}>
                <div className="candidate-topline">
                  <label className="candidate-check">
                    <input type="checkbox" disabled={item.match.status === "filtered"} checked={item.selected} onChange={(event) => void toggleItem(item.job.fingerprint, event.target.checked)} />
                    <span className="score">{item.match.score}</span>
                  </label>
                  <div className="candidate-title">
                    <h3>{item.job.title}</h3>
                    <p>{item.job.company}{item.job.location ? ` · ${item.job.location}` : ""}</p>
                  </div>
                  <span className={`status-badge ${item.match.status}`}>{STATUS_LABELS[item.match.status]}</span>
                </div>

                <div className="job-meta">
                  {item.job.salaryText && <span>{item.job.salaryText}</span>}
                  {item.job.experienceText && <span>{item.job.experienceText}</span>}
                  {item.job.education && item.job.education !== "未知" && <span>{item.job.education}</span>}
                  <span>{item.job.source === "page" ? "页面" : "粘贴"}</span>
                </div>

                {item.match.reasons.length > 0 && (
                  <ul className="reason-list positive">{item.match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                )}
                {(item.match.gaps.length > 0 || item.match.risks.length > 0) && (
                  <details className="explain-details">
                    <summary>查看缺口与风险</summary>
                    <ul className="reason-list warning">
                      {[...item.match.gaps, ...item.match.risks].map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </details>
                )}

                {item.approved && (
                  <div className="greeting-box">
                    <label>招呼语草稿 <small>发送前请再次核对</small></label>
                    <textarea rows={4} value={item.match.greetingDraft} maxLength={140} onChange={(event) => void editGreeting(item.job.fingerprint, event.target.value)} />
                    <div className="greeting-actions">
                      <button className="button primary" onClick={() => void props.onOpenAndCopy(item)}>{item.job.url ? "复制并打开岗位" : "复制招呼语"}</button>
                      <button className={`button ghost ${item.sent ? "done" : ""}`} onClick={() => void props.onMarkActivity(item, "sent")}>{item.sent ? "已标记发送" : "标记已发送"}</button>
                      <button className={`button ghost ${item.replied ? "done" : ""}`} onClick={() => void props.onMarkActivity(item, "replied")}>{item.replied ? "已有回复" : "标记有回复"}</button>
                    </div>
                  </div>
                )}

                <div className="candidate-footer">
                  <span>{item.approved ? "已批准 · 仍需手动发送" : "未批准"}</span>
                  <button className="link danger" onClick={() => void props.onRemove(item)}>删除本地记录</button>
                </div>
              </article>
            ))}
            {visible.length === 0 && <div className="empty-inline">当前筛选条件下没有岗位。</div>}
          </div>
        </>
      )}
    </div>
  );
}
