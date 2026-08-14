import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../src/sidepanel/App";

describe("side panel render", () => {
  it("renders the initial shell without extension APIs", () => {
    const html = renderToString(<App />);
    expect(html).toContain("正在读取本地数据");
  });
});
