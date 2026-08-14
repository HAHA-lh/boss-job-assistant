import { useEffect, useState } from "react";
import { EMPTY_PROFILE } from "../core/defaults";
import { splitList } from "../core/privacy";
import type { EducationLevel, ResumeProfile } from "../core/types";
import MultiValueInput from "./MultiValueInput";

interface Props {
  profile?: ResumeProfile;
  onSave(profile: ResumeProfile): Promise<void>;
}

const EDUCATION_OPTIONS: EducationLevel[] = ["未知", "高中", "中专", "大专", "本科", "硕士", "博士"];

function freshProfile(): ResumeProfile {
  return { ...EMPTY_PROFILE, extractedAt: new Date().toISOString(), skills: [], highlights: [] };
}

export default function ProfilePanel({ profile, onSave }: Props) {
  const [draft, setDraft] = useState<ResumeProfile>(profile || freshProfile());
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(profile || freshProfile());
  }, [profile]);

  async function importFile(file?: File): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("正在本地解析文件…");
    try {
      const { parseResumeFile } = await import("../core/resumeParser");
      const parsed = await parseResumeFile(file);
      setDraft(parsed);
      setStatus("解析完成。请逐项校对，尤其是目标岗位、技能和工作年限，然后点击保存。");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function importText(): Promise<void> {
    setError("");
    if (pasteText.trim().length < 30) {
      setError("请粘贴至少 30 个字符的简历文本。");
      return;
    }
    const { extractProfileFromText } = await import("../core/resumeParser");
    setDraft(extractProfileFromText(pasteText, "粘贴文本"));
    setPasteText("");
    setStatus("文本解析完成。请校对后保存；粘贴的原文不会持久化。");
  }

  async function save(): Promise<void> {
    setError("");
    if (draft.targetRoles.length === 0) {
      setError("请至少填写一个目标岗位，以便进行高匹配筛选。");
      return;
    }
    if (draft.skills.length === 0) {
      setError("请至少填写一项已掌握技能。");
      return;
    }
    await onSave({ ...draft, extractedAt: new Date().toISOString() });
  }

  const listValue = (values: string[]) => values.join("，");

  function updateSkills(names: string[]): void {
    const currentSkills = new Map(draft.skills.map((skill) => [skill.name.toLowerCase(), skill]));
    setDraft({
      ...draft,
      skills: names.map((name) => currentSkills.get(name.toLowerCase()) || { name })
    });
  }

  return (
    <div className="stack">
      <section className="hero-card compact">
        <div>
          <span className="pill">仅本地处理</span>
          <h2>导入并校对简历</h2>
          <p>原始文件不会保存或上传，只保存你确认后的结构化资料。</p>
        </div>
        <label className={`button primary file-button ${busy ? "disabled" : ""}`}>
          {busy ? "解析中…" : "选择 PDF / DOCX"}
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(event) => void importFile(event.target.files?.[0])} />
        </label>
      </section>

      <details className="card disclosure">
        <summary>无法解析文件？改为粘贴简历文本</summary>
        <textarea rows={7} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="粘贴简历正文。手机号、邮箱、身份证号和微信号会在解析时移除。" />
        <button className="button secondary" onClick={() => void importText()}>本地解析文本</button>
      </details>

      {status && <div className="notice info">{status}</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="card form-card">
        <div className="section-heading">
          <div><span className="step-index">01</span><h3>求职方向</h3></div>
          {draft.sourceName && <small>来源：{draft.sourceName}</small>}
        </div>
        <label>
          目标岗位 <b>必填</b>
          <input value={listValue(draft.targetRoles)} onChange={(event) => setDraft({ ...draft, targetRoles: splitList(event.target.value) })} placeholder="前端开发工程师，React 工程师" />
        </label>
        <div className="form-grid two">
          <label>
            工作年限
            <input type="number" min="0" max="60" step="0.5" value={draft.yearsExperience ?? ""} onChange={(event) => setDraft({ ...draft, yearsExperience: event.target.value === "" ? undefined : Number(event.target.value) })} />
          </label>
          <label>
            最高学历
            <select value={draft.education} onChange={(event) => setDraft({ ...draft, education: event.target.value as EducationLevel })}>
              {EDUCATION_OPTIONS.map((level) => <option key={level}>{level}</option>)}
            </select>
          </label>
        </div>
        <div className="field-group">
          <div className="field-label">已掌握技能 <b>必填</b></div>
          <MultiValueInput
            ariaLabel="添加已掌握技能"
            values={draft.skills.map((skill) => skill.name)}
            onChange={updateSkills}
            placeholder="例如：AIGC 视频生成"
          />
        </div>
      </section>

      <section className="card form-card">
        <div className="section-heading"><div><span className="step-index">02</span><h3>期望与经历</h3></div></div>
        <label>
          期望城市
          <input value={listValue(draft.locations)} onChange={(event) => setDraft({ ...draft, locations: splitList(event.target.value) })} placeholder="上海，杭州" />
        </label>
        <div className="form-grid two">
          <label>
            期望最低月薪（K）
            <input type="number" min="0" value={draft.salary?.minK ?? ""} onChange={(event) => setDraft({ ...draft, salary: { ...draft.salary, minK: event.target.value === "" ? undefined : Number(event.target.value) } })} />
          </label>
          <label>
            期望最高月薪（K）
            <input type="number" min="0" value={draft.salary?.maxK ?? ""} onChange={(event) => setDraft({ ...draft, salary: { ...draft.salary, maxK: event.target.value === "" ? undefined : Number(event.target.value) } })} />
          </label>
        </div>
        <label>
          行业经历
          <input value={listValue(draft.industries)} onChange={(event) => setDraft({ ...draft, industries: splitList(event.target.value) })} placeholder="互联网，企业服务" />
        </label>
        <div className="field-group">
          <div className="field-label">项目关键词</div>
          <MultiValueInput
            ariaLabel="添加项目关键词"
            values={draft.projectKeywords}
            onChange={(projectKeywords) => setDraft({ ...draft, projectKeywords })}
            placeholder="例如：动画制作"
          />
        </div>
        <label>
          可用于招呼语的真实经历亮点 <small>每行一条</small>
          <textarea rows={5} value={draft.highlights.join("\n")} onChange={(event) => setDraft({ ...draft, highlights: event.target.value.split(/\n+/).map((value) => value.trim()).filter(Boolean).slice(0, 8) })} placeholder="主导重构后台管理系统，首屏加载时间降低 40%" />
        </label>
      </section>

      <button className="button primary wide" onClick={() => void save()}>保存已校对资料</button>
    </div>
  );
}
