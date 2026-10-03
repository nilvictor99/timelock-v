import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileScreen from "@/components/profile-screen";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return <ProfileScreen />;
}
