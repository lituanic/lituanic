import { describe, expect, it } from "bun:test";
import { toMrkdwn } from "../format.js";

describe("toMrkdwn", () => {
  it("converts bold **text** to *text*", () => {
    expect(toMrkdwn("This is **bold** text")).toBe("This is *bold* text");
  });

  it("converts multiple bold segments", () => {
    expect(toMrkdwn("**one** and **two**")).toBe("*one* and *two*");
  });

  it("converts multiline bold (dotall)", () => {
    expect(toMrkdwn("**line one\nline two**")).toBe("*line one\nline two*");
  });

  it("converts markdown links to Slack format", () => {
    expect(toMrkdwn("[Click here](https://example.com)")).toBe("<https://example.com|Click here>");
  });

  it("converts multiple links", () => {
    expect(toMrkdwn("[A](https://a.com) and [B](https://b.com)")).toBe(
      "<https://a.com|A> and <https://b.com|B>",
    );
  });

  it("converts headings to bold", () => {
    expect(toMrkdwn("# Title")).toBe("*Title*");
    expect(toMrkdwn("## Subtitle")).toBe("*Subtitle*");
    expect(toMrkdwn("### H3")).toBe("*H3*");
    expect(toMrkdwn("###### H6")).toBe("*H6*");
  });

  it("converts headings on multiple lines", () => {
    expect(toMrkdwn("## First\nSome text\n### Second")).toBe("*First*\nSome text\n*Second*");
  });

  it("handles mixed markdown", () => {
    const input = "## Summary\n\nThis is **important** — see [docs](https://docs.com).";
    const expected = "*Summary*\n\nThis is *important* — see <https://docs.com|docs>.";
    expect(toMrkdwn(input)).toBe(expected);
  });

  it("passes through plain text unchanged", () => {
    expect(toMrkdwn("Hello world")).toBe("Hello world");
  });

  it("handles empty string", () => {
    expect(toMrkdwn("")).toBe("");
  });

  it("does not convert single asterisks", () => {
    expect(toMrkdwn("*already italic*")).toBe("*already italic*");
  });
});
