import type {
  AppNotification,
  NotificationKind,
  FriendInvite,
  ImageGeneration,
  ImageMode,
  GenerationParams,
  PhotoConsent,
  PhotoSlot,
  Profile,
  ProfilePhoto,
  PushStatus,
  SettingsPatch,
  Situation,
  SituationInput,
  SituationSnapshot,
  SosRecipient,
  SosRequest,
  SosResponse,
} from "@/lib/types";

export type SessionUser = { id: string; email: string | null };
export type ProfileLite = { id: string; display_name: string };
export type PushSub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type SignInResult = { ok: true; user: SessionUser } | { ok: false; message: string };
export type SignUpResult = { ok: true; user: SessionUser } | { ok: false; code: "taken" | "invalid" | "error"; message: string };
/** 이메일 인증번호 1건 (서버 전용 저장소, 이메일마다 한 행) */
export type EmailVerification = {
  email: string;
  codeHash: string | null;
  expiresAt: string;
  attempts: number;
  sentCount: number;
  windowStartedAt: string;
  lastSentAt: string;
  verifiedAt: string | null;
  ticketHash: string | null;
  ticketExpiresAt: string | null;
};

/** 저장할 상황 (입력 + 서버가 채우는 표시용 동행인 이름·요약) */
export type SituationWrite = SituationInput & { companion: string; summary: string };

export type NewNotification = { userId: string; kind: NotificationKind; fromId: string | null; text: string; link: string | null };
export type CreateSosResult =
  | { ok: true; requestId: string; created: boolean }
  | { ok: false; code: "no_friends" | "invalid" | "error"; message: string };
export type MarkReadResult =
  | { ok: true; firstReadAt: string | null }
  | { ok: false; code: "not_a_recipient" | "error"; message: string };
export type RespondResult =
  | { ok: true; respondedAt: string }
  | { ok: false; code: "not_a_recipient" | "cancelled" | "error"; message: string };
export type DeleteResult = { ok: true } | { ok: false; code: string; message: string };
export type ReceivedItem = {
  requestId: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  firstReadAt: string | null;
  response: SosResponse | null;
  cancelledAt: string | null;
  place: string | null;
};
export type SentItem = { requestId: string; createdAt: string; total: number; read: number; responded: number; cancelledAt: string | null };

/** 발신자/수신자 공통 상태 행 (SOS-03 발송 상태, SOS-02 의 발신자 상태 보기) */
export type SosStatusRow = {
  recipientId: string;
  name: string;
  firstReadAt: string | null;
  pushStatus: PushStatus;
  response: SosResponse | null;
  respondedAt: string | null;
};

export type PersistInput = {
  userId: string;
  bytes: Uint8Array;
  mediaType: string;
  mode: ImageMode;
  promptText?: string | null;
  modelId?: string | null;
  parentId?: string | null;
  version?: number;
  placeTag?: string | null;
  params?: GenerationParams | null;
};

/** 사진 선택 바텀시트용: 인물별 사용 가능한 등록 사진 */
export type UsablePerson = { person: ProfileLite; isSelf: boolean; consented: boolean; photos: ProfilePhoto[] };

export type FriendWithConsent = ProfileLite & {
  /** 상대가 내게 사진 사용을 허용했는가 */
  allowsMe: boolean;
  /** 내가 상대에게 허용했는가 */
  iAllow: boolean;
  photoCount: number;
};

export type AcceptInviteResult =
  | { ok: true; friendId: string; friendName: string; alreadyFriends: boolean }
  | { ok: false; code: "not_found" | "expired" | "self" | "used" | "error"; message: string };

export type CurfewCandidate = { userId: string; curfewTime: string; overrideTime: string | null; overrideDate: string | null; notifyMinutes: number; notifiedOn: string | null };

/**
 * 데이터 백엔드 인터페이스.
 * - supabase: Vercel 시연 배포 (Auth·Postgres·Storage·Realtime, RLS)
 * - local: 주최 측 docker 실행 (컨테이너 Postgres + 앱 세션 + 파일 저장). 소유권 검사는 어댑터 안에서 수행한다.
 */
