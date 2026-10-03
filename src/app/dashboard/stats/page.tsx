import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StatsScreen from "@/components/stats-screen";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return <StatsScreen />;
}
