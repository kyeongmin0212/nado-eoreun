import type { ImageMode } from "@/lib/types";

/**
 * 사진 만들기 모드 정의 (디자인 v2 PHOTO-01: 4종 + PHOTO-02 상황으로 만들기 + 편집기 재편집).
 * 입력 규칙:
 *  - people: 사진 선택 바텀시트에서 고른 인물 사진 (내 사진 / 친구 사진 / 기타)
 *  - background: 배경 사진 (배경 바꾸기에서 선택)
 *  - hair: 참고 헤어스타일 사진 (헤어스타일 변경 필수)
 *  - text: 배경 설명 / 추가 요청사항
 */
export type ModeDefinition = {
  id: Exclude<ImageMode, "new_background" | "merge_background" | "background_create" | "edit">;
  title: string;
  description: string;
  /** 사진 선택 바텀시트 안내 */
  uploadHint: string;
  /** 인물 사진 최소 장수 (0 = 선택) */
  minPeople: number;
  /** 내 사진 1장 + 친구/기타 사진 1장이 모두 필요한가 (친구 추가하기) */
  needsSelfAndOther: boolean;
  /** 장소 프리셋 칩 표시 */
  placePresets: boolean;
  /** 배경 설명 텍스트: required 면 프리셋이나 설명 중 하나는 있어야 한다 */
  textRole: "background" | "extra";
  textLabel: string;
  textPlaceholder: string;
  /** 배경 사진 입력(선택) 표시 */
  backgroundPhoto: boolean;
  /** 참고 헤어스타일 사진(필수) 표시 */
  hairPhoto: boolean;
  resultNote: string;
};

export const MODES: ModeDefinition[] = [
  {
    id: "background_swap",
    title: "배경 바꾸기",
    description: "내 사진의 배경 변경",
    uploadHint: "배경을 바꿀 사진을 추가해 주세요",
    minPeople: 1,
    needsSelfAndOther: false,
    placePresets: true,
    textRole: "background",
    textLabel: "추가 요청사항 (선택)",
    textPlaceholder: "창가 자리, 오후 햇살 느낌으로",
    backgroundPhoto: false,
    hairPhoto: false,
    resultNote: "사진 속 내 얼굴은 그대로 두고, 고른 장소에서 실제로 찍은 것처럼 자연스럽게 다시 담아요. 장소 프리셋을 고르거나, 설정 안 함이면 추가 요청사항만 반영해요.",
  },
  {
    id: "add_friend",
    title: "친구 추가하기",
    description: "사진에 친구 추가",
    uploadHint: "친구를 추가할 사진을 골라 주세요",
    minPeople: 2,
    needsSelfAndOther: true,
    placePresets: true,
    textRole: "extra",
    textLabel: "추가 요청사항 (선택)",
    textPlaceholder: "어깨동무하고 웃는 모습으로",
    backgroundPhoto: false,
    hairPhoto: false,
    resultNote: "내 사진의 나와 배경은 그대로 두고, 동의한 친구가 옆에 함께 찍힌 사진을 만들어요. 얼굴을 바꾸는 기능이 아니에요.",
  },
  {
    id: "hairstyle",
    title: "헤어스타일 변경",
    description: "참고 사진으로 변경",
    uploadHint: "헤어를 바꿀 사람의 사진을 골라 주세요",
    minPeople: 1,
    needsSelfAndOther: false,
    placePresets: true,
    textRole: "extra",
    textLabel: "추가 요청사항 (선택)",
    textPlaceholder: "머리색은 그대로, 길이만 참고",
    backgroundPhoto: false,
    hairPhoto: true,
    resultNote: "참고 사진의 헤어스타일만 따라 하고, 그 사진 속 사람의 얼굴은 결과에 넣지 않아요. 참고 사진은 저장하지 않아요.",
  },
  {
    id: "situation",
    title: "상황으로 만들기",
    description: "준비된 상황을 골라 바로 만들어요",
    uploadHint: "사진을 추가해 주세요",
    minPeople: 0,
    needsSelfAndOther: false,
    placePresets: false,
    textRole: "extra",
    textLabel: "추가 요청사항 (선택)",
    textPlaceholder: "노트북과 커피잔이 보이게",
    backgroundPhoto: false,
    hairPhoto: false,
    resultNote: "고른 상황의 촬영 시점과 장면 구성이 자동 적용돼요. 사진을 올리면 그 인물이 장면에 들어가요.",
  },
];

/** PHOTO-01 「직접 만들기」 탭의 3종 (가로 3칸) */
export const DIRECT_MODES = MODES.filter((m) => m.id !== "situation");

export function modeById(id: string | null | undefined): ModeDefinition | undefined {
  return MODES.find((m) => m.id === id);
}

export const MODE_LABEL: Record<ImageMode, string> = {
  add_friend: "친구 추가하기",
  new_background: "배경 만들기",
  merge_background: "배경 바꾸기",
  background_swap: "배경 바꾸기",
  background_create: "배경 만들기",
  hairstyle: "헤어스타일 변경",
  situation: "상황으로 만들기",
  edit: "편집",
};
