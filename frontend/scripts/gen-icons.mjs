// Generates simple PWA icons (an oil drop on the LubeGuard dark background)
// as PNG files with no dependencies. Run: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const ss = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const p = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          r += p[0]; g += p[1]; b += p[2]; a += p[3];
        }
      const n = ss * ss;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / n; raw[o + 1] = g / n; raw[o + 2] = b / n; raw[o + 3] = a / n;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [11, 14, 20, 255];
const CARD = [21, 26, 35, 255];
const CYAN = [6, 182, 212, 255];
const LIGHT = [165, 243, 252, 255];

function inDrop(x, y, cx, cy, r) {
  // circle plus a tapered tip pointing up
  const dx = x - cx, dy = y - cy;
  if (dx * dx + dy * dy <= r * r) return true;
  const tipY = cy - r * 2.1;
  if (y < tipY || y > cy) return false;
  const t = (y - tipY) / (cy - tipY);
  const half = r * Math.sin(Math.acos(Math.min(1, 1 - t))) * t;
  return Math.abs(dx) <= Math.max(0, half);
}
function makePixel(scale, rounded) {
  return (x, y) => {
    if (rounded) {
      const rr = 0.18, m = Math.max(Math.abs(x - 0.5) - (0.5 - rr), 0) ** 2 + Math.max(Math.abs(y - 0.5) - (0.5 - rr), 0) ** 2;
      if (m > rr * rr) return [0, 0, 0, 0];
    }
    const cx = 0.5, cy = 0.5 + 0.1 * scale, r = 0.2 * scale;
    if (inDrop(x, y, cx, cy, r)) {
      const hx = x - (cx - r * 0.35), hy = y - (cy - r * 0.2);
      if (hx * hx + hy * hy < (r * 0.22) ** 2) return LIGHT;
      return CYAN;
    }
    const d = Math.hypot(x - 0.5, y - 0.5);
    if (d < 0.4 * scale && d > 0.37 * scale) return CARD;
    return BG;
  };
}
writeFileSync(resolve(out, 'icon-192.png'), png(192, makePixel(1, true)));
writeFileSync(resolve(out, 'icon-512.png'), png(512, makePixel(1, true)));
writeFileSync(resolve(out, 'maskable-512.png'), png(512, makePixel(0.75, false)));
console.log('icons written to', out);