export interface DataBackend {
  readonly kind: "supabase" | "local";
  getSessionUser(): Promise<SessionUser | null>;
  /** 라우트 핸들러 안에서 호출한다 (쿠키를 쓴다). login 은 아이디 또는 이메일. */
  signIn(login: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** 이메일 인증을 마친 이메일로 가입한 뒤 바로 로그인 (쿠키 설정). */
  signUpWithEmail(email: string, password: string): Promise<SignUpResult>;
  /** 이 이메일로 이미 가입한 계정이 있는가 (서버 전용). */
  isEmailRegistered(email: string): Promise<boolean>;
  // 이메일 인증번호 (서버 전용 저장소)
  getEmailVerification(email: string): Promise<EmailVerification | null>;
  putEmailVerification(row: EmailVerification): Promise<void>;
  deleteEmailVerification(email: string): Promise<void>;
  /** key 별 window 안 요청 수를 하나 늘린다. max 를 넘으면 늘리지 않고 false. */
  hitRateLimit(key: string, windowMs: number, max: number): Promise<boolean>;

  getProfile(userId: string): Promise<ProfileLite | null>;
  getProfiles(ids: string[]): Promise<ProfileLite[]>;
  getProfileFull(userId: string): Promise<Profile | null>;
  updateSettings(userId: string, patch: SettingsPatch): Promise<Profile | null>;
  /** 오늘만 적용하는 통금 시각 + 미리 알림 분 */
  setTodayCurfew(userId: string, time: string, notifyMinutes: number, dateKey: string): Promise<Profile | null>;
  getFriends(userId: string): Promise<ProfileLite[]>;
  getFriendsWithConsent(userId: string): Promise<FriendWithConsent[]>;

  // 오늘의 상황 예약 (HOME-02)
  listSituations(userId: string): Promise<Situation[]>;
  getSituation(userId: string, id: string): Promise<Situation | null>;
  createSituation(userId: string, input: SituationWrite): Promise<Situation>;
  updateSituation(userId: string, id: string, input: SituationWrite): Promise<Situation | null>;
  setSituationSummary(userId: string, id: string, summary: string): Promise<void>;
  deleteSituation(userId: string, id: string): Promise<DeleteResult>;
  /** 같은 날짜에 여러 상황이 있을 때 사용자가 고른 것 */
  chooseSituation(userId: string, id: string): Promise<Situation | null>;

  // AI 프로필 사진·사용 동의 (FRIEND-01/02, UPLOAD-01)
  listProfilePhotos(userId: string): Promise<ProfilePhoto[]>;
  /** 본인 + 사용 동의를 받은 친구의 등록 사진 */
  listUsablePhotos(userId: string): Promise<UsablePerson[]>;
  addProfilePhoto(userId: string, slot: PhotoSlot, bytes: Uint8Array, mediaType: string): Promise<ProfilePhoto>;
  deleteProfilePhoto(userId: string, id: string): Promise<DeleteResult>;
  /** 소유자 또는 동의받은 친구만 읽을 수 있다. */
  /** thumbWidth 가 있으면 저장소에 캐시한 WebP 썸네일(없으면 만들어 저장)을 돌려준다 */
  readProfilePhotoFile(viewerId: string, id: string, thumbWidth?: number | null): Promise<{ row: ProfilePhoto; bytes: Uint8Array; mediaType: string } | null>;
  listConsentsGiven(ownerId: string): Promise<PhotoConsent[]>;
  setConsent(ownerId: string, granteeId: string, granted: boolean): Promise<PhotoConsent | null>;
  createInvite(userId: string): Promise<FriendInvite>;
  getInvite(token: string): Promise<{ invite: FriendInvite; inviterName: string } | null>;
  acceptInvite(userId: string, token: string): Promise<AcceptInviteResult>;

  // 생성 사진 (EDITOR-01, ALBUM-01)
  listGenerations(userId: string): Promise<ImageGeneration[]>;
  getGeneration(userId: string, id: string): Promise<ImageGeneration | null>;
  persistGeneration(input: PersistInput): Promise<ImageGeneration>;
  readGenerationFile(userId: string, id: string, thumbWidth?: number | null): Promise<{ row: ImageGeneration; bytes: Uint8Array; mediaType: string } | null>;
  deleteGeneration(userId: string, id: string): Promise<DeleteResult>;
  /** 편집본(source)으로 원본 행(target)의 파일을 덮어쓰고 source 행을 지운다. */
  overwriteGeneration(userId: string, targetId: string, sourceId: string): Promise<DeleteResult>;

  // SOS (SOS-01/02/03)
  createSosRequest(userId: string, idempotencyKey: string, message: string, recipientIds: string[] | null, snapshot: SituationSnapshot | null): Promise<CreateSosResult>;
  /** 발신자 또는 기록된 수신자만 조회된다. */
  getSosRequest(userId: string, requestId: string): Promise<SosRequest | null>;
  /** 발신자: 전원, 수신자: 본인 행만. */
  getSosRecipients(userId: string, requestId: string): Promise<SosRecipient[]>;
  /** 발신자·수신자 모두 전원 상태를 본다 (SOS-02 「발신자 상태 화면 보기」). */
  getSosStatus(userId: string, requestId: string): Promise<SosStatusRow[] | null>;
  markSosRead(userId: string, requestId: string): Promise<MarkReadResult>;
  respondSos(userId: string, requestId: string, response: SosResponse): Promise<RespondResult>;
  cancelSos(userId: string, requestId: string): Promise<DeleteResult>;
  listReceived(userId: string): Promise<ReceivedItem[]>;
  listSent(userId: string): Promise<SentItem[]>;
  countUnread(userId: string): Promise<number>;

  // 푸시
  updatePushStatus(requestId: string, recipientId: string, status: PushStatus, error: string | null): Promise<void>;
  getSubscriptionsFor(userIds: string[]): Promise<PushSub[]>;
  deleteSubscriptions(ids: string[]): Promise<void>;
  upsertSubscription(userId: string, endpoint: string, p256dh: string, auth: string, userAgent: string | null): Promise<void>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
  // 알림 센터
  listNotifications(userId: string, limit?: number): Promise<AppNotification[]>;
  countUnreadNotifications(userId: string): Promise<number>;
  /** ids 가 null 이면 모두 읽음. link 를 주면 그 링크의 알림만 읽음. */
  markNotificationsRead(userId: string, ids: string[] | null, link?: string): Promise<void>;
  /** 서버 전용: 다른 사용자에게 알림 추가 (호출 전에 권한을 확인한다). */
  addNotifications(rows: NewNotification[]): Promise<void>;

  /** 수신자별 알림 설정 (서버 전용, 발송 전 확인). */
  getNotifyPrefs(userIds: string[]): Promise<Map<string, { notifySos: boolean; notifyResponse: boolean }>>;
  /** 통금 알림 대상 (알림 켠 사용자 전체). 서버 전용. */
  listCurfewCandidates(): Promise<CurfewCandidate[]>;
  markCurfewNotified(userId: string, dateKey: string): Promise<void>;

  // 설정 (SETTING-01)
  deleteUserData(userId: string): Promise<{ generations: number; situations: number }>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteAccount(userId: string): Promise<void>;
  /** 보관 기간(30일)이 지난 생성 사진·상황 기록 정리 (서버 전용). */
  purgeExpired(days: number): Promise<{ generations: number; situations: number }>;
}
