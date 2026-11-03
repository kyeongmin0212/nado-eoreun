import type { ImageMode, PersonTag } from "@/lib/types";
import { EXPRESSION_OPTIONS, POSE_OPTIONS, editOption, placePreset, situationPreset } from "@/lib/image/presets";
import { ADD_FRIEND, BACKGROUND_SWAP, HAIRSTYLE } from "@/lib/image/prompt-templates";

export type PersonRef = { tag: PersonTag; name?: string | null };

export type PromptInput = {
  mode: ImageMode;
  /** 인물 사진. 이미지 순서는 arrangeImages() 결과를 따른다 */
  people: PersonRef[];
  /** 배경 사진(배경 바꾸기): 두 번째 이미지 */
  hasBackgroundPhoto?: boolean;
  /** 참고 헤어스타일 사진(헤어스타일 변경): 두 번째 이미지 */
  hasHairPhoto?: boolean;
  preset?: string | null;
  situation?: string | null;
  text?: string | null;
  pose?: string | null;
  expression?: string | null;
};

const PRESERVE =
  "Preserve every person's face, identity, skin, hair, body shape, clothing and relative scale exactly as in the reference photos. Do NOT replace, swap, beautify or alter any face. Do NOT add any people that are not in the references.";

function personLines(people: PersonRef[], offset = 0): string[] {
  return people.map((p, i) => {
    const who = p.tag === "self" ? "the user (Person A)" : p.tag === "friend" ? `the user's friend${p.name ? ` ${p.name}` : ""}` : "another person";
    return `Image ${offset + i + 1} is a reference photo of ${who}.`;
  });
}

const ORDINAL = ["첫", "두", "세", "네", "다섯", "여섯"];
/** 1 → "첫 번째" */
function nth(i: number): string {
  return ORDINAL[i - 1] ? `${ORDINAL[i - 1]} 번째` : `${i}번째`;
}
/** 2 → "두 사람" */
function peopleWord(n: number): string {
  return `${["한", "두", "세", "네", "다섯", "여섯"][n - 1] ?? n} 사람`;
}

/** 장소 프리셋 → "바닷가 (a seaside beach …)" */
function placeLabel(p: { label: string; prompt: string }): string {
  return `${p.label} (${p.prompt})`;
}

/**
 * 모델에 넘길 이미지 순서를 지시문과 맞춘다(팀 지시문은 '첫 번째·두 번째 사진'으로 말한다).
 *  - 친구 추가하기: 내 사진(편집 기준) → 친구 사진들
 *  - 헤어스타일 변경: 첫 번째 인물 사진 → 참고 헤어 사진 → 나머지 인물 사진
 *  - 배경 바꾸기 + 배경 사진: 첫 번째 인물 사진 → 배경 사진 → 나머지 인물 사진
 *  - 그 밖: 인물 사진 순서 그대로
 */
export function arrangeImages<T>(mode: ImageMode, persons: PersonRef[], images: T[], background: T | null, hair: T | null): { people: PersonRef[]; images: T[] } {
  if (mode === "add_friend") {
    const self = persons.findIndex((p) => p.tag === "self");
    const order = self > 0 ? [self, ...persons.map((_, i) => i).filter((i) => i !== self)] : persons.map((_, i) => i);
    return { people: order.map((i) => persons[i]), images: order.map((i) => images[i]) };
  }
  const second = mode === "hairstyle" ? hair : mode === "background_swap" ? background : null;
  if (second && images.length > 0) return { people: persons, images: [images[0], second, ...images.slice(1)] };
  return { people: persons, images: [...images, ...(background ? [background] : []), ...(hair ? [hair] : [])] };
}

