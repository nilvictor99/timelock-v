import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const dashboardTabs = new Set(["home", "activities", "suggestions", "rewards", "calendar", "streak", "export"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string | string[] };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const requestedTab = typeof searchParams.tab === "string" ? searchParams.tab : null;
  return <Dashboard initialTab={requestedTab && dashboardTabs.has(requestedTab) ? requestedTab : "home"} />;
}
