import { Image } from 'expo-image';
import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { getApiUrl } from '@/lib/config';

// ── Inline parser ──────────────────────────────────────────────────────────────

type InlineSpan =
  | { k: 'text'; v: string }
  | { k: 'bold'; v: string }
  | { k: 'italic'; v: string }
  | { k: 'bolditalic'; v: string }
  | { k: 'strike'; v: string }
  | { k: 'code'; v: string }
  | { k: 'link'; v: string; url: string };

function parseInline(raw: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let s = raw;
  while (s.length > 0) {
    const bolditalic = s.match(/^\*\*\*(.+?)\*\*\*/s);
    const bold = s.match(/^\*\*(.+?)\*\*/s);
    const italic = s.match(/^\*(.+?)\*/s);
    const strike = s.match(/^~~(.+?)~~/s);
    const code = s.match(/^`(.+?)`/s);
    const link = s.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (bolditalic) {
      spans.push({ k: 'bolditalic', v: bolditalic[1] });
      s = s.slice(bolditalic[0].length);
    } else if (bold) {
      spans.push({ k: 'bold', v: bold[1] });
      s = s.slice(bold[0].length);
    } else if (italic) {
      spans.push({ k: 'italic', v: italic[1] });
      s = s.slice(italic[0].length);
    } else if (strike) {
      spans.push({ k: 'strike', v: strike[1] });
      s = s.slice(strike[0].length);
    } else if (code) {
      spans.push({ k: 'code', v: code[1] });
      s = s.slice(code[0].length);
    } else if (link) {
      spans.push({ k: 'link', v: link[1], url: link[2] });
      s = s.slice(link[0].length);
    } else {
      const next = s.search(/\*\*\*|\*\*|\*|~~|`|\[/);
      if (next <= 0) {
        spans.push({ k: 'text', v: next === 0 ? s[0] : s });
        s = next === 0 ? s.slice(1) : '';
      } else {
        spans.push({ k: 'text', v: s.slice(0, next) });
        s = s.slice(next);
      }
    }
  }
  return spans;
}

function InlineText({ raw, style, codeStyle }: { raw: string; style: object; codeStyle: object }) {
  const spans = parseInline(raw);
  return (
    <Text style={style}>
      {spans.map((sp, i) => {
        switch (sp.k) {
          case 'bolditalic':
            return <Text key={i} style={{ fontWeight: '700', fontStyle: 'italic' }}>{sp.v}</Text>;
          case 'bold':
            return <Text key={i} style={{ fontWeight: '700' }}>{sp.v}</Text>;
          case 'italic':
            return <Text key={i} style={{ fontStyle: 'italic' }}>{sp.v}</Text>;
          case 'strike':
            return <Text key={i} style={{ textDecorationLine: 'line-through' }}>{sp.v}</Text>;
          case 'code':
            return <Text key={i} style={codeStyle}>{sp.v}</Text>;
          case 'link':
            return (
              <Text
                key={i}
                style={{ color: '#4263eb', textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(sp.url)}
              >
                {sp.v}
              </Text>
            );
          default:
            return <Text key={i}>{sp.v}</Text>;
        }
      })}
    </Text>
  );
}

// ── Block parser ──────────────────────────────────────────────────────────────

type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'pdf'; src: string; title: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'ordered'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'task'; done: boolean; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') { i++; continue; }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Table: starts with |
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Skip separator rows (| --- | --- |)
      const rows = tableLines
        .filter((l) => !/^\|[\s|:-]+\|$/.test(l))
        .map((l) =>
          l
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim()),
        );
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }

    // PDF embed: [pdf-embed](url "title")
    const pdfMatch = /^\[pdf-embed\]\(([^)]+)\s+"([^"]+)"\)$/.exec(line.trim());
    if (pdfMatch) {
      blocks.push({ type: 'pdf', src: pdfMatch[1], title: pdfMatch[2] });
      i++;
      continue;
    }

    // Image: ![alt](url)
    const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (imgMatch) {
      blocks.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    // Heading
    const hMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length;
      const type = `h${level}` as Block['type'];
      blocks.push({ type, text: hMatch[2] } as Block);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Task list item
    const taskDone = /^- \[x\] (.+)/i.exec(line);
    const taskOpen = /^- \[ \] (.+)/.exec(line);
    if (taskDone) { blocks.push({ type: 'task', done: true, text: taskDone[1] }); i++; continue; }
    if (taskOpen) { blocks.push({ type: 'task', done: false, text: taskOpen[1] }); i++; continue; }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i]) && !/^- \[[ x]\]/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ordered', items });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        qLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'blockquote', text: qLines.join('\n') });
      continue;
    }

    // Inline image in paragraph
    if (/!\[[^\]]*\]\([^)]+\)/.test(line)) {
      // If the whole line is an image, it was caught above. Otherwise treat as paragraph
      blocks.push({ type: 'paragraph', text: line });
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function useStyles() {
  const dark = useColorScheme() === 'dark';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const codeBg = dark ? '#1e1e2e' : '#f1f3f5';
  const codeText = dark ? '#cdd6f4' : '#1e1e2e';
  const borderColor = dark ? '#373a40' : '#dee2e6';
  const mutedColor = dark ? '#868e96' : '#6c757d';

  return {
    textColor,
    codeBg,
    codeText,
    borderColor,
    mutedColor,
    dark,
    h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4, color: textColor, marginBottom: 10, marginTop: 6 },
    h2: { fontSize: 21, fontWeight: '700' as const, color: textColor, marginBottom: 8, marginTop: 6 },
    h3: { fontSize: 17, fontWeight: '600' as const, color: textColor, marginBottom: 6, marginTop: 4 },
    h4: { fontSize: 15, fontWeight: '600' as const, color: textColor, marginBottom: 4, marginTop: 4 },
    h5: { fontSize: 14, fontWeight: '600' as const, color: mutedColor, marginBottom: 4 },
    h6: { fontSize: 13, fontWeight: '600' as const, color: mutedColor, marginBottom: 4 },
    body: { fontSize: 15, lineHeight: 24, color: textColor },
    inlineCode: {
      fontFamily: 'monospace',
      fontSize: 13,
      backgroundColor: codeBg,
      paddingHorizontal: 4,
      borderRadius: 3,
      color: codeText,
    } as object,
  };
}

// ── Block renderers ───────────────────────────────────────────────────────────

function CodeBlock({ lang, code, s }: { lang: string; code: string; s: ReturnType<typeof useStyles> }) {
  return (
    <View
      style={{
        backgroundColor: s.codeBg,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {lang ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 }}>
          <Text style={{ fontSize: 11, color: s.mutedColor, fontFamily: 'monospace' }}>{lang}</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 20,
            color: s.codeText,
            padding: 12,
            paddingTop: lang ? 4 : 12,
          }}
          selectable
        >
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

function TableBlock({ rows, s }: { rows: string[][]; s: ReturnType<typeof useStyles> }) {
  if (!rows.length) return null;
  const [header, ...body] = rows;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
      <View style={{ borderWidth: 1, borderColor: s.borderColor, borderRadius: 6, overflow: 'hidden' }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', backgroundColor: s.dark ? '#25262b' : '#f8f9fa' }}>
          {header.map((cell, ci) => (
            <View
              key={ci}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRightWidth: ci < header.length - 1 ? 1 : 0,
                borderRightColor: s.borderColor,
                minWidth: 80,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: s.textColor }}>{cell}</Text>
            </View>
          ))}
        </View>
        {/* Body rows */}
        {body.map((row, ri) => (
          <View
            key={ri}
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: s.borderColor,
              backgroundColor: ri % 2 === 1 && s.dark ? '#1e1f24' : 'transparent',
            }}
          >
            {row.map((cell, ci) => (
              <View
                key={ci}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRightWidth: ci < row.length - 1 ? 1 : 0,
                  borderRightColor: s.borderColor,
                  minWidth: 80,
                }}
              >
                <InlineText raw={cell} style={{ fontSize: 13, color: s.textColor }} codeStyle={s.inlineCode} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function PdfBlock({ src, title, s }: { src: string; title: string; s: ReturnType<typeof useStyles> }) {
  const fullUrl = src.startsWith('http') ? src : `${getApiUrl()}${src}`;
  return (
    <Pressable
      onPress={() => Linking.openURL(fullUrl)}

      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: s.borderColor,
        borderRadius: 8,
        marginBottom: 12,
        backgroundColor: pressed
          ? (s.dark ? '#2c2d32' : '#f1f3f5')
          : (s.dark ? '#25262b' : '#f8f9fa'),
      })}
    >
      <Text style={{ fontSize: 22 }}>📄</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: s.textColor }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#4263eb', marginTop: 2 }}>Tap to open PDF</Text>
      </View>
      <Text style={{ fontSize: 16, color: s.mutedColor }}>›</Text>
    </Pressable>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  const s = useStyles();
  const blocks = parseBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h1': return <InlineText key={i} raw={block.text} style={s.h1} codeStyle={s.inlineCode} />;
          case 'h2': return <InlineText key={i} raw={block.text} style={s.h2} codeStyle={s.inlineCode} />;
          case 'h3': return <InlineText key={i} raw={block.text} style={s.h3} codeStyle={s.inlineCode} />;
          case 'h4': return <InlineText key={i} raw={block.text} style={s.h4} codeStyle={s.inlineCode} />;
          case 'h5': return <InlineText key={i} raw={block.text} style={s.h5} codeStyle={s.inlineCode} />;
          case 'h6': return <InlineText key={i} raw={block.text} style={s.h6} codeStyle={s.inlineCode} />;

          case 'paragraph':
            return (
              <InlineText
                key={i}
                raw={block.text}
                style={[s.body, { marginBottom: 8 }]}
                codeStyle={s.inlineCode}
              />
            );

          case 'code':
            return <CodeBlock key={i} lang={block.lang} code={block.code} s={s} />;

          case 'table':
            return <TableBlock key={i} rows={block.rows} s={s} />;

          case 'pdf':
            return <PdfBlock key={i} src={block.src} title={block.title} s={s} />;

          case 'image':
            return (
              <Image
                key={i}
                source={{ uri: block.src }}
                style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8, marginBottom: 12 }}
                contentFit="cover"
              />
            );

          case 'hr':
            return (
              <View
                key={i}
                style={{ height: 1, backgroundColor: s.borderColor, marginVertical: 12 }}
              />
            );

          case 'blockquote':
            return (
              <View
                key={i}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: '#4263eb',
                  paddingLeft: 12,
                  marginBottom: 8,
                  opacity: 0.75,
                }}
              >
                <InlineText raw={block.text} style={s.body} codeStyle={s.inlineCode} />
              </View>
            );

          case 'task':
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                <Text style={[s.body, { color: '#4263eb', marginRight: 6 }]}>
                  {block.done ? '☑' : '☐'}
                </Text>
                <InlineText
                  raw={block.text}
                  style={[s.body, { flex: 1, textDecorationLine: block.done ? 'line-through' : 'none', opacity: block.done ? 0.5 : 1 }]}
                  codeStyle={s.inlineCode}
                />
              </View>
            );

          case 'bullet':
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                {block.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 }}>
                    <Text style={[s.body, { marginRight: 8 }]}>•</Text>
                    <InlineText raw={item} style={[s.body, { flex: 1 }]} codeStyle={s.inlineCode} />
                  </View>
                ))}
              </View>
            );

          case 'ordered':
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                {block.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 }}>
                    <Text style={[s.body, { marginRight: 6, minWidth: 22 }]}>{ii + 1}.</Text>
                    <InlineText raw={item} style={[s.body, { flex: 1 }]} codeStyle={s.inlineCode} />
                  </View>
                ))}
              </View>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