/** 배경 바꾸기 (팀 지시문). 배경 사진이 없으면 '두 번째 사진' 대신 장소 프리셋·설명을 공간의 기준으로 쓴다. */
function backgroundSwapPrompt(n: number, place: string | null, hasBackgroundPhoto: boolean, extra: string): string {
  const T = BACKGROUND_SWAP;
  const others = n > 1 ? (hasBackgroundPhoto ? `세 번째 사진부터는 나와 함께 배치할 다른 인물의 사진이야.` : `두 번째 사진부터 ${nth(n)} 사진까지는 나와 함께 배치할 다른 인물의 사진이야.`) + " 이 사람들도 같은 기준으로 얼굴 특징을 유지해 한 장면에 함께 배치해줘." : "";
  const together = "첫 번째 사진에 나 말고 다른 사람도 함께 있으면 그 사람도 같은 기준으로 얼굴 특징을 유지해 함께 배치하고, 사진에 없는 사람은 새로 만들지 마.";
  const lines = hasBackgroundPhoto
    ? [T.intro, T.identity, T.space, T.light, T.pose, T.camera]
    : [
        "첫 번째 사진 속 나를 아래 장소에 자연스럽게 배치해, 실제로 그 장소에서 촬영한 듯한 사실적인 사진 한 장을 만들어줘. 친구가 현장에서 찍어준 자연스러운 일상 사진의 분위기로 표현해줘.",
        `장소: ${place}`,
        T.identity,
        "장소 설명은 공간과 촬영 조건의 기준이야. 그 장소에 실제로 있을 법한 주요 구조, 사물 배치, 시점과 분위기로 배경을 만들어줘. 배경의 수평선, 소실점, 주변 사물의 크기를 기준으로 인물의 위치와 크기를 정하고, 그 공간에서 사람이 실제로 서 있을 수 있는 곳에 나를 배치해줘. 머리·목·어깨·몸의 연결과 비율은 해부학적으로 자연스럽게 표현해줘.",
        "그 장소에 어울리는 광원의 방향, 빛의 색, 강도와 부드러움을 정하고 얼굴·머리카락·옷에 일관되게 적용해줘. 코 아래와 턱 아래의 음영, 주변 환경에서 반사되는 빛도 같은 조명 조건에 맞춰줘. 발이 보이는 구도에서는 발바닥이 지면에 정확히 닿고, 접촉 그림자와 몸이 드리우는 그림자가 배경의 다른 그림자와 일치하도록 해줘. 반사면이 보이면 인물의 반사도 위치와 각도에 맞게 반영해줘.",
        T.pose,
        T.camera.replace("배경의 기존 심도", "배경의 심도"),
      ];
  return [...lines, together, others, extra ? `추가 요청: ${extra}` : "", T.priority].filter(Boolean).join("\n\n");
}

