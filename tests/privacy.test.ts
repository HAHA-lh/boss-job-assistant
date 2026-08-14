import { describe, expect, it } from "vitest";
import { sanitizeSensitive, splitList } from "../src/core/privacy";

describe("privacy helpers", () => {
  it("removes common personal identifiers", () => {
    const source = "电话 13812345678 邮箱 demo@example.com 身份证 11010119900101123X 微信 wx: codex_user88";
    const result = sanitizeSensitive(source);
    expect(result).not.toContain("13812345678");
    expect(result).not.toContain("demo@example.com");
    expect(result).not.toContain("11010119900101123X");
    expect(result).not.toContain("codex_user88");
  });

  it("normalizes and deduplicates list input", () => {
    expect(splitList("React，TypeScript, React\nNode.js")).toEqual(["React", "TypeScript", "Node.js"]);
  });
});
