import type { DashboardNavId, DashboardTab } from "@/components/dashboard-shell";

export type NavigationId = DashboardNavId;

export const navigationIds: NavigationId[] = [
  "home",
  "stats",
  "activities",
  "suggestions",
  "rewards",
  "calendar",
  "streak",
  "profile",
  "settings",
  "export",
];

export const mobilePrimaryNavigation: NavigationId[] = [
  "home",
  "activities",
  "calendar",
  "stats",
  "profile",
];

export const mobileMoreNavigation: NavigationId[] = [
  "suggestions",
  "rewards",
  "streak",
  "settings",
  "export",
];

export function navigationPath(id: NavigationId) {
  if (id === "profile") return "/dashboard/profile";
  if (id === "settings") return "/dashboard/settings";
  if (id === "stats") return "/dashboard/stats";
  return `/dashboard?tab=${id satisfies DashboardTab}`;
}
