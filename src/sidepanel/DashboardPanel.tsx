import type { DashboardDay } from "../core/types";

interface Props {
  days: DashboardDay[];
  onRefresh(): Promise<void>;
}

export default function DashboardPanel({ days, onRefresh }: Props) {
  const totals = days.reduce((sum, day) => ({
    scan: sum.scan + day.scan,
    shortlisted: sum.shortlisted + day.shortlisted,
    approved: sum.approved + day.approved,
    copied: sum.copied + day.copied,
    sent: sum.sent + day.sent,
    replied: sum.replied + day.replied
  }), { scan: 0, shortlisted: 0, approved: 0, copied: 0, sent: 0, replied: 0 });
  const responseRate = totals.sent > 0 ? Math.round((totals.replied / totals.sent) * 100) : 0;

  return (
    <div className="stack">
      <section className="dashboard-hero">
        <div><span>累计扫描</span><strong>{totals.scan}</strong></div>
        <div><span>高匹配</span><strong>{totals.shortlisted}</strong></div>
        <div><span>手动发送</span><strong>{totals.sent}</strong></div>
        <div><span>回复率</span><strong>{responseRate}%</strong></div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div><span className="step-index">90D</span><h3>本地活动趋势</h3></div>
          <button className="link" onClick={() => void onRefresh()}>刷新</button>
        </div>
        {days.length === 0 ? (
          <div className="empty-inline">暂无活动记录。扫描和手动标记后会显示在这里。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>扫描</th><th>高匹配</th><th>批准</th><th>复制</th><th>发送</th><th>回复</th></tr></thead>
              <tbody>{days.map((day) => (
                <tr key={day.date}>
                  <td>{day.date.slice(5)}</td><td>{day.scan}</td><td>{day.shortlisted}</td><td>{day.approved}</td><td>{day.copied}</td><td>{day.sent}</td><td>{day.replied}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card funnel-card">
        <h3>转化漏斗</h3>
        {[
          ["扫描", totals.scan, 100],
          ["高匹配", totals.shortlisted, totals.scan ? (totals.shortlisted / totals.scan) * 100 : 0],
          ["已批准", totals.approved, totals.scan ? (totals.approved / totals.scan) * 100 : 0],
          ["手动发送", totals.sent, totals.scan ? (totals.sent / totals.scan) * 100 : 0],
          ["有回复", totals.replied, totals.scan ? (totals.replied / totals.scan) * 100 : 0]
        ].map(([label, value, width]) => (
          <div className="funnel-row" key={String(label)}>
            <span>{label}</span>
            <div><i style={{ width: `${Math.max(Number(width), value ? 5 : 0)}%` }} /></div>
            <b>{value}</b>
          </div>
        ))}
      </section>
    </div>
  );
}
