import * as Y from 'yjs';

// ── Read path: XmlFragment('default') → markdown ──────────────────────────

export function xmlFragmentToMarkdown(frag: Y.XmlFragment): string {
  const blocks = frag.toArray() as (Y.XmlElement | Y.XmlText)[];
  return blocks.map(xmlNodeToMarkdown).filter(Boolean).join('\n\n');
}

function xmlNodeToMarkdown(node: Y.XmlElement | Y.XmlText): string {
  if (!(node instanceof Y.XmlElement)) return '';
  const el = node as Y.XmlElement;
  switch (el.nodeName) {
    case 'paragraph':
      return xmlInlineToMarkdown(el);
    case 'heading': {
      const level = parseInt(el.getAttribute('level') ?? '1', 10);
      return '#'.repeat(level) + ' ' + xmlInlineToMarkdown(el);
    }
    case 'bulletList':
      return xmlListToMarkdown(el, false);
    case 'orderedList':
      return xmlListToMarkdown(el, true);
    case 'listItem':
      return xmlInlineToMarkdown(el);
    case 'blockquote':
      return (el.toArray() as (Y.XmlElement | Y.XmlText)[])
        .map(xmlNodeToMarkdown)
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n');
    case 'codeBlock': {
      const lang = el.getAttribute('language') ?? '';
      const text = xmlInlineToMarkdown(el);
      return '```' + lang + '\n' + text + '\n```';
    }
    case 'horizontalRule':
      return '---';
    case 'table':
      return xmlTableToMarkdown(el);
    case 'pdfEmbed': {
      const src = el.getAttribute('src') ?? '';
      const title = el.getAttribute('title') ?? 'Document.pdf';
      return `[pdf-embed](${src} "${title}")`;
    }
    default:
      return xmlInlineToMarkdown(el);
  }
}

