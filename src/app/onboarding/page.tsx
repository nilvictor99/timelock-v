import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Onboarding from "@/components/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/dashboard");
  return <Onboarding user={{ name: user.name, timezone: user.timezone, language: user.language, operationMode: user.operationMode }} />;
}
