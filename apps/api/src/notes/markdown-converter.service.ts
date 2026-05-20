import { Injectable } from "@nestjs/common";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import type { PhrasingContent, Content, Root } from "mdast";
interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: { href: string };
}

type TipTapNode = {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: unknown }[];
  attrs?: Record<string, unknown>;
};

@Injectable()
export class MarkdownConverterService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processor: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getProcessor(): Promise<any> {
    if (this.processor) return this.processor;
    const { unified } = await import("unified");
    const { default: remarkParse } = await import("remark-parse");
    this.processor = unified().use(remarkParse);
    return this.processor;
  }

  async markdownToYjsState(markdown: string): Promise<Uint8Array> {
    const ydoc = new Y.Doc();
    if (!markdown.trim()) return Y.encodeStateAsUpdate(ydoc);

    const processor = await this.getProcessor();
    const tree = processor.parse(markdown) as Root;
    const frag = ydoc.getXmlFragment("default");

    const elements = tree.children
      .map((node) => this.blockToYxml(node))
      .filter((el): el is Y.XmlElement => el !== null);

    if (elements.length > 0) frag.insert(0, elements);
    return Y.encodeStateAsUpdate(ydoc);
  }

  async yjsStateToMarkdown(state: Uint8Array): Promise<string> {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, state);
    const json = yDocToProsemirrorJSON(ydoc, "default") as TipTapNode;
    if (!json.content?.length) return "";
    return json.content.map((n) => this.nodeToMarkdown(n)).join("\n\n");
  }

  // ── Write path: MDAST → Y.XmlElement ──────────────────────────────────────

  private blockToYxml(node: Content): Y.XmlElement | null {
    switch (node.type) {
      case "paragraph": {
        const el = new Y.XmlElement("paragraph");
        this.fillInline(el, node.children as PhrasingContent[]);
        return el;
      }
      case "heading": {
        const el = new Y.XmlElement("heading");
        el.setAttribute("level", String(node.depth));
        this.fillInline(el, node.children as PhrasingContent[]);
        return el;
      }
      case "blockquote": {
        const el = new Y.XmlElement("blockquote");
        const children = (node.children as Content[])
          .map((c) => this.blockToYxml(c))
          .filter((c): c is Y.XmlElement => c !== null);
        if (children.length) el.insert(0, children);
        return el;
      }
      case "list": {
        const el = new Y.XmlElement(node.ordered ? "orderedList" : "bulletList");
        const items = node.children.map((item) => {
          const li = new Y.XmlElement("listItem");
          const content = item.children
            .map((c) => this.blockToYxml(c as Content))
            .filter((c): c is Y.XmlElement => c !== null);
          if (content.length) li.insert(0, content);
          return li;
        });
        if (items.length) el.insert(0, items);
        return el;
      }
      case "code": {
        const el = new Y.XmlElement("codeBlock");
        if (node.lang) el.setAttribute("language", node.lang);
        const txt = new Y.XmlText();
        txt.insert(0, node.value);
        el.insert(0, [txt]);
        return el;
      }
      case "thematicBreak":
        return new Y.XmlElement("horizontalRule");
      default:
        return null;
    }
  }

  private fillInline(el: Y.XmlElement, children: PhrasingContent[]) {
    const segments = this.inlineToSegments(children, {});
    if (!segments.length) return;
    const txt = new Y.XmlText();
    let offset = 0;
    for (const seg of segments) {
      const attrs: Record<string, boolean | object | null> = {
        bold: seg.bold ?? null,
        italic: seg.italic ?? null,
        code: seg.code ?? null,
        link: seg.link ?? null,
      };
      txt.insert(offset, seg.text, attrs);
      offset += seg.text.length;
    }
    el.insert(0, [txt]);
  }

  private inlineToSegments(
    nodes: PhrasingContent[],
    ctx: { bold?: boolean; italic?: boolean; code?: boolean; link?: { href: string } },
  ): TextSegment[] {
    const out: TextSegment[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case "text":
          out.push({ text: node.value, ...ctx });
          break;
        case "strong":
          out.push(
            ...this.inlineToSegments(node.children as PhrasingContent[], { ...ctx, bold: true }),
          );
          break;
        case "emphasis":
          out.push(
            ...this.inlineToSegments(node.children as PhrasingContent[], { ...ctx, italic: true }),
          );
          break;
        case "inlineCode":
          out.push({ text: node.value, ...ctx, code: true });
          break;
        case "link":
          out.push(
            ...this.inlineToSegments(node.children as PhrasingContent[], {
              ...ctx,
              link: { href: node.url },
            }),
          );
          break;
        case "break":
          out.push({ text: "\n", ...ctx });
          break;
      }
    }
    return out;
  }

  // ── Read path: TipTap JSON → Markdown ─────────────────────────────────────

  private nodeToMarkdown(node: TipTapNode): string {
    switch (node.type) {
      case "paragraph":
        return this.inlineToMarkdown(node.content ?? []);
      case "heading": {
        const level = (node.attrs?.level as number) ?? 1;
        return `${"#".repeat(level)} ${this.inlineToMarkdown(node.content ?? [])}`;
      }
      case "blockquote":
        return (node.content ?? [])
          .map((c) => this.nodeToMarkdown(c))
          .map((line) => `> ${line}`)
          .join("\n");
      case "bulletList":
        return (node.content ?? []).map((item) => `- ${this.listItemToMarkdown(item)}`).join("\n");
      case "orderedList":
        return (node.content ?? [])
          .map((item, i) => `${i + 1}. ${this.listItemToMarkdown(item)}`)
          .join("\n");
      case "codeBlock": {
        const lang = (node.attrs?.language as string) ?? "";
        const code = (node.content ?? []).map((c) => c.text ?? "").join("");
        return `\`\`\`${lang}\n${code}\n\`\`\``;
      }
      case "horizontalRule":
        return "---";
      default:
        return "";
    }
  }

  private listItemToMarkdown(item: TipTapNode): string {
    return (item.content ?? [])
      .map((c) =>
        c.type === "paragraph" ? this.inlineToMarkdown(c.content ?? []) : this.nodeToMarkdown(c),
      )
      .join("\n");
  }

  private inlineToMarkdown(nodes: TipTapNode[]): string {
    return nodes
      .map((node) => {
        if (node.type !== "text" || !node.text) return "";
        const marks = node.marks ?? [];
        const types = marks.map((m) => m.type);
        let text = node.text;

        if (types.includes("code")) return `\`${text}\``;

        const linkMark = marks.find((m) => m.type === "link");
        if (linkMark) {
          const href = (linkMark.attrs as { href?: string })?.href ?? "";
          text = `[${text}](${href})`;
        }

        if (types.includes("bold") && types.includes("italic")) return `***${text}***`;
        if (types.includes("bold")) return `**${text}**`;
        if (types.includes("italic")) return `*${text}*`;
        return text;
      })
      .join("");
  }
}
