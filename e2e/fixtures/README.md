# E2E 입력 자료

흐름에서 업로드하거나 붙여 넣는 입력 자료(강의 PDF·이미지·CSV·긴 글 등)를 이 폴더에 커밋한다.
주최 측 실행은 저장소에 있는 것만으로 흐름을 재현한다. 내 컴퓨터에만 있는 파일, 인터넷 주소에서 내려받는 파일,
실행할 때마다 생성하는 임의 자료에 기대면 주최 측 실행에서 같은 흐름이 돌지 않는다.

- 실제 흐름에 쓰는 크기·형식의 자료를 둔다. 빈 파일이나 의미 없는 자료로 결과를 확인하지 않는다.
- 저작권·개인정보 문제가 없는 자료만 둔다. 실존 인물의 개인정보는 넣지 않는다.
- 파일 하나는 10MB 이하로 둔다.

spec에서는 spec 파일 위치를 기준으로 경로를 만든다. `__dirname`을 쓰므로 `e2e/package.json`에 `"type": "module"`을 넣지 않는다.

```ts
import path from "node:path"

// 화면의 '자료 올리기' 버튼으로 고른다(파일 선택 창 대신 setInputFiles)
await page
  .getByLabel("자료 올리기")
  .setInputFiles(path.join(__dirname, "../fixtures/lecture-03.pdf"))
await page.getByRole("button", { name: "업로드" }).click()
await expect(page.getByRole("listitem").filter({ hasText: "lecture-03.pdf" })).toBeVisible()
```

## 나도으른 입력 자료

- `selfie.jpg`(내 셀카), `friend.jpg`(친구 사진), `together.jpg`(함께 찍은 사진), `beach.jpg`(배경 사진).
- 네 장 모두 같은 이미지 모델로 만든 **가상 인물·풍경** 이다(실존 인물 아님, 개인정보 없음). `pnpm smoke:inputs` 로 다시 만들 수 있다.
- 로컬에서 spec 을 돌릴 때(Node 23.6 이상) `NODE_OPTIONS=--no-experimental-strip-types npx playwright test` 로 실행한다.
