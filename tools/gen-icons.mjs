/*
 * Draws the Workflow app icons and writes them as PNGs.
 * No dependencies - raster by signed distance fields, encode by hand.
 *
 *   node tools/gen-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const INK = [16, 16, 19];        // near black, matches --fg
const PAPER = [255, 255, 255];

/* ------------------------------------------------------------ PNG writing */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {Uint8Array} rgba tightly packed size*size*4 */
function encodePNG(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------- shape distance */

// All shapes take coordinates in a 0..1 space and return a signed distance,
// negative inside. Rendering samples them, so edges come out antialiased.

function sdRoundedRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

function sdSegment(x, y, ax, ay, bx, by) {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/**
 * The mark: a calendar page with its top rail and one day filled in.
 * @param scale shrink the artwork toward the centre (maskable safe zone)
 */
function markDistance(x, y, scale) {
  const sx = 0.5 + (x - 0.5) / scale;
  const sy = 0.5 + (y - 0.5) / scale;

  const stroke = 0.052 / 2;
  const page = Math.abs(sdRoundedRect(sx, sy, 0.5, 0.52, 0.28, 0.28, 0.085)) - stroke;
  const rail = sdSegment(sx, sy, 0.235, 0.375, 0.765, 0.375) - stroke;
  const day = sdCircle(sx, sy, 0.5, 0.60, 0.072);
  return Math.min(page, rail, day);
}

/* ------------------------------------------------------------- rendering */

function renderIcon(size, { bg, fg, scale = 1, rounded = false }) {
  const rgba = new Uint8Array(size * size * 4);
  const samples = 3;             // 3x3 supersampling
  const step = 1 / (size * samples);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let markCover = 0;
      let bgCover = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (markDistance(x, y, scale) <= 0) markCover++;
          // Squircle plate for the Apple touch icon, full bleed otherwise.
          if (!rounded || sdRoundedRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.225) <= 0) bgCover++;
        }
      }
      const total = samples * samples;
      const a = bgCover / total;
      const m = Math.min(markCover / total, a);
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) {
        // Composite the mark over the plate, then the plate over transparency.
        rgba[i + c] = Math.round((bg[c] * (a - m) + fg[c] * m) / (a || 1));
      }
      rgba[i + 3] = Math.round(a * 255);
      void step;
    }
  }
  return encodePNG(rgba, size);
}

/* ----------------------------------------------------------------- output */

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, { bg: INK, fg: PAPER }],
  ['icon-512.png', 512, { bg: INK, fg: PAPER }],
  ['icon-maskable-512.png', 512, { bg: INK, fg: PAPER, scale: 0.72 }],
  ['apple-touch-icon.png', 180, { bg: INK, fg: PAPER }],
  ['favicon-32.png', 32, { bg: INK, fg: PAPER }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), renderIcon(size, opts));
  console.log(`wrote icons/${name} (${size}x${size})`);
}

// Vector version, for browsers that prefer it.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="22" fill="#101013"/>
  <g fill="none" stroke="#ffffff" stroke-width="5.2" stroke-linecap="round">
    <rect x="22" y="24" width="56" height="56" rx="8.5"/>
    <path d="M23.5 37.5h53"/>
  </g>
  <circle cx="50" cy="60" r="7.2" fill="#ffffff"/>
</svg>
`;
writeFileSync(join(OUT, 'icon.svg'), svg);
console.log('wrote icons/icon.svg');
