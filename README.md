# 나도으른

**부모와 함께 사는 20~25세 미혼 성인 여성이 외출 확인 연락을 받았을 때 사진을 준비하고 친구에게 도움을 요청하는 모바일 PWA.**

성인의 사생활과 부모의 안전 걱정을 함께 존중한다. 핵심 과업은 **사진 준비·저장**과 **상황 전달·친구 응답 확인**이다. 등록 사진과 저장 상황을 재사용해 자료 준비와 연락 조율의 부담을 줄인다.

## 제출 문서

| 문서 | 내용 |
| --- | --- |
| [문제정의·기능 명세](docs/problem.yaml) | 앞면 ①~⑥, 뒷면 경험·5 Whys·해법·통찰과 기능 명세 |
| [앞면·뒷면 캔버스](docs/problem-canvas.md) | 종이 양식 순서로 읽는 전체 검토본과 점검표 |
| [사용 시나리오](docs/scenarios.yaml) | 모바일 사용 이유와 핵심 흐름의 단계·기대 결과 |
| [제품 기획서](docs/product-plan.md) | 동기·고객·문제·대안·해법·사회적 지향·효과 측정 |
| [최신 설문 근거](docs/survey-39-evidence.yaml) | 39명 기준 표시와 문항별 원집계, 이전 교차 집계의 구분 |
| [수정 이유·랄프 검토](docs/planning-ralph-review.md) | 점수 이력 비교, 기능 선택 근거와 실제 검증 결과 |
| [점수 변화 분석](docs/planning-score-analysis-18-5.md) | 17.5→18.5점 구간의 관측·추론을 보존한 과거 분석 |
| [구현 기준](docs/implementation-decisions.md) | 기획·기능·최신 개발 기록의 연결 |
| [시나리오 인수인계](docs/scenario-handoff.md) | 기존 계정·입력·화면·검사 연결 |

기본 브랜치 `main`의 문제정의와 시나리오를 제출 기준으로 삼는다. [22명 시점 설문](docs/survey-evidence.yaml)과 [37명 시점 설문](docs/survey-37-evidence.yaml)은 이력으로 보존한다.

## 문제와 근거

이미 외출한 사용자가 확인 연락에 대응할 사진을 준비하고 친구 요청 상태를 파악하는 데 집중한다. [캔버스](docs/problem-canvas.md)에 실제 경험과 설문 근거를, [핵심 기획안](docs/product-plan.md)에 제공할 결과를 정리했다.

## 설치·실행

