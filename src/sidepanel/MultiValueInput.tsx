import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cleanList, splitList } from "../core/privacy";

interface Props {
  values: string[];
  onChange(values: string[]): void;
  placeholder: string;
  ariaLabel: string;
  maxItems?: number;
}

const COMMIT_KEYS = new Set(["Enter", ",", "，", ";", "；", "、"]);

export function mergeMultiValues(current: string[], input: string, maxItems = 30): string[] {
  return cleanList([...current, ...splitList(input)], maxItems);
}

export default function MultiValueInput({ values, onChange, placeholder, ariaLabel, maxItems = 30 }: Props) {
  const [inputValue, setInputValue] = useState("");

  function commit(rawValue = inputValue): void {
    const next = mergeMultiValues(values, rawValue, maxItems);
    if (next.length !== values.length || next.some((value, index) => value !== values[index])) {
      onChange(next);
    }
    setInputValue("");
  }

  function remove(index: number): void {
    onChange(values.filter((_, valueIndex) => valueIndex !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (COMMIT_KEYS.has(event.key)) {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Backspace" && inputValue === "" && values.length > 0) {
      remove(values.length - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData("text");
    if (!/[,，、;；\n|]/.test(pasted)) return;
    event.preventDefault();
    commit([inputValue, pasted].filter(Boolean).join("，"));
  }

  return (
    <div className="multi-value-input">
      {values.length > 0 && (
        <div className="multi-value-tags" aria-label={`${ariaLabel}列表`}>
          {values.map((value, index) => (
            <span className="multi-value-tag" key={`${value}-${index}`}>
              <span>{value}</span>
              <button type="button" aria-label={`删除${value}`} onClick={() => remove(index)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="multi-value-entry">
        <input
          aria-label={ariaLabel}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (inputValue.trim()) commit();
          }}
          placeholder={values.length === 0 ? placeholder : "继续添加…"}
          disabled={values.length >= maxItems}
        />
        <button className="button secondary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => commit()} disabled={!inputValue.trim() || values.length >= maxItems}>添加</button>
      </div>
      <small>每次输入一项，按回车或中文/英文逗号添加；空格会保留。</small>
    </div>
  );
}
