import { describe, it, expect, beforeEach } from "vitest";
import { MarkdownConverterService } from "./markdown-converter.service.js";

describe("MarkdownConverterService", () => {
  let service: MarkdownConverterService;

  beforeEach(() => {
    service = new MarkdownConverterService();
  });

  async function roundTrip(markdown: string): Promise<string> {
    const bytes = await service.markdownToYjsState(markdown);
    return service.yjsStateToMarkdown(bytes);
  }

  it("round-trips a heading", async () => {
    expect(await roundTrip("# My Title")).toContain("# My Title");
  });

  it("round-trips h2 and h3", async () => {
    expect(await roundTrip("## Section")).toContain("## Section");
    expect(await roundTrip("### Sub")).toContain("### Sub");
  });

  it("round-trips bold marks", async () => {
    expect(await roundTrip("**bold text**")).toContain("**bold text**");
  });

  it("round-trips italic marks", async () => {
    expect(await roundTrip("*italic text*")).toContain("*italic text*");
  });

  it("round-trips bold+italic", async () => {
    expect(await roundTrip("***bold italic***")).toContain("***bold italic***");
  });

  it("round-trips inline code", async () => {
    expect(await roundTrip("Use `const x = 1` here")).toContain("`const x = 1`");
  });

  it("round-trips a code block with language", async () => {
    const result = await roundTrip("```typescript\nconst x = 1;\n```");
    expect(result).toContain("```typescript");
    expect(result).toContain("const x = 1;");
  });

  it("round-trips a bullet list", async () => {
    const result = await roundTrip("- Item one\n- Item two\n- Item three");
    expect(result).toContain("- Item one");
    expect(result).toContain("- Item two");
  });

  it("round-trips an ordered list", async () => {
    const result = await roundTrip("1. First\n2. Second");
    expect(result).toContain("1. First");
    expect(result).toContain("2. Second");
  });

  it("round-trips a blockquote", async () => {
    expect(await roundTrip("> quoted text")).toContain("> quoted text");
  });

  it("round-trips a horizontal rule", async () => {
    expect(await roundTrip("---")).toContain("---");
  });

  it("round-trips a link", async () => {
    expect(await roundTrip("[click here](https://example.com)")).toContain(
      "[click here](https://example.com)",
    );
  });

  it("returns empty string for empty input", async () => {
    const bytes = await service.markdownToYjsState("");
    expect(await service.yjsStateToMarkdown(bytes)).toBe("");
  });

  it("round-trips a multi-block document", async () => {
    const result = await roundTrip(
      "# Title\n\nFirst paragraph.\n\n## Section\n\n- Item A\n- Item B",
    );
    expect(result).toContain("# Title");
    expect(result).toContain("## Section");
    expect(result).toContain("- Item A");
  });
});