Next.js 16 + TypeScript + Tailwind v4, Supabase(Auth·Postgres·Storage·Realtime), OpenAI Image API(`gpt-image-2.5-sunburst`), Web Push. 요구 사항: Node 20 이상(개발 환경 Node 26), pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # 값은 이 파일에만 (커밋 금지)
pnpm dev                     # http://localhost:3000
```

1. **Supabase 스키마** — `supabase/migrations/*.sql` 을 순서대로 적용한다. SQL Editor 에 붙여 넣거나, CLI 로 `supabase link --project-ref <ref>` 뒤 `supabase db query --linked --file supabase/migrations/<파일>.sql` 을 파일마다 실행하고 `supabase migration repair --status applied <버전> --linked` 로 이력을 기록한다(DB 비밀번호 불필요). `supabase db push` 는 DB 비밀번호가 필요하다.
2. **키** — Supabase URL·publishable key·legacy service_role key, OpenAI API 키를 `.env.local` 에 넣는다. VAPID 키는 `pnpm vapid:generate` 로 만든다.
3. **테스트 계정** — `.env.local` 의 `DEMO_USER_1..3_*` 를 채운 뒤 `pnpm seed:demo`. Auth 사용자 3명(이미 있으면 유지), 프로필, 1↔2·1↔3·2↔3 친구 관계, 상호 사진 사용 동의, 계정 1·2 의 AI 프로필 정면 사진(가상 인물, 없을 때만)을 만든다. 중복 실행해도 안전하고 기존 사진·요청은 지우지 않는다. 비밀번호를 .env 값으로 맞추려면 `--update-password`.
   - 새 사용자는 첫 화면 **회원가입하기**로 가입한다: 아이디로 쓸 이메일 → **인증하기**(6자리 인증번호 메일) → **확인** → 비밀번호·비밀번호 확인 → **가입하기**. 메일은 아래 `SMTP_*` 로 보내며, 설정이 없으면 가입 화면이 `이메일 발송 연결 대기`로 막힌다. 예전 아이디 가입 계정은 Supabase 에 `<아이디>@id.nado-eoreun.invalid` 로 저장돼 있어 로그인 칸에 아이디만 넣어도 된다. 테스트·시드 계정은 이메일과 비밀번호로 바로 로그인한다.
4. **검사** — `pnpm typecheck`, `pnpm lint`, `pnpm build`.
5. **실제 이미지 1건** — `pnpm smoke:image <add_friend|background_create|background_swap> <사진A> [<사진B>|"배경 설명"]`. 실제 사진이 없으면 `pnpm smoke:inputs` 로 가상 인물 사진 4장을 만든다(과금).
6. **개발 서버 주의** — `pnpm build` 를 돌린 뒤 `pnpm dev` 가 페이지를 무한 새로고침하거나 새 라우트를 404 로 주면 `rm -rf .next` 후 다시 띄운다.

## 환경변수

| 이름 | 용도 | 설정 위치 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 로컬 `.env.local`, Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 클라이언트·서버 공용 공개 키 | 로컬, Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용(푸시 발송·seed). legacy service_role JWT | 로컬, Vercel |
| `OPENAI_API_KEY` | 이미지 생성(기본 경로) | 로컬, Vercel |
| `IMAGE_MODEL_ID` / `IMAGE_QUALITY` | 모델(`gpt-image-2.5-sunburst`)·품질 | 로컬, Vercel |
| `AI_GATEWAY_API_KEY` | 대체 경로(Vercel AI Gateway). 주최 측 실행·CI 가 이 이름으로 키를 넣는다 | docker/CI, GitHub Secrets |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push | 로컬, Vercel |
| `NEXT_PUBLIC_APP_URL` | 배포 도메인 | 로컬, Vercel |
| `CRON_SECRET` | 통금 알림 스케줄러(pg_cron 등)가 `POST /api/cron/curfew` 에 `x-cron-secret` 헤더로 보내는 값 | 로컬, Vercel, pg_cron 잡 |
| `CURFEW_SCHEDULER` | `off` 면 서버 내 타이머 비활성, `inprocess` 면 Supabase 모드에서도 서버 내 타이머 사용(로컬 개발용). docker(local) 모드는 기본으로 켜짐 | 선택 |
| `RELEASE_ID` | `/__health` 의 releaseId(Vercel 은 `VERCEL_GIT_COMMIT_SHA` 자동) | CI·docker 빌드 인자 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 가입 인증번호 메일(외부 서버는 HOST·USER·PASS가 모두 있어야 켜지며 PORT 기본값은 465. 검사용 수신기 `localhost`·`127.0.0.1`·`::1`은 계정 없이). Gmail 예: `smtp.gmail.com` / `465` / Gmail 주소 / 앱 비밀번호(Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호) | 로컬, Vercel |
| `MAIL_FROM` / `SMTP_SECURE` | 보내는 사람 표시(기본 `나도으른 <SMTP_USER>`)·TLS 강제 여부(기본: 465 면 켬) | 선택 |
| `DEMO_USER_*` | seed 스크립트 전용 | 로컬만 |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `DATABASE_URL` | 주최 측 docker 실행용 시드 계정·DB | `docker-compose.yml`에 기재하며 앱 기동 시 자동 준비 |

## 배포 (Vercel)

현재 프로덕션: **https://nado-eoreun.vercel.app** (프로젝트 `contentruck/nado-eoreun`). 재배포는 저장소 루트에서 `vercel --prod --yes`.

1. 저장소를 Vercel 에 연결(Framework: Next.js, pnpm). 로컬 CLI 는 `vercel link` → `vercel env add` → `vercel --prod`.
2. 위 표의 Vercel 열 변수를 Production/Preview 에 등록한다. `NEXT_PUBLIC_APP_URL` 은 배포 도메인.
3. `GET /__health` 가 로그인 없이 `{"releaseId": "<commit>"}` 를 `Cache-Control: no-store` 로 응답하는지 확인한다(대시보드 UP·배포 버전 표시용).
4. 배포 URL 을 대시보드 `PUT /api/teams/{teamId}/deploy` 에 등록한다(팀 코드 필요, 또는 우리 팀 → 정보 → 배포 URL 변경).
5. 함수 지역은 `vercel.json` 의 `cdg1`(파리)이다. Supabase 프로젝트(eu-west-3, 파리)와 같은 지역에 두어 화면마다 여러 번 오가는 DB 조회 지연을 줄인다. 다른 지역의 Supabase 를 쓰면 이 값을 그 지역에 맞춘다.
6. 이미지 생성 라우트는 `maxDuration = 300`, 요청 본문은 클라이언트가 사진을 긴 변 1536px JPEG 로 줄여 4.5MB 제한 안에 둔다. 배포 도메인을 바꾸면 iPhone 설치·푸시 구독은 새 도메인에서 다시 만든다.

## iPhone 설치·알림·시연

앱을 닫아도 SOS 알림이 오려면 **홈 화면에 추가한 앱**에서 알림을 켜야 한다(iOS 16.4 이상, Safari 탭에서는 Web Push 구독을 만들 수 없다).

1. 각 iPhone Safari 에서 배포 도메인을 열고 로그인(또는 **회원가입하기**) → 공유 → **홈 화면에 추가** → 홈 화면의 나도으른 아이콘으로 연다.
2. 앱 홈의 **알림 켜기** 카드(설치된 앱에서만 보임), 또는 **MY → 알림 → 이 기기 알림 켜기**를 눌러 허용한다. 켜는 즉시 확인 알림 “알림이 켜졌어요. 앱을 닫아도 친구 SOS가 이렇게 와요.”가 온다. 앱을 완전히 닫고 잠금 화면에 이 알림이 오는지 먼저 확인한다.
3. 발신 기기: 홈 **SOS 보내기** → 상황 요약·받을 친구(오늘의 상황 동행인이 자동 선택) 확인 → **SOS**. 수신 기기 잠금·백그라운드 상태에 “비상사태! 엄마 전화다! 어셈블!” 알림이 도착하는지 확인한다.
4. 알림을 누르면 친구 SOS 화면이 열리고 발신 기기의 발송 상태에서 그 친구가 `열람함` 이 된다. **실제 동행인에게 전화하기**를 누르면 번호가 채워진 전화 화면이 열리고 발신 기기에서 `확인 · 통화 가능`으로 바뀐다. 번호가 없으면 **확인했어 · 전화할게**로 응답만 기록하고 “이제 직접 전화해 주세요”를 안내한다. 앱이 열려 있으면 화면 위 배너와 홈의 종 숫자로도 바로 보인다.
5. SOS 바로가기(웹앱 단계의 위젯 대신): Safari 에서 `<배포 도메인>/sos` 를 열고 **홈 화면에 추가** 하면 “나도으른 SOS” 아이콘이 SOS 화면으로 바로 열린다. MY → 일반 → SOS 바로가기에 같은 안내가 있다.
6. 통금 알림은 배포 환경에 `CRON_SECRET` 을 두고 Supabase `pg_cron` 이 1분마다 `/api/cron/curfew` 를 호출하도록 등록해야 온다(잡 SQL 은 비밀값을 포함하므로 저장소에 두지 않는다). 같은 잡이 30일 지난 생성 사진·상황 기록을 매시 정리한다.

## 주최 측 docker 실행·E2E

주최 측은 저장소의 `docker-compose.yml` 로 앱을 **빈 DB** 에서 띄우고 `e2e/scenarios/S1~S8.spec.ts` 를 실행한다. DB·시드 계정은 컨테이너에서 준비하며, 이미지 생성에는 주최 측 Gateway 연결과 키를 사용한다.

- `DATA_BACKEND=local`: 컨테이너 Postgres(`db`) + 앱 세션 로그인 + 파일 저장(`/data/storage`) + 폴링. 소유권·수신자 검사는 `src/lib/data/local/adapter.ts` 가 수행한다.
- 시작 시 `scripts/docker-start.mjs` 가 스키마(`src/lib/data/local/schema.sql`)·시드 계정(사용자 `user@example.com` / 친구1 `friend1@example.com` / 친구2 `friend2@example.com`, 비밀번호는 compose 에 기재)·상호 친구·상호 사진 사용 동의·AI 프로필 정면 사진(사용자·친구1)·사용자 보관 사진 2장(`seed/`)을 만든 뒤 서버를 띄운다. 통금 알림 타이머는 서버 안에서 1분마다 돈다.
- 이미지 생성은 `AI_GATEWAY_API_KEY`(주최 측이 넣음) → Vercel AI Gateway `openai/gpt-image-2.5-sunburst`, 품질 `low`.

```bash
docker compose down -v
docker compose up -d --build        # http://localhost:3000/__health 가 200 이면 준비
cd e2e && npm install && npx playwright install chromium
NODE_OPTIONS=--no-experimental-strip-types npx playwright test   # mobile 프로젝트, S1~S8
node checks/mail-sink.mjs &   # 검사용 메일 수신기(앱은 SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false 로 띄운다)
NODE_OPTIONS=--no-experimental-strip-types npx playwright test -c playwright.checks.config.ts   # 시나리오 밖 검사: 이메일 인증 가입·탈퇴
```

Supabase(Vercel) 배포 사이트에 대해 같은 spec 을 돌리려면 `E2E_BASE_URL`·`E2E_USER_*`·`E2E_FRIEND1_*`·`E2E_FRIEND2_NAME` 을 그 사이트의 계정으로 넘긴다(생성 흐름은 실제 과금).

CI: `.github/workflows/scenarios.yml` 이 `main` push(문서만 바뀐 push 제외)와 수동 실행에서 타입·린트·빌드 검사와 compose 기동 → `/__health` → E2E 를 수행한다. 이미지 흐름이 CI 에서 돌려면 GitHub Secrets 에 `AI_GATEWAY_API_KEY` 가 있어야 한다.

## 구현 상태와 기준 문서

- 구현 상태·검증 기록: [docs/STATUS.md](docs/STATUS.md), [docs/TEST_PLAN.md](docs/TEST_PLAN.md), 다음 작업: [docs/HANDOFF.md](docs/HANDOFF.md)
- 구현 결정: [docs/DECISIONS.md](docs/DECISIONS.md) (D21~D84), 제품 명세: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), 구현 지침: [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)
- 현재 화면·입력·수신 대상 규칙은 [제품 명세](docs/PRODUCT_SPEC.md)의 디자인 최종안을 따른다.

## 기획과 사용자 과업

- **사진 준비:** 등록한 내 사진과 동의받은 친구 사진을 골라 생성하고, 필요한 배경·헤어·포즈를 편집한 뒤 결과를 확인·저장한다.
- **친구 요청:** 오늘의 상황을 필요에 따라 저장하고 수신 대상을 확인해 SOS를 보낸다. 친구가 상세를 열거나 연락 가능 의사를 표시하면 발신자에게 구분해서 보인다.
- **기본 규칙:** 오늘의 상황 동행인이 기본 수신자, 없으면 전체 친구이며 전송 전에 바꿀 수 있다. 생성 사진은 본인만 조회하고 SOS에 자동 공유하지 않는다. 실제 동행인 번호가 있으면 전화 화면을 열고, 없으면 응답만 기록한다.
- **현행 범위:** 기능 15개·시나리오 8개. 자세한 [기능 선택 근거](docs/product-plan.md)와 [흐름별 검증](docs/scenario-handoff.md)을 참고한다.

## 실제 동작의 조건

사진 표시·팀 지시문·이메일 인증·재생성·보관·SOS·통금의 현행 조건은 [기획·구현 연결 기준](docs/implementation-decisions.md)에 모았다. 세션 입력과 최초 결과 v1의 재생성 분기까지 실제 코드에 맞춘 기준이다. 구체적인 입력·출력·완료 조건은 [기능 명세](docs/problem.yaml)를 따른다.

## 기획 검증

```bash
python3 docs/tools/validate_planning.py
```

이 검사는 제출 형식·근거 수치·기능/시나리오 연결·현재 문서의 일치를 확인한다. 주최 측의 점수 계산기는 아니다. [랄프 검증 기록](docs/planning-ralph-review.md)에 수정 근거와 실행 결과를 남긴다.

피치 코랄 `#F5A390`, 연피치 `#FDEDE8`, 차콜 `#2E2A33`, 웜화이트 `#FAF8F7`, 세이지 `#9ED0B4`를 사용한다. 진행 이력은 [progress.md](progress.md)에 있다.
