import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import MultiValueInput, { mergeMultiValues } from "../src/sidepanel/MultiValueInput";

const containers: HTMLDivElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
});

function renderInput(initialValues: string[] = []) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  let values = initialValues;

  function Harness() {
    return <MultiValueInput ariaLabel="添加技能" values={values} onChange={(next) => {
      values = next;
      root.render(<Harness />);
    }} placeholder="输入技能" />;
  }

  act(() => root.render(<Harness />));
  return { container, getValues: () => values };
}

describe("multi value input", () => {
  it("keeps spaces inside one item and commits it with Enter", () => {
    const view = renderInput();
    const input = view.container.querySelector("input") as HTMLInputElement;

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "AIGC 视频生成");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("AIGC 视频生成");

    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(view.getValues()).toEqual(["AIGC 视频生成"]);
    expect(view.container.textContent).toContain("AIGC 视频生成");
  });

  it("commits the current item with Chinese or English comma", () => {
    const view = renderInput();
    const input = view.container.querySelector("input") as HTMLInputElement;

    for (const [value, key] of [["React", ","], ["Node.js", "，"]]) {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
    }

    expect(view.getValues()).toEqual(["React", "Node.js"]);
  });

  it("splits pasted lists while preserving spaces and removing duplicates", () => {
    expect(mergeMultiValues(["React"], "AIGC 视频生成，React, 数据 可视化")).toEqual([
      "React",
      "AIGC 视频生成",
      "数据 可视化"
    ]);
  });
});
