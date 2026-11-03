import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...rest }: P, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => base(p, <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M10 20v-6h4v6" /></>);
export const IconSparkle = (p: P) => base(p, <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" /></>);
export const IconAlbum = (p: P) => base(p, <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></>);
export const IconUsers = (p: P) => base(p, <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.2c2.8.2 4.6 1.9 5 5.3" /></>);
export const IconMenu = (p: P) => base(p, <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>);
export const IconClose = (p: P) => base(p, <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);
export const IconBack = (p: P) => base(p, <path d="m15 5-7 7 7 7" />);
export const IconChevron = (p: P) => base(p, <path d="m9 5 7 7-7 7" />);
export const IconClock = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IconPin = (p: P) => base(p, <><path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11z" /><circle cx="12" cy="10" r="2.2" /></>);
export const IconCloud = (p: P) => base(p, <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z" />);
export const IconNote = (p: P) => base(p, <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 8h7" /><path d="M8.5 12h7" /><path d="M8.5 16h4" /></>);
export const IconPhone = (p: P) => base(p, <path d="M6.5 3.5h3l1.6 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.6v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />);
export const IconCopy = (p: P) => base(p, <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>);
export const IconCheck = (p: P) => base(p, <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconPlus = (p: P) => base(p, <><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconImage = (p: P) => base(p, <><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="m4 16 4.5-4.5 3.5 3.5 2.5-2.5L20 17" /><circle cx="15.5" cy="9.5" r="1.3" /></>);
export const IconCamera = (p: P) => base(p, <><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4z" /><circle cx="12" cy="13" r="3" /></>);
export const IconSwap = (p: P) => base(p, <><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></>);
export const IconScissors = (p: P) => base(p, <><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" /><path d="M8.5 8.3 20 18" /><path d="m8.5 15.7 11.5-9.7" /></>);
export const IconBell = (p: P) => base(p, <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconTrash = (p: P) => base(p, <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6.5 7 7.5 20h9l1-13" /></>);
export const IconDownload = (p: P) => base(p, <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19h14" /></>);
export const IconLink = (p: P) => base(p, <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconEye = (p: P) => base(p, <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.8" /></>);
export const IconCalendar = (p: P) => base(p, <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></>);
export const IconShield = (p: P) => base(p, <><path d="M12 3 5 6v5.5c0 4.3 3 7.6 7 9.5 4-1.9 7-5.2 7-9.5V6z" /><path d="m9.5 12 1.8 1.8L15 10" /></>);
export const IconSun = (p: P) => base(p, <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>);

/* ---- 디자인 최종안 아이콘 (원본 SVG 경로) ---- */
export const IconBellD = (p: P) => base(p, <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" /><path d="M10 19a2 2 0 0 0 4 0" /></>);
export const IconSendD = (p: P) => base(p, <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>);
export const IconHomeD = (p: P) => base(p, <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />);
export const IconStarD = (p: P) => base(p, <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />);
export const IconPhotoD = (p: P) => base(p, <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 15l5-4 4 3 3-2 6 6" /></>);
export const IconFriendsD = (p: P) => base(p, <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14c3 0 5 2.2 5 5" /></>);
export const IconLock = (p: P) => base(p, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const IconInfo = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v5h1" /></>);
export const IconPhoneFill = ({ size = 22, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
    <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
  </svg>
);
export const IconGallery = (p: P) => base(p, <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></>);
export const IconUpload = (p: P) => base(p, <><path d="M12 16V5M7 10l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>);
export const IconHair = (p: P) => base(p, <><path d="M6 11c0-4 2.7-7 6-7s6 3 6 7v6M6 11v6" /><circle cx="12" cy="12" r="3.5" /></>);
/** 디자인 「사진 생성하기」 별 (단일 별) */
export const IconSpark = (p: P) => base(p, <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />);