function xmlTableToMarkdown(el: Y.XmlElement): string {
  const rows = (el.toArray() as (Y.XmlElement | Y.XmlText)[])
    .filter((c): c is Y.XmlElement => c instanceof Y.XmlElement && c.nodeName === 'tableRow');

  if (!rows.length) return '';

  const rowData = rows.map((row) =>
    (row.toArray() as (Y.XmlElement | Y.XmlText)[])
      .filter((c): c is Y.XmlElement => c instanceof Y.XmlElement)
      .map((cell) => xmlInlineToMarkdown(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')),
  );

  if (!rowData.length) return '';

  const colCount = Math.max(...rowData.map((r) => r.length));
  const padRow = (cells: string[]) => {
    while (cells.length < colCount) cells.push('');
    return `| ${cells.join(' | ')} |`;
  };

  const [header, ...body] = rowData;
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const lines = [padRow(header), separator, ...body.map(padRow)];
  return lines.join('\n');
}

function xmlListToMarkdown(el: Y.XmlElement, ordered: boolean): string {
  const items = el.toArray() as (Y.XmlElement | Y.XmlText)[];
  return items
    .filter((c): c is Y.XmlElement => c instanceof Y.XmlElement)
    .map((item, i) => {
      const prefix = ordered ? `${i + 1}. ` : '- ';
      // listItem may contain paragraph children
      const inner = item.toArray() as (Y.XmlElement | Y.XmlText)[];
      const text = inner.length
        ? inner.map(xmlNodeToMarkdown).filter(Boolean).join(' ')
        : xmlInlineToMarkdown(item);
      return prefix + text;
    })
    .join('\n');
}

function xmlInlineToMarkdown(el: Y.XmlElement): string {
  let out = '';
  for (const child of el.toArray() as (Y.XmlElement | Y.XmlText)[]) {
    if (child instanceof Y.XmlText) {
      const delta = child.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[];
      for (const op of delta) {
        if (typeof op.insert !== 'string') continue;
        const a = op.attributes ?? {};
        let t = op.insert;
        if (a.code) {
          t = `\`${t}\``;
        } else if (a.bold && a.italic) {
          t = `***${t}***`;
        } else if (a.bold) {
          t = `**${t}**`;
        } else if (a.italic) {
          t = `*${t}*`;
        } else if (a.link) {
          const href = (a.link as { href?: string }).href ?? '';
          t = `[${t}](${href})`;
        }
        out += t;
      }
    } else if (child instanceof Y.XmlElement) {
      out += xmlNodeToMarkdown(child);
    }
  }
  return out;
}

// ── Write path: markdown → XmlFragment('default') ─────────────────────────

export function applyMarkdownToXmlFragment(frag: Y.XmlFragment, markdown: string): void {
  // Replace entire fragment contents
  const current = frag.toArray();
  if (current.length) frag.delete(0, current.length);

  const elements = markdownToXmlElements(markdown);
  if (elements.length) frag.insert(0, elements);
}

function markdownToXmlElements(markdown: string): Y.XmlElement[] {
  const lines = markdown.split('\n');
  const elements: Y.XmlElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const el = new Y.XmlElement('codeBlock');
      if (lang) el.setAttribute('language', lang);
      const txt = new Y.XmlText();
      txt.insert(0, codeLines.join('\n'));
      el.insert(0, [txt]);
      elements.push(el);
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const el = new Y.XmlElement('heading');
      el.setAttribute('level', String(headingMatch[1].length));
      const txt = inlineTextToYXmlText(headingMatch[2]);
      el.insert(0, [txt]);
      elements.push(el);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(new Y.XmlElement('horizontalRule'));
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const listEl = new Y.XmlElement('bulletList');
      const items: Y.XmlElement[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[-*]\s/, '');
        const item = new Y.XmlElement('listItem');
        const p = new Y.XmlElement('paragraph');
        const txt = inlineTextToYXmlText(text);
        p.insert(0, [txt]);
        item.insert(0, [p]);
        items.push(item);
        i++;
      }
      listEl.insert(0, items);
      elements.push(listEl);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const listEl = new Y.XmlElement('orderedList');
      const items: Y.XmlElement[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s/, '');
        const item = new Y.XmlElement('listItem');
        const p = new Y.XmlElement('paragraph');
        const txt = inlineTextToYXmlText(text);
        p.insert(0, [txt]);
        item.insert(0, [p]);
        items.push(item);
        i++;
      }
      listEl.insert(0, items);
      elements.push(listEl);
      continue;
    }

    // PDF embed: [pdf-embed](url "title")
    const pdfMatch = /^\[pdf-embed\]\(([^)]+)\s+"([^"]+)"\)$/.exec(line.trim());
    if (pdfMatch) {
      const el = new Y.XmlElement('pdfEmbed');
      el.setAttribute('src', pdfMatch[1]);
      el.setAttribute('title', pdfMatch[2]);
      elements.push(el);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqEl = new Y.XmlElement('blockquote');
      const innerLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        innerLines.push(lines[i].slice(2));
        i++;
      }
      const inner = markdownToXmlElements(innerLines.join('\n'));
      if (inner.length) bqEl.insert(0, inner);
      elements.push(bqEl);
      continue;
    }

    // Empty line → skip (paragraph separator)
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    const el = new Y.XmlElement('paragraph');
    const txt = inlineTextToYXmlText(line);
    el.insert(0, [txt]);
    elements.push(el);
    i++;
  }

  return elements;
}

type InlineAttrs = { bold?: true; italic?: true; code?: true; link?: { href: string } };

function inlineTextToYXmlText(text: string): Y.XmlText {
  const txt = new Y.XmlText();
  const segments = parseInline(text);
  let offset = 0;
  for (const seg of segments) {
    const attrs: Record<string, boolean | { href: string } | null> = {};
    if (seg.bold) attrs['bold'] = true;
    if (seg.italic) attrs['italic'] = true;
    if (seg.code) attrs['code'] = true;
    if (seg.link) attrs['link'] = seg.link;
    txt.insert(offset, seg.text, Object.keys(attrs).length ? attrs : undefined);
    offset += seg.text.length;
  }
  return txt;
}

interface Segment {
  text: string;
  bold?: true;
  italic?: true;
  code?: true;
  link?: { href: string };
}

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < text.length) {
    // Inline code
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        segments.push({ text: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }

    // Bold+italic ***
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end !== -1) {
        segments.push({ text: text.slice(i + 3, end), bold: true, italic: true });
        i = end + 3;
        continue;
      }
    }

    // Bold **
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        segments.push({ text: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }

    // Italic *
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        segments.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const linkText = text.slice(i + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen);
          segments.push({ text: linkText, link: { href } });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Accumulate plain text
    let j = i + 1;
    while (j < text.length && !'`*['.includes(text[j])) j++;
    segments.push({ text: text.slice(i, j) });
    i = j;
  }

  return segments;
}
