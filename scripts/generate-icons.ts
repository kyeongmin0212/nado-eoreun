/** 앱 아이콘 PNG 생성 (sharp). 글꼴 의존 없이 도형만 사용한다. 실행: pnpm icons:generate */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CORAL = "#FF7A6B";
const PEACH = "#FFE3DC";
const CHARCOAL = "#2F2A33";

function appIcon(size: number, { maskable = false } = {}): string {
  // 두 사람(겹친 원) + 작은 하트. maskable 은 여백을 넓힌다.
  const pad = maskable ? size * 0.12 : 0;
  const inner = size - pad * 2;
  const r = maskable ? 0 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const headR = inner * 0.13;
  const bodyR = inner * 0.22;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${CORAL}"/>
  <g>
    <circle cx="${cx - inner * 0.13}" cy="${cy - inner * 0.06}" r="${headR}" fill="${PEACH}"/>
    <circle cx="${cx + inner * 0.13}" cy="${cy - inner * 0.06}" r="${headR}" fill="#FFFFFF"/>
    <ellipse cx="${cx - inner * 0.13}" cy="${cy + inner * 0.2}" rx="${bodyR}" ry="${bodyR * 0.72}" fill="${PEACH}"/>
    <ellipse cx="${cx + inner * 0.13}" cy="${cy + inner * 0.2}" rx="${bodyR}" ry="${bodyR * 0.72}" fill="#FFFFFF"/>
    <path transform="translate(${cx - inner * 0.07}, ${cy - inner * 0.36}) scale(${inner / 700})"
      d="M50 85 L15 50 A20 20 0 0 1 50 25 A20 20 0 0 1 85 50 Z" fill="${CHARCOAL}"/>
  </g>
</svg>`;
}

function badgeIcon(size: number): string {
  // 단색 배지 (흰색, 투명 배경)
  const c = size / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${c - size * 0.14}" cy="${c - size * 0.1}" r="${size * 0.14}" fill="#fff"/>
  <circle cx="${c + size * 0.14}" cy="${c - size * 0.1}" r="${size * 0.14}" fill="#fff"/>
  <ellipse cx="${c - size * 0.14}" cy="${c + size * 0.22}" rx="${size * 0.22}" ry="${size * 0.16}" fill="#fff"/>
  <ellipse cx="${c + size * 0.14}" cy="${c + size * 0.22}" rx="${size * 0.22}" ry="${size * 0.16}" fill="#fff"/>
</svg>`;
}

async function main() {
  const out = join(process.cwd(), "public", "icons");
  mkdirSync(out, { recursive: true });
  const jobs: Array<[string, string]> = [
    ["icon-192.png", appIcon(192)],
    ["icon-512.png", appIcon(512)],
    ["maskable-512.png", appIcon(512, { maskable: true })],
    ["apple-touch-icon.png", appIcon(180)],
    ["badge-72.png", badgeIcon(72)],
  ];
  for (const [name, svg] of jobs) {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(join(out, name), png);
    console.log("wrote", name, png.length, "bytes");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
