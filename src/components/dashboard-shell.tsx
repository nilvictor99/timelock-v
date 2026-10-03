"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon,
  CalendarDays,
  Download,
  Flame,
  Gift,
  Home,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  X,
  BarChart3,
  Trophy,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  mobileMoreNavigation,
  mobilePrimaryNavigation,
  navigationPath,
} from "@/lib/navigation";

export type DashboardTab =
  | "home"
  | "activities"
  | "suggestions"
  | "rewards"
  | "calendar"
  | "streak"
  | "export"
  | "settings";

export type DashboardNavId = DashboardTab | "profile" | "stats" | "settings";

type NavLabelKey =
  | "navHome"
  | "navStats"
  | "navActivities"
  | "navSuggestions"
  | "navRewards"
  | "navCalendar"
  | "navStreak"
  | "navProfile"
  | "navSettings"
  | "navExport";

export const dashboardNav: {
  id: DashboardNavId;
  label: string;
  labelKey: NavLabelKey;
  icon: typeof Home;
}[] = [
  { id: "home", label: "Resumen", labelKey: "navHome", icon: Home },
  { id: "stats", label: "Estadísticas", labelKey: "navStats", icon: BarChart3 },
  { id: "activities", label: "Actividades", labelKey: "navActivities", icon: ActivityIcon },
  { id: "suggestions", label: "Sugerencias", labelKey: "navSuggestions", icon: Sparkles },
  { id: "rewards", label: "Recompensas", labelKey: "navRewards", icon: Gift },
  { id: "calendar", label: "Calendario", labelKey: "navCalendar", icon: CalendarDays },
  { id: "streak", label: "Cadena diaria", labelKey: "navStreak", icon: Flame },
  { id: "profile", label: "Perfil", labelKey: "navProfile", icon: UserRound },
  { id: "settings", label: "Ajustes", labelKey: "navSettings", icon: Settings },
  { id: "export", label: "Exportar", labelKey: "navExport", icon: Download },
];

export function isDashboardTab(value: string | null): value is DashboardTab {
  return value !== null && value !== "profile" && value !== "settings" && value !== "stats" &&
    ["home", "activities", "suggestions", "rewards", "calendar", "streak", "export"].includes(value);
}

type DashboardSidebarProps = {
  active: DashboardNavId;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  onTabChange?: (tab: DashboardTab) => void;
};

function navLabel(id: DashboardNavId, labelKey: NavLabelKey, t: (key: any) => string) {
  return t(labelKey) || dashboardNav.find((item) => item.id === id)?.label || id;
}

