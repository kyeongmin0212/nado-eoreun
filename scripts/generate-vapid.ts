/** VAPID 키 쌍을 생성해 화면에만 출력한다. 파일이나 문서에 저장하지 않는다. */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("아래 두 줄을 .env.local 과 Vercel 환경변수에 넣으세요. (문서·커밋 금지)");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com  # 실제 연락처로 교체");
