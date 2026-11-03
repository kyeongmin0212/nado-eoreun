/**
 * 디자인 최종안(2026-10-30) 브랜드 에셋을 앱 아이콘·로고로 변환한다. 원본 PNG 경로를 인자로 받는다.
 * 실행: node scripts/brand-assets.mjs <app_icon_1024.png> <typo_logo.png>
 * 결과: public/icons/*(PWA·iOS 아이콘), public/brand/icon-128.png(헤더), public/brand/logo.png(로그인)
 */
import sharp from "sharp";

const [iconSrc, logoSrc] = process.argv.slice(2);
if (!iconSrc || !logoSrc) {
  console.error("사용법: node scripts/brand-assets.mjs <app_icon.png> <typo_logo.png>");
  process.exit(1);
}
const CHARCOAL = { r: 0x2e, g: 0x2a, b: 0x33, alpha: 1 };

// 원본은 모서리가 둥근 아이콘이다. iOS·안드로이드는 자체 마스크를 씌우므로 모서리를 차콜로 채운 정사각형을 만든다.
async function fullBleed(size) {
  const inner = await sharp(iconSrc).resize(size, size).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CHARCOAL } })
    .composite([{ input: inner }])
    .png()
    .toBuffer();
}

async function main() {
  await sharp(await fullBleed(512)).toFile("public/icons/icon-512.png");
  await sharp(await fullBleed(512)).resize(192, 192).toFile("public/icons/icon-192.png");
  await sharp(await fullBleed(512)).resize(180, 180).toFile("public/icons/apple-touch-icon.png");
  // maskable: 안전 영역(지름 80%) 안에 문 모양이 들어오도록 82% 로 줄여 가운데 둔다.
  const shrunk = await sharp(iconSrc).resize(420, 420).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: CHARCOAL } })
    .composite([{ input: shrunk, top: 46, left: 46 }])
    .png()
    .toFile("public/icons/maskable-512.png");
  // 헤더용 작은 아이콘(둥근 모서리 그대로, 투명 배경 유지)
  await sharp(iconSrc).resize(128, 128).png({ compressionLevel: 9 }).toFile("public/brand/icon-128.png");
  await sharp(iconSrc).resize(256, 256).png({ compressionLevel: 9 }).toFile("public/brand/icon-256.png");
  // 타이포 로고: 로그인 화면 너비 약 300px 기준 2배
  await sharp(logoSrc).resize({ width: 640 }).png({ compressionLevel: 9 }).toFile("public/brand/logo.png");
  console.log("brand assets written");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