/** 친구 추가하기 (팀 지시문). 친구 사진은 늘 있으므로 '없으면 가상 친구' 문장은 쓰지 않는다(가상 친구는 제품 범위 밖). */
function addFriendPrompt(n: number, place: string | null, extra: string): string {
  const T = ADD_FRIEND;
  const friends = Math.max(1, n - 1);
  const all = peopleWord(friends + 1);
  const intro = friends === 1 ? T.intro : T.intro.replace("친구 한 명을", `친구 ${friends}명을`);
  const base = place
    ? "첫 번째 사진을 편집의 기준으로 사용해줘. 사진 속 내 얼굴, 표정, 시선, 헤어스타일, 옷, 자세와 위치를 그대로 보존해줘. 구도는 유지하되 배경은 아래 장소로 바꾸고, 친구와 그에 필요한 그림자·가림·반사를 자연스럽게 추가해줘."
    : T.base;
  const friendRef =
    (friends === 1 ? "두 번째 사진 속 인물을 친구로 사용해줘." : `두 번째 사진부터 ${nth(n)} 사진까지 각 사진 속 인물을 한 명씩 친구로 사용해줘.`) +
    " 친구의 얼굴형, 눈·코·입의 형태와 비율, 헤어라인과 고유한 특징을 충실하게 유지해줘. 친구 사진의 배경과 조명은 가져오지 말고, 인물의 외모를 참조해 첫 번째 사진의 촬영 조건에 맞춰줘.";
  const light = place
    ? "바뀐 장소의 빛 방향, 색온도, 밝기와 그림자의 부드러움을 나와 친구에게 똑같이 적용해줘. 얼굴과 목의 음영, 옷의 주름, 발밑 접촉 그림자와 주변에 드리우는 그림자가 새 장면과 일치하도록 해줘. 반사면이 보이는 경우 친구의 위치에 맞는 반사도 반영해줘."
    : T.light;
  return [
    intro,
    base,
    place ? `장소: ${place}` : "",
    friendRef,
    T.placement.replaceAll("두 사람", all),
    T.scale,
    light,
    T.camera.replaceAll("두 사람", all),
    friends > 1 ? "친구가 여러 명이면 위 조건을 친구마다 똑같이 적용해줘." : "",
    extra ? `추가 요청: ${extra}` : "",
    T.priority.replaceAll("두 사람", all),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** 헤어스타일 변경 (팀 지시문). 장소 프리셋을 고르면 배경만 그 장소로 바꾼다. */
function hairstylePrompt(n: number, place: string | null, extra: string): string {
  const T = HAIRSTYLE;
  const base = place
    ? "첫 번째 사진을 편집의 기준으로 사용해줘. 당시 내 얼굴형, 이목구비, 나이 인상, 피부 질감, 표정과 시선을 그대로 보존해줘. 머리의 각도, 몸의 자세, 의상과 구도는 유지하고, 배경만 아래 장소로 자연스럽게 바꿔줘."
    : T.base;
  const light = place
    ? "새 헤어스타일의 밝기, 색감, 윤기와 그림자는 바뀐 장소의 조명에 맞춰 인물 전체와 함께 조정해줘. 선명도, 입자감과 노이즈도 원본에 맞춰서, 머리카락까지 같은 카메라로 함께 촬영한 것처럼 통일해줘."
    : T.light;
  return [
    T.intro,
    base,
    place ? `장소: ${place}` : "",
    T.reference,
    T.edges,
    light,
    n > 1 ? "세 번째 사진부터는 참고용으로 함께 고른 인물 사진이야. 결과에는 첫 번째 사진의 인물만 남겨줘." : "",
    extra ? `추가 요청: ${extra}` : "",
    T.priority,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** 모드별 모델 지시문. 이미지 순서는 arrangeImages() 와 같다. 배경 바꾸기·친구 추가하기·헤어스타일 변경은 팀 지시문(prompt-templates.ts)을 쓴다. */
export function buildPrompt(input: PromptInput): string {
  const people = input.people;
  const n = people.length;
  const extra = (input.text ?? "").trim();
  const preset = placePreset(input.preset);

  switch (input.mode) {
    case "add_friend":
      return addFriendPrompt(n, preset ? placeLabel(preset) : null, extra);
    case "background_swap":
      return backgroundSwapPrompt(n, preset ? placeLabel(preset) : `"${extra}"`, Boolean(input.hasBackgroundPhoto), preset || input.hasBackgroundPhoto ? extra : "");
    case "background_create": {
      const scene = preset ? preset.prompt : extra;
      return [
        `You are given ${n} reference photos.`,
        ...personLines(people),
        `Create one realistic candid phone photo of ${n === 1 ? "this person" : "these people together"} in a new place: ${scene}.`,
        "You may choose a natural new composition and pose that fits the place, but the people must look like the same real people from the references.",
        `The result must contain exactly ${n === 1 ? "this one person" : `these ${n} people`}.`,
        PRESERVE,
        extra && preset ? `Additional request: ${extra}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "hairstyle":
      return hairstylePrompt(n, preset ? placeLabel(preset) : null, extra);
    case "situation": {
      const s = situationPreset(input.situation);
      const scene = s?.prompt ?? extra;
      if (n === 0) {
        return [
          `Create one realistic candid phone photo of this scene: ${scene}.`,
          "Show the scene from the point of view of someone who is there (first-person phone snapshot), with no identifiable faces required.",
          "Natural lighting, slightly imperfect framing, no text or watermarks.",
          extra && s ? `Additional request: ${extra}.` : "",
        ]
          .filter(Boolean)
          .join(" ");
      }
      return [
        `You are given ${n} reference photos.`,
        ...personLines(people),
        `Create one realistic candid phone photo of ${n === 1 ? "this person" : "these people"} in this situation: ${scene}.`,
        "Compose the scene naturally for a phone snapshot (slightly imperfect framing, natural light).",
        `The result must contain exactly ${n === 1 ? "this one person" : `these ${n} people`}.`,
        PRESERVE,
        extra && s ? `Additional request: ${extra}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "edit": {
      const pose = editOption(POSE_OPTIONS, input.pose);
      const expression = editOption(EXPRESSION_OPTIONS, input.expression);
      return [
        "You are given one photo (Image 1). Edit it minimally.",
        pose ? `Change the pose of the people to: ${pose.prompt}.` : "",
        expression ? `Change the facial expression of the people to: ${expression.prompt}.` : "",
        "Keep everything else exactly as in Image 1: the same people and identities, clothing, hair, the background, framing, lighting and color tone.",
        "The result must contain exactly the same people as Image 1.",
        PRESERVE,
        extra ? `Additional request: ${extra}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    // v1 레거시 모드: 새 생성에는 쓰지 않는다.
    case "new_background":
      return buildPrompt({ ...input, mode: "background_create" });
    case "merge_background":
      return buildPrompt({ ...input, mode: "background_swap", hasBackgroundPhoto: true });
  }
}
