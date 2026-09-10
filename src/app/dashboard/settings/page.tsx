import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SettingsScreen from "@/components/settings-screen";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return <SettingsScreen />;
}