export function DashboardSidebar({
  active,
  mobileNav,
  setMobileNav,
  expanded,
  setExpanded,
  onTabChange,
}: DashboardSidebarProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const darkMode = mounted && theme === "dark";

  const renderItem = ({ id, labelKey, icon: Icon }: (typeof dashboardNav)[number]) => {
    const label = navLabel(id, labelKey, t);
    const className = cn(
      "flex w-full items-center rounded-md py-2 text-sm transition-colors",
      expanded ? "gap-3 px-3" : "justify-center px-2",
      active === id
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
    const closeMobileNav = () => setMobileNav(false);
    const icon = <Icon size={17} aria-hidden="true" />;

    if (id === "profile" || id === "settings" || id === "stats") {
      return (
        <Link
          key={id}
          href={navigationPath(id) as any}
          className={className}
          onClick={closeMobileNav}
          title={!expanded ? label : undefined}
          aria-label={label}
        >
          {icon}
          {expanded && <span>{label}</span>}
        </Link>
      );
    }
    if (!onTabChange) {
      return (
        <Link
          key={id}
          href={navigationPath(id) as any}
          className={className}
          onClick={closeMobileNav}
          title={!expanded ? label : undefined}
          aria-label={label}
        >
          {icon}
          {expanded && <span>{label}</span>}
        </Link>
      );
    }
    return (
      <button
        key={id}
        onClick={() => { onTabChange(id); closeMobileNav(); }}
        className={className}
        title={!expanded ? label : undefined}
        aria-label={label}
      >
        {icon}
        {expanded && <span>{label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-card p-3 transition-all duration-300 lg:flex lg:flex-col",
        expanded ? "w-64" : "w-16",
        mobileNav ? "translate-x-0" : "",
      )}
    >
      <div className={cn("mb-8 flex items-center", expanded ? "justify-between px-2" : "justify-center")}>
        {expanded && (
          <div>
            <div className="text-xl font-bold tracking-tight">TimeLock<span className="text-info">-v</span></div>
            <p className="text-xs text-muted-foreground">Controla tu tiempo</p>
          </div>
        )}
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileNav(false)} aria-label={t("sidebarClose")}>
          <X size={16} />
        </Button>
      </div>
      <nav className="space-y-1">
        {dashboardNav.map(renderItem)}
      </nav>
      <div className={cn("mt-auto border-t border-border pt-3", expanded ? "space-y-1" : "space-y-2")}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn("flex w-full items-center rounded-md py-2 text-sm text-muted-foreground hover:bg-muted", expanded ? "gap-3 px-3" : "justify-center px-2")}
          title={expanded ? t("sidebarCollapse") : t("sidebarExpand")}
          aria-label={expanded ? t("sidebarCollapse") : t("sidebarExpand")}
        >
          {expanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          {expanded && <span>{t("sidebarCollapse")}</span>}
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn("flex w-full items-center rounded-md py-2 text-sm text-muted-foreground hover:bg-muted", expanded ? "gap-3 px-3" : "justify-center px-2")}
          title={darkMode ? "Modo claro" : "Modo oscuro"}
          aria-label={darkMode ? "Modo claro" : "Modo oscuro"}
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          {expanded && <span>{darkMode ? "Modo claro" : "Modo oscuro"}</span>}
        </button>
      </div>
    </aside>
  );
}

type BottomNavProps = {
  active: DashboardNavId;
  onTabChange?: (tab: DashboardTab) => void;
};

function BottomNav({ active, onTabChange }: BottomNavProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const itemById = (id: DashboardNavId) => dashboardNav.find((item) => item.id === id)!;
  const close = () => setOpen(false);
  const renderAction = (id: DashboardNavId, compact = false) => {
    const item = itemById(id);
    const label = navLabel(item.id, item.labelKey, t);
    const Icon = item.icon;
    const className = cn(
      "flex items-center rounded-lg transition-colors",
      compact ? "w-full gap-3 px-4 py-3 text-left" : "min-w-0 flex-1 flex-col justify-center gap-1 px-1 py-2 text-[10px]",
      active === id ? "font-semibold text-foreground" : "text-muted-foreground",
    );
    if (id === "profile" || id === "stats") {
      return <Link href={navigationPath(id) as any} onClick={close} className={className} aria-label={label}><Icon size={compact ? 18 : 19} /><span>{label}</span></Link>;
    }
    if (id === "settings") {
      return <Link href={navigationPath(id) as any} onClick={close} className={className} aria-label={label}><Icon size={18} /><span>{label}</span></Link>;
    }
    if (onTabChange) {
      return <button onClick={() => { onTabChange(id); close(); }} className={className} aria-label={label}><Icon size={compact ? 18 : 19} /><span>{label}</span></button>;
    }
    return <Link href={navigationPath(id) as any} onClick={close} className={className} aria-label={label}><Icon size={compact ? 18 : 19} /><span>{label}</span></Link>;
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={close}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{t("statsMore")}</h2><Button variant="ghost" size="sm" onClick={close} aria-label={t("statsClose")}><X size={17} /></Button></div>
            <div className="grid gap-1">{mobileMoreNavigation.map((id) => <div key={id}>{renderAction(id, true)}</div>)}</div>
            <div className="mt-3 border-t border-border pt-3">
              <button onClick={() => setTheme(mounted && theme === "dark" ? "light" : "dark")} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-muted-foreground"><Moon size={18} /><span>{t("statsTheme")}</span></button>
              <button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-danger"><X size={18} /><span>{t("statsLogout")}</span></button>
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t("statsMainNavigation")}>
        {mobilePrimaryNavigation.map((id) => <div key={id} className="flex min-w-0 flex-1">{renderAction(id)}</div>)}
        <button onClick={() => setOpen(true)} className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px]", open ? "font-semibold text-foreground" : "text-muted-foreground")} aria-label={t("statsMore")}><MoreHorizontal size={19} /><span>{t("statsMore")}</span></button>
      </nav>
    </>
  );
}

