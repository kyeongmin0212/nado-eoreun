/** 사진 만들기 프리셋 (디자인 v2 PHOTO-01/02, EDITOR-01). 모델 지시문은 영어로 둔다. */

export type PlacePreset = { id: string; label: string; prompt: string };

export const PLACE_PRESETS: PlacePreset[] = [
  { id: "school", label: "학교", prompt: "a university campus building and walkway in daylight" },
  { id: "cafe", label: "카페", prompt: "the inside of a cozy modern cafe with wooden tables and warm light" },
  { id: "library", label: "도서관", prompt: "a quiet public library reading room with bookshelves" },
  { id: "hospital", label: "병원", prompt: "a clean hospital corridor or waiting area with soft lighting" },
  { id: "airport", label: "공항", prompt: "an airport departure hall with large windows and gates" },
  { id: "beach", label: "바닷가", prompt: "a seaside beach with waves and open sky" },
  { id: "seoul-station", label: "서울역", prompt: "the concourse of a large train station (Seoul Station) with departure boards" },
];

export function placePreset(id: string | null | undefined): PlacePreset | undefined {
  return PLACE_PRESETS.find((p) => p.id === id);
}

export type SituationCategory = "recovery" | "daily" | "travel";

export const SITUATION_CATEGORIES: { id: SituationCategory; label: string }[] = [
  { id: "recovery", label: "병원·회복" },
  { id: "daily", label: "일상" },
  { id: "travel", label: "여행·이동" },
];

export type SituationPreset = {
  id: string;
  category: SituationCategory;
  label: string;
  description: string;
  /** 구도·소품·조명 지시 */
  prompt: string;
  placeTag: string;
};

/** 기능명세서 v1.1 PHOTO-02 의 상황 10종 */
/** 기능명세서(최종) PHOTO-02 의 상황 10종 (디자인 순서·이름 그대로). 일러스트는 public/scenes/<id>.svg */
export const SITUATION_PRESETS: SituationPreset[] = [
  { id: "iv-drip", category: "recovery", label: "링거 맞는 중", description: "병실 침대, 링거 거치대", placeTag: "병원", prompt: "resting on a hospital bed with an IV drip stand nearby, soft daylight from a window, calm and tidy ward, taken casually with a phone" },
  { id: "home-recovery", category: "recovery", label: "집에서 회복 중", description: "이불, 약, 따뜻한 차", placeTag: "집", prompt: "lying under a blanket at home recovering from a cold, a mug of warm tea and medicine on a bedside table, soft indoor light, candid phone photo" },
  { id: "hospital-wait", category: "recovery", label: "병원 대기 중", description: "대기실 의자, 번호표", placeTag: "병원", prompt: "sitting in a hospital waiting area on a row of chairs with a numbered ticket, fluorescent lighting, candid phone photo" },
  { id: "cast", category: "recovery", label: "깁스한 날", description: "팔 깁스, 소파", placeTag: "집", prompt: "sitting on a sofa with an arm in a cast and sling, relaxed indoor scene, natural window light, candid phone photo" },
  { id: "study", category: "daily", label: "공부에 집중 중", description: "도서관 책상, 노트", placeTag: "도서관", prompt: "studying at a library desk with notes, textbooks and a highlighter, quiet warm reading-lamp light, candid phone photo" },
  { id: "solo-cafe", category: "daily", label: "혼자 카페에서", description: "창가 자리, 커피", placeTag: "카페", prompt: "sitting alone at a cafe window seat with a coffee cup and a book or phone, warm afternoon light, candid phone photo" },
  { id: "night-work", category: "daily", label: "야간 일하는 중", description: "사무실 야경, 노트북", placeTag: "사무실", prompt: "working late at a desk with a laptop, office lights on and a dark city window behind, tired but focused, candid phone photo" },
  { id: "post-workout", category: "daily", label: "운동 끝, 잠깐 휴식", description: "헬스장, 물병", placeTag: "헬스장", prompt: "taking a break after a workout at a gym, holding a water bottle, slightly flushed, gym equipment softly out of focus, candid phone photo" },
  { id: "airport", category: "travel", label: "공항에서", description: "출국장, 캐리어", placeTag: "공항", prompt: "standing in an airport departure hall next to a carry-on suitcase, departure boards and big windows behind, candid phone photo" },
  { id: "rainy-home", category: "travel", label: "비 오는 귀가", description: "우산, 젖은 거리, 저녁", placeTag: "거리", prompt: "walking home on a rainy evening street holding an umbrella, wet pavement reflecting shop lights, candid phone photo" },
];

export function situationPreset(id: string | null | undefined): SituationPreset | undefined {
  return SITUATION_PRESETS.find((s) => s.id === id);
}

export type EditOption = { id: string; label: string; prompt: string };

export const POSE_OPTIONS: EditOption[] = [
  { id: "selfie", label: "같이 셀카", prompt: "posed as a close selfie, one person holding the phone, both leaning in" },
  { id: "v-sign", label: "브이", prompt: "making a V sign with the fingers toward the camera" },
  { id: "side-by-side", label: "나란히 서기", prompt: "standing side by side facing the camera at a relaxed distance" },
  { id: "sitting", label: "앉아서", prompt: "sitting down comfortably, relaxed posture" },
];

export const EXPRESSION_OPTIONS: EditOption[] = [
  { id: "smile", label: "자연스러운 미소", prompt: "a gentle natural smile" },
  { id: "big-smile", label: "활짝 웃기", prompt: "a big happy open smile" },
  { id: "neutral", label: "무표정", prompt: "a calm neutral expression" },
  { id: "wink", label: "윙크", prompt: "a playful wink" },
];

export function editOption(list: EditOption[], id: string | null | undefined): EditOption | undefined {
  return list.find((o) => o.id === id);
}

export const WEATHER_OPTIONS: { id: "sunny" | "cloudy" | "rain" | "snow"; label: string }[] = [
  { id: "sunny", label: "맑음" },
  { id: "cloudy", label: "흐림" },
  { id: "rain", label: "비" },
  { id: "snow", label: "눈" },
];

export function weatherLabel(id: string | null | undefined): string {
  return WEATHER_OPTIONS.find((w) => w.id === id)?.label ?? "미지정";
}
