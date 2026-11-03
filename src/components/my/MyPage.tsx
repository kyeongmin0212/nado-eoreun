"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FriendWithConsent } from "@/lib/data/types";
import type { Profile, ProfilePhoto } from "@/lib/types";
import { APP_VERSION } from "@/lib/copy";
import { formatHmKo } from "@/lib/time";
import { removeSubscriptionForLogout } from "@/lib/push/client";
import { PushSetup } from "@/components/PushSetup";
import { Confirm } from "@/components/ui";
import { PhotoManagerSheet, SLOTS } from "@/components/my/PhotoManagerSheet";

type Props = {
  profile: Profile;
  friends: FriendWithConsent[];
  photos: ProfilePhoto[];
  releaseId: string;
  vapidPublicKey?: string;
  pushConfigured: boolean;
  openPhotos?: boolean;
  openShare?: boolean;
};

type NotifyKey = "notify_curfew" | "notify_sos" | "notify_response";

/** MY-01 마이페이지 (디자인 최종안): 내 AI 프로필 · 공유 설정 · 개인정보 · 알림 · 일반 · 로그아웃/탈퇴 */
export function MyPage({ profile, friends: initialFriends, photos: initialPhotos, releaseId, vapidPublicKey, pushConfigured, openPhotos = false, openShare = false }: Props) {
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [friends, setFriends] = useState(initialFriends);
  const [photos, setPhotos] = useState(initialPhotos);
  const [photoSheet, setPhotoSheet] = useState(openPhotos);
  const [share, setShare] = useState(openShare);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [permOpen, setPermOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [sosOffOpen, setSosOffOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.display_name);

  const registered = SLOTS.filter((s) => photos.some((x) => x.slot === s.id)).length;
  const ready = photos.some((x) => x.slot === "front");
  const allowed = friends.filter((f) => f.iAllow).length;

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch("/api/me/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as { ok: boolean; profile?: Profile; message?: string } | null;
      if (!data?.ok || !data.profile) {
        setNotice(data?.message ?? "저장하지 못했어요.");
        return;
      }
      setP(data.profile);
      router.refresh();
    } catch {
      setNotice("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  function flip(key: NotifyKey, next: boolean) {
    if (key === "notify_sos" && !next) {
      setSosOffOpen(true);
      return;
    }
    void patch({ [key]: next }, key);
  }

  async function setConsent(f: FriendWithConsent, granted: boolean) {
    setBusy(`consent-${f.id}`);
    setNotice(null);
    try {
      const res = await fetch("/api/consents", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ granteeId: f.id, granted }) });
      const data = (await res.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (!data?.ok) {
        setNotice(data?.message ?? "저장하지 못했어요.");
        return;
      }
      setFriends((prev) => prev.map((x) => (x.id === f.id ? { ...x, iAllow: granted } : x)));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteData() {
    setBusy("data");
    try {
      const res = await fetch("/api/me/data", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { ok: boolean; generations?: number; situations?: number } | null;
      setNotice(data?.ok ? `생성 사진 ${data.generations ?? 0}장, 상황 기록 ${data.situations ?? 0}건을 삭제했어요.` : "삭제하지 못했어요.");
      router.refresh();
    } finally {
      setBusy(null);
      setDataOpen(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy("logout");
    // 이 기기의 푸시 구독을 현재 계정에서 해제한 뒤 서버 세션을 끝낸다.
    await removeSubscriptionForLogout();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  async function leave() {
    setBusy("leave");
    try {
      await removeSubscriptionForLogout();
      const res = await fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "탈퇴" }) });
      const data = (await res.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (!data?.ok) {
        setNotice(data?.message ?? "탈퇴 처리에 실패했어요.");
        return;
      }
      router.refresh();
      router.replace("/");
    } finally {
      setBusy(null);
      setLeaveOpen(false);
    }
  }

  const toggles: { key: NotifyKey; label: string; desc: string }[] = [
    { key: "notify_curfew", label: "통금 알림", desc: `통금 ${p.curfew_notify_minutes}분 전에 알려줘요` },
    { key: "notify_sos", label: "SOS 수신 알림", desc: "친구가 보낸 SOS를 바로 알려줘요" },
    { key: "notify_response", label: "친구 응답 알림", desc: "내 SOS에 친구가 응답하면 알려줘요" },
  ];

  return (
    <div className="flex flex-col gap-[18px] pb-4 pt-2">
      <section aria-label="내 AI 프로필" className="flex flex-col gap-[14px] rounded-[20px] bg-charcoal p-[18px] text-cream">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-coral text-[17px] font-black text-charcoal">
            {p.display_name.slice(0, 1)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-bold tracking-[1px] text-petal">MY AI PROFILE</span>
            <span className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[18px] font-bold">{p.display_name}</h2>
              <button type="button" onClick={() => { setNameDraft(p.display_name); setNameOpen(true); }} className="shrink-0 text-[12px] text-petal underline">
                이름 수정
              </button>
            </span>
            <span className="text-[12px] text-mist">내 AI 프로필 · 친구 {friends.length}명</span>
          </span>
          <span className={`badge ${ready ? "badge-ok" : "badge-wait"}`}>{ready ? "등록 완료" : "등록 필요"}</span>
        </div>
        <div className="flex flex-col gap-[10px] rounded-[16px] bg-dusk p-[14px]">
          <div className="flex justify-between text-[13px]">
            <span>사진 등록 현황</span>
            <span className="font-bold text-petal">{registered} / 4</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SLOTS.map((s) => {
              const has = photos.some((x) => x.slot === s.id);
              return (
                <span key={s.id} className="flex flex-col items-center gap-1.5">
                  <span aria-hidden className={`h-16 w-full rounded-[12px] bg-center bg-no-repeat ${has ? "bg-blush" : "border-2 border-dashed border-sub opacity-60"}`} style={{ backgroundImage: `url(/angles/${s.id}.svg)`, backgroundSize: 40 }} />
                  <span className="text-[12px]">
                    {s.short}
                    <span className="sr-only">{has ? " 등록됨" : " 미등록"}</span>
                  </span>
                </span>
              );
            })}
          </div>
          <span className="text-[12px] text-mist">{ready ? "AI 사진 생성에 사용할 준비가 완료됐어요" : "정면 사진을 등록하면 사진 만들기에서 바로 쓸 수 있어요"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPhotoSheet(true)} className="h-11 rounded-[14px] bg-dusk text-[14px] text-cream">
            사진 관리
          </button>
          <button type="button" aria-expanded={share} onClick={() => setShare((v) => !v)} className="h-11 rounded-[14px] bg-warm text-[14px] font-bold text-charcoal">
            공유 설정
          </button>
        </div>
      </section>

      {share ? (
        <section aria-label="공유 설정" className="flex flex-col gap-[10px] rounded-[18px] border-2 border-coral bg-white p-4">
          <h2 className="text-[15px] font-bold">내 사진을 쓸 수 있는 친구</h2>
          <span className="text-[12px] text-sub">기본은 꺼져 있어요. 끄면 새로 만드는 사진에 더 이상 쓰이지 않아요.</span>
          {friends.length === 0 ? <span className="text-[13px] text-sub">등록된 친구가 없어요.</span> : null}
          {friends.map((f) => (
            <label key={f.id} className="flex h-11 items-center justify-between text-[14px]">
              {f.display_name}
              <input type="checkbox" checked={f.iAllow} disabled={busy === `consent-${f.id}`} onChange={(e) => void setConsent(f, e.target.checked)} aria-label={`${f.display_name}에게 내 사진 사용 허용`} className="h-[22px] w-[22px] accent-coral" />
            </label>
          ))}
        </section>
      ) : null}

      <section aria-label="개인정보" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-sub">개인정보</h2>
        <ul className="list-card">
          <li>
            <button type="button" onClick={() => setShare((v) => !v)} className="list-row">
              내 사진 사용 동의 관리<span className="text-[13px] text-sub">{allowed}명 허용</span>
            </button>
          </li>
          <li className="list-row">
            AI 생성 표시<span className="text-[13px] text-sub">항상 켜짐</span>
          </li>
          <li>
            <button type="button" onClick={() => setPermOpen(true)} className="list-row">
              앱 권한 (사진·카메라·알림)<span className="text-[13px] text-sub">관리</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setDataOpen(true)} className="list-row">
              생성 사진·상황 기록 삭제<span className="text-[13px] text-sub">보관 기간 30일</span>
            </button>
          </li>
          <li>
            <a href="/api/me/export" download className="list-row">
              내 데이터 내려받기<span className="text-[13px] text-sub">요청</span>
            </a>
          </li>
        </ul>
      </section>

      <section aria-label="알림" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-sub">알림</h2>
        <ul className="list-card">
          {toggles.map((t) => (
            <li key={t.key}>
              <label className="flex min-h-14 items-center justify-between gap-3 px-4">
                <span className="flex flex-col gap-0.5 py-2">
                  <span className="text-[15px]">{t.label}</span>
                  <span className="text-[12px] text-sub">{t.desc}</span>
                </span>
                <input type="checkbox" role="switch" aria-label={t.label} checked={p[t.key]} disabled={busy === t.key} onChange={(e) => flip(t.key, e.target.checked)} className="h-[22px] w-[22px] shrink-0 accent-coral" />
              </label>
            </li>
          ))}
          <li className="px-4 py-3">
            <PushSetup compact vapidPublicKey={vapidPublicKey} pushConfigured={pushConfigured} />
          </li>
        </ul>
      </section>

      <section aria-label="일반" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-sub">일반</h2>
        <ul className="list-card">
          <li>
            <label className="list-row relative">
              기본 통금 시간
              <span className="text-[13px] text-sub">{busy === "curfew_time" ? "저장 중…" : formatHmKo(p.curfew_time)}</span>
              <input type="time" aria-label="기본 통금 시간" value={p.curfew_time} disabled={busy === "curfew_time"} onChange={(e) => e.target.value && patch({ curfew_time: e.target.value }, "curfew_time")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
          </li>
          <li>
            <button type="button" onClick={() => setShortcutOpen(true)} className="list-row">
              SOS 바로가기 (홈 화면)<span className="text-[13px] text-sub">만드는 법</span>
            </button>
          </li>
          <li className="list-row">
            언어<span className="text-[13px] text-sub">한국어</span>
          </li>
          <li>
            <Link href="/settings/legal#support" className="list-row">
              고객센터·문의
            </Link>
          </li>
          <li>
            <Link href="/settings/legal" className="list-row">
              이용약관·개인정보처리방침
            </Link>
          </li>
          <li className="list-row">
            앱 버전<span className="text-[13px] text-sub" title={releaseId}>{APP_VERSION}</span>
          </li>
        </ul>
      </section>

      {notice ? (
        <p role="status" className="rounded-[14px] bg-peach px-4 py-3 text-[13px] text-ink">
          {notice}
        </p>
      ) : null}

      <div className="flex justify-between px-1">
        <button type="button" onClick={logout} disabled={busy === "logout"} className="h-11 px-1 text-[14px] text-sub">
          {busy === "logout" ? "로그아웃 중…" : "로그아웃"}
        </button>
        <button type="button" onClick={() => setLeaveOpen(true)} className="h-11 px-1 text-[14px] text-danger">
          회원 탈퇴
        </button>
      </div>

      {photoSheet ? (
        <PhotoManagerSheet
          photos={photos}
          onChange={(next) => {
            setPhotos(next);
            router.refresh();
          }}
          onClose={() => setPhotoSheet(false)}
        />
      ) : null}

      {permOpen ? (
        <>
          <div className="sheet-backdrop z-[70]" onClick={() => setPermOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="앱 권한" className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-w-[360px] -translate-y-1/2 rounded-[24px] bg-white p-5 shadow-xl">
            <p className="text-[17px] font-black">앱 권한</p>
            <ul className="mt-3 flex flex-col gap-2 text-[13px] text-sub">
              <li>• 사진·카메라: 사진을 고를 때 iPhone이 묻는 권한만 써요. 고른 사진만 서버로 보내요.</li>
              <li>• 알림: 위 「이 기기 알림 켜기」로 켜요. 끄려면 iPhone 설정 → 알림 → 나도으른에서 바꿔 주세요.</li>
              <li>• 위치: 쓰지 않아요. 상황의 장소는 직접 입력한 값이에요.</li>
            </ul>
            <button type="button" onClick={() => setPermOpen(false)} className="btn btn-dark mt-4 w-full">
              확인
            </button>
          </div>
        </>
      ) : null}
      {shortcutOpen ? (
        <>
          <div className="sheet-backdrop z-[70]" onClick={() => setShortcutOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="SOS 바로가기" className="fixed inset-x-4 top-1/2 z-[71] mx-auto flex max-w-[360px] -translate-y-1/2 flex-col gap-3 rounded-[24px] bg-white p-5 shadow-xl">
            <p className="text-[17px] font-black">SOS 바로가기 만들기</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-sub">
              <li>iPhone Safari에서 아래 SOS 주소를 열어요.</li>
              <li>공유 버튼 → 「홈 화면에 추가」를 눌러요.</li>
              <li>생긴 「나도으른 SOS」 아이콘을 누르면 바로 SOS 화면이 열려요.</li>
            </ol>
            <p className="rounded-[12px] bg-warm px-3 py-2 text-[13px] break-all" data-testid="sos-shortcut-url">
              {typeof window === "undefined" ? "/sos" : `${window.location.origin}/sos`}
            </p>
            <p className="text-[12px] text-sub">홈 화면 위젯은 앱 출시 뒤에 제공할 예정이에요.</p>
            <button type="button" onClick={() => setShortcutOpen(false)} className="btn btn-dark w-full">
              확인
            </button>
          </div>
        </>
      ) : null}
      {nameOpen ? (
        <>
          <div className="sheet-backdrop z-[70]" onClick={() => setNameOpen(false)} aria-hidden />
          <form
            role="dialog"
            aria-modal="true"
            aria-label="이름 수정"
            onSubmit={(e) => {
              e.preventDefault();
              const v = nameDraft.trim();
              if (!v) return;
              setNameOpen(false);
              void patch({ display_name: v }, "display_name");
            }}
            className="fixed inset-x-4 top-1/2 z-[71] mx-auto flex max-w-[360px] -translate-y-1/2 flex-col gap-3 rounded-[24px] bg-white p-5 shadow-xl"
          >
            <p className="text-[17px] font-black">이름 수정</p>
            <label className="label">
              친구에게 보이는 이름이에요 (SOS·초대 문구에 쓰여요)
              <input className="field" value={nameDraft} maxLength={40} autoFocus onChange={(e) => setNameDraft(e.target.value)} aria-label="이름" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNameOpen(false)} className="btn btn-white">
                취소
              </button>
              <button type="submit" disabled={!nameDraft.trim()} className="btn btn-dark">
                저장
              </button>
            </div>
          </form>
        </>
      ) : null}
      <Confirm open={sosOffOpen} title="SOS 수신 알림을 끌까요?" body="친구가 SOS를 보내도 휴대폰 알림이 오지 않고, 앱 알림함에만 남아요." confirmLabel="끄기" danger busy={busy === "notify_sos"} onConfirm={() => { setSosOffOpen(false); void patch({ notify_sos: false }, "notify_sos"); }} onCancel={() => setSosOffOpen(false)} />
      <Confirm open={dataOpen} title="생성 사진과 상황 기록을 지금 삭제할까요?" body="보관함 사진과 예약한 상황이 모두 지워져요. 계정과 친구 관계는 남아요. 따로 지우지 않아도 30일이 지나면 자동으로 정리돼요." confirmLabel="모두 삭제" danger busy={busy === "data"} onConfirm={deleteData} onCancel={() => setDataOpen(false)} />
      <Confirm open={leaveOpen} title="정말 탈퇴할까요?" body="계정, 사진, 상황, SOS 기록, 친구 관계가 모두 삭제되고 복구할 수 없어요." confirmLabel="탈퇴" danger busy={busy === "leave"} onConfirm={leave} onCancel={() => setLeaveOpen(false)} />
    </div>
  );
}
