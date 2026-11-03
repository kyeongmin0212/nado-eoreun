import { integrationStatus, vapidPublicKey } from "@/lib/env";
import { getSessionUser } from "@/lib/auth";
import { getData } from "@/lib/data";
import { activeSituation } from "@/lib/situations";
import { effectiveCurfew, todayKst } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { Landing } from "@/components/Landing";
import { IntroGate } from "@/components/IntroGate";
import { PushSetup } from "@/components/PushSetup";
import { HomeHeader } from "@/components/home/HomeHeader";
import { QuoteTicker } from "@/components/home/QuoteTicker";
import { CurfewCard } from "@/components/home/CurfewCard";
import { CreateCards, SituationCard, SosBar } from "@/components/home/HomeSections";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  const data = await getData();
  const [profile, situations] = await Promise.all([data.getProfileFull(user.id), data.listSituations(user.id)]);
  const status = integrationStatus();
  const today = todayKst();
  const base = profile?.curfew_time ?? "23:00";
  const curfew = effectiveCurfew(base, profile?.curfew_override_time ?? null, profile?.curfew_override_date ?? null, today);

  return (
    <AppShell tone="hero" tabs header={<HomeHeader vapidPublicKey={vapidPublicKey()} pushConfigured={status.push} />}>
      <IntroGate />
      <div className="flex flex-col gap-4 pt-4">
        <QuoteTicker />
        <PushSetup compact vapidPublicKey={vapidPublicKey()} pushConfigured={status.push} hideWhenOn onlyStandalone />
        <CurfewCard curfewTime={curfew} notifyMinutes={profile?.curfew_notify_minutes ?? 30} isOverride={curfew !== base} />
        <SituationCard active={activeSituation(situations, today)} />
        <SosBar />
        <CreateCards />
      </div>
    </AppShell>
  );
}
