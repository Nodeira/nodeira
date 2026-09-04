/*
 * Generates platform icon formats from the canonical web logo. Run with:
 *   pnpm run icons
 *
 * The logo deliberately contains only circles, round lines, and rounded
 * rectangles. Rasterizing those primitives here keeps icon generation
 * dependency-free and works on every platform that can run Node.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const source = path.resolve(__dirname, "../../web/public/logo.svg");
const outputDir = path.resolve(__dirname, "../assets");
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024];
const sampleOffsets = [0.125, 0.375, 0.625, 0.875];

function attributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

function color(hex) {
  if (hex === "white") return [255, 255, 255];
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function roundedRectContains(x, y, left, top, width, height, radius) {
  const cx = Math.max(left + radius, Math.min(x, left + width - radius));
  const cy = Math.max(top + radius, Math.min(y, top + height - radius));
  return Math.hypot(x - cx, y - cy) <= radius;
}

function parseShapes(svg) {
  const shapes = [];
  for (const match of svg.matchAll(/<(line|circle|rect)\s+([^>]+?)\/?>(?:<\/\1>)?/g)) {
    const [, name, markup] = match;
    const attr = attributes(markup);
    const paint = color(attr.fill ?? attr.stroke);
    if (name === "line") {
      shapes.push({
        color: paint,
        contains: (x, y) => distanceToSegment(x, y, +attr.x1, +attr.y1, +attr.x2, +attr.y2) <= +attr["stroke-width"] / 2,
      });
    } else if (name === "circle") {
      shapes.push({ color: paint, contains: (x, y) => Math.hypot(x - +attr.cx, y - +attr.cy) <= +attr.r });
    } else {
      shapes.push({
        color: paint,
        contains: (x, y) => roundedRectContains(x, y, +attr.x, +attr.y, +attr.width, +attr.height, +(attr.rx ?? 0)),
      });
    }
  }
  return shapes;
}

function rasterize(svg, size) {
  const viewBox = svg.match(/viewBox="([^"]+)"/);
  if (!viewBox) throw new Error("The source logo needs a viewBox");
  const [, , viewWidth, viewHeight] = viewBox[1].split(/\s+/).map(Number);
  const scale = size / Math.max(viewWidth, viewHeight);
  const pixels = Buffer.alloc(size * size * 4);
  for (const shape of parseShapes(svg)) {
    for (let py = 0; py < size; py += 1) for (let px = 0; px < size; px += 1) {
      let covered = 0;
      for (const oy of sampleOffsets) for (const ox of sampleOffsets) {
        if (shape.contains((px + ox) / scale, (py + oy) / scale)) covered += 1;
      }
      if (covered === 0) continue;
      const alpha = covered / 16;
      const offset = (py * size + px) * 4;
      const inverse = 1 - alpha;
      pixels[offset] = shape.color[0] * alpha + pixels[offset] * inverse;
      pixels[offset + 1] = shape.color[1] * alpha + pixels[offset + 1] * inverse;
      pixels[offset + 2] = shape.color[2] * alpha + pixels[offset + 2] * inverse;
      pixels[offset + 3] = 255 * alpha + pixels[offset + 3] * inverse;
    }
  }
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha === 0) continue;
    pixels[offset] = Math.min(255, Math.round((pixels[offset] * 255) / alpha));
    pixels[offset + 1] = Math.min(255, Math.round((pixels[offset + 1] * 255) / alpha));
    pixels[offset + 2] = Math.min(255, Math.round((pixels[offset + 2] * 255) / alpha));
  }
  return pixels;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function createPng(pixels, size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels.copy(rows, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(6, 9);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

function createIcns(images) {
  const typeForSize = new Map([[16, "icp4"], [32, "icp5"], [64, "icp6"], [128, "ic07"], [256, "ic08"], [512, "ic09"], [1024, "ic10"]]);
  const chunks = images.filter(({ size }) => typeForSize.has(size)).map(({ size, png }) => {
    const chunk = Buffer.alloc(8);
    chunk.write(typeForSize.get(size), 0, 4, "ascii");
    chunk.writeUInt32BE(png.length + chunk.length, 4);
    return Buffer.concat([chunk, png]);
  });
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(header.length + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

const svg = fs.readFileSync(source, "utf8");
const images = sizes.map((size) => ({ size, png: createPng(rasterize(svg, size), size) }));
fs.mkdirSync(outputDir, { recursive: true });
for (const { size, png } of images) fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), png);
fs.writeFileSync(path.join(outputDir, "icon.png"), images.find(({ size }) => size === 512).png);
fs.writeFileSync(path.join(outputDir, "icon.ico"), createIco(images.filter(({ size }) => [16, 20, 24, 32, 40, 48, 64, 256].includes(size))));
fs.writeFileSync(path.join(outputDir, "icon.icns"), createIcns(images));