export type DashboardUser = {
  name?: string | null;
  points?: number | null;
  operationMode?: "SYNCHRONOUS" | "FREE" | null;
  avatarUrl?: string | null;
  language?: string | null;
};

const headerDateFormatters = {
  "es-ES": new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }),
  "en-US": new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long" }),
};

type DashboardTopBarProps = {
  title: ReactNode;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  user?: DashboardUser | null;
};

export function DashboardTopBar({ title, setMobileNav, user }: DashboardTopBarProps) {
  const { t } = useI18n();
  const [loadedUser, setLoadedUser] = useState<DashboardUser | null>(user ?? null);
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => setLoadedUser(user ?? null), [user]);
  useEffect(() => {
    if (user !== undefined) return;
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data?.user) setLoadedUser(data.user); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user]);

  const dateLocale = loadedUser?.language === "en" ? "en-US" : "es-ES";
  useEffect(() => {
    const updateDateLabel = () => setDateLabel(headerDateFormatters[dateLocale].format(new Date()));
    updateDateLabel();
    const id = window.setInterval(updateDateLabel, 60_000);
    return () => window.clearInterval(id);
  }, [dateLocale]);

  const initials = loadedUser?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TL";
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden lg:block" aria-hidden="true" />
        <div className="min-w-0"><p className="truncate text-xs capitalize text-muted-foreground">{t("today")}{dateLabel ? `, ${dateLabel}` : ""}</p><h1 className="truncate font-semibold">{title}</h1></div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm sm:flex"><Trophy size={15} className="text-warning" /> {loadedUser?.points ?? 0} pts</div>
        <span className="hidden rounded-full bg-muted px-3 py-1 text-xs md:inline">{loadedUser?.operationMode === "FREE" ? t("modeFree") : t("modeSync")}</span>
        <Link href="/dashboard/profile" className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-bold text-background" aria-label={t("profile")}>{loadedUser?.avatarUrl ? <img src={loadedUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</Link>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>{t("logout")}</Button>
      </div>
    </header>
  );
}

type DashboardShellProps = {
  active: DashboardNavId;
  title: ReactNode;
  children: ReactNode;
  user?: DashboardUser | null;
  onTabChange?: (tab: DashboardTab) => void;
};

export function DashboardShell({ active, title, children, user, onTabChange }: DashboardShellProps) {
  const [mobileNav, setMobileNav] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("timelock-sidebar-expanded");
    if (stored !== null) setExpanded(stored !== "false");
    setMounted(true);
  }, []);
  useEffect(() => {
    if (mounted) window.localStorage.setItem("timelock-sidebar-expanded", String(expanded));
  }, [expanded, mounted]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar active={active} mobileNav={mobileNav} setMobileNav={setMobileNav} expanded={expanded} setExpanded={setExpanded} onTabChange={onTabChange} />
      <main className={cn("transition-[padding] duration-300 lg:pl-64", !expanded && "lg:pl-16")}>
        <DashboardTopBar title={title} mobileNav={mobileNav} setMobileNav={setMobileNav} user={user} />
        <div className="mx-auto max-w-7xl p-4 pb-24 md:p-8 md:pb-28 lg:pb-8">{children}</div>
      </main>
      <BottomNav active={active} onTabChange={onTabChange} />
    </div>
  );
}
