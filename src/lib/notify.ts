import type { DataBackend } from "@/lib/data/types";
import { casualSubject, ofName, subject } from "@/lib/copy";
import { pushToUsers } from "@/lib/push/notify";

/**
 * 알림 센터 행 + (설정에 따라) Web Push. 호출 전에 행위자의 권한을 확인한다.
 * 문구는 디자인 최종안 알림 목록(HOME-01 알림 창)을 따른다.
 */
export async function notifyFriendSos(data: DataBackend, requestId: string, senderId: string, senderName: string, recipientIds: string[]) {
  await data.addNotifications(recipientIds.map((id) => ({ userId: id, kind: "friend_sos", fromId: senderId, text: `${casualSubject(senderName)} SOS를 보냈어요. 눌러서 바로 확인해 줘!`, link: `/sos/${requestId}` })));
}

export async function notifySosReply(data: DataBackend, requestId: string, senderId: string, replierId: string, replierName: string) {
  const text = `${subject(replierName)} 내 SOS를 확인했어요. 지금 통화 가능해요`;
  await data.addNotifications([{ userId: senderId, kind: "sos_reply", fromId: replierId, text, link: `/sos/${requestId}` }]);
  const prefs = await data.getNotifyPrefs([senderId]);
  if (prefs.get(senderId)?.notifyResponse !== false) {
    await pushToUsers(data, [senderId], { title: "나도으른 · SOS 응답", body: text, url: `/sos/${requestId}`, tag: `sos-reply-${requestId}` }).catch(() => undefined);
  }
}

export async function notifyConsent(data: DataBackend, ownerId: string, ownerName: string, granteeId: string) {
  await data.addNotifications([{ userId: granteeId, kind: "photo_consent", fromId: ownerId, text: `${subject(ownerName)} 내 사진 사용을 허용했어요`, link: null }]);
}

export async function notifyInviteAccepted(data: DataBackend, inviterId: string, accepterId: string, accepterName: string) {
  await data.addNotifications([{ userId: inviterId, kind: "invite_accepted", fromId: accepterId, text: `${subject(accepterName)} 초대를 수락했어요. 사진 사용 동의를 기다리는 중이에요`, link: "/friends" }]);
}

export async function notifyCompanions(data: DataBackend, userId: string, userName: string, companionIds: string[]) {
  const text = `${ofName(userName)} 오늘의 상황 동행인으로 지정됐어요`;
  await data.addNotifications(companionIds.map((id) => ({ userId: id, kind: "companion", fromId: userId, text, link: null })));
  // 동행인 지정은 SOS 를 받을 준비와 같아서 SOS 수신 알림을 켠 친구에게는 휴대폰 알림도 보낸다.
  const prefs = await data.getNotifyPrefs(companionIds);
  const targets = companionIds.filter((id) => prefs.get(id)?.notifySos !== false);
  if (targets.length > 0) await pushToUsers(data, targets, { title: "나도으른", body: text, url: "/", tag: `companion-${userId}` }).catch(() => undefined);
}
