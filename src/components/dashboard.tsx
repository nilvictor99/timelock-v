"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Download, Flame, Gift, Moon, MoreHorizontal, Play, Plus,
  Sparkles, Sun, Target, TimerReset,
  Trash2, Trophy, Umbrella, X, Pause
} from "lucide-react";
import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime, minutesBetween, toDateKey } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { dashboardNav, DashboardShell, isDashboardTab, type DashboardTab } from "@/components/dashboard-shell";

type Category = { id: string; name: string; color: string; pointsPerHour: number };
type Activity = {
  id: string; title: string; description?: string | null; startAt: string; endAt: string; status: string;
  points: number; isFree: boolean; category?: Category | null;
};
type Reward = { id: string; title: string; cost: number; description?: string | null; redeemedAt?: string | null };
type User = {
  name: string; email?: string | null; birthDate?: string | null; occupation?: string | null;
  bio?: string | null; interests?: string | null; goals?: string | null; workHours?: string | null;
  dailyAvailableMinutes?: number | null; points: number; currentStreak: number; bestStreak: number;
  voiceEnabled: boolean; notifyVolume: number; timezone: string; language: string;
  operationMode: "SYNCHRONOUS" | "FREE"; onboardingCompleted?: boolean;
  pauseActive?: boolean; pauseReason?: string | null; avatarUrl?: string | null;
};

const calendarMonthFormatter = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const calendarDayFormatter = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("es", { weekday: "short" });

function dateTimeFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function Dashboard({ initialTab = "home" }: { initialTab?: string }) {
  const { theme, setTheme } = useTheme();
  const { setLocale } = useI18n();
  const [tab, setTab] = useState<DashboardTab>(() => {
    return isDashboardTab(initialTab) ? initialTab : "home";
  });
  const [date, setDate] = useState(toDateKey());
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTimer, setActiveTimer] = useState<Activity | null>(null);
  const [now, setNow] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const [travelActive, setTravelActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setLoadError(data.error ?? "No se pudo cargar la aplicación.");
      setLoading(false);
      return;
    }
    setLoadError(""); setUser(data.user); setLocale(data.user.language === "en" ? "en" : "es"); setActivities(data.activities); setCategories(data.categories); setRewards(data.rewards); setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (toast) { const id = window.setTimeout(() => setToast(""), 3000); return () => window.clearTimeout(id); } }, [toast]);

  const todayActivities = useMemo(() => activities.filter((a) => toDateKey(new Date(a.startAt)) === date && !user?.pauseActive), [activities, date, user?.pauseActive]);
  const completed = todayActivities.filter((a) => a.status === "COMPLETED").length;
  const totalMinutes = todayActivities.reduce((sum, a) => sum + minutesBetween(a.startAt, a.endAt), 0);
  const completedMinutes = todayActivities.filter((a) => a.status === "COMPLETED").reduce((sum, a) => sum + minutesBetween(a.startAt, a.endAt), 0);
  const progress = todayActivities.length ? Math.round((completed / todayActivities.length) * 100) : 0;
  const current = activities.find((a) => a.status === "ACTIVE") ?? (user?.operationMode === "FREE"
    ? activities.find((a) => a.status === "PLANNED")
    : activities.find((a) => new Date(a.startAt) <= now && new Date(a.endAt) > now && a.status === "PLANNED"));
  const timerSeconds = activeTimer && !timerPaused
    ? user?.operationMode === "FREE"
      ? Math.max(0, Math.floor((now.getTime() - new Date(activeTimer.startAt).getTime()) / 1000))
      : Math.max(0, Math.floor((new Date(activeTimer.endAt).getTime() - now.getTime()) / 1000))
    : 0;

  const notify = (message: string) => setToast(message);
  const markDone = async (activity: Activity) => {
    await fetch("/api/bootstrap", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activity.id, status: "COMPLETED" }) });
    notify(`+${activity.points} puntos. Actividad completada.`);
    refresh();
  };
  const deleteActivity = async (id: string) => {
    await fetch(`/api/bootstrap?id=${id}`, { method: "DELETE" }); refresh(); notify("Actividad eliminada.");
  };
  const downloadExport = () => { window.location.href = "/api/export"; };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando TimeLock-v...</div>;
  if (loadError) return <div className="flex min-h-screen items-center justify-center bg-background p-6"><Card className="max-w-lg"><CardHeader><CardTitle>No se pudo conectar con PostgreSQL</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{loadError}</p><Button className="mt-5" onClick={refresh}>Reintentar</Button></CardContent></Card></div>;

  return (
    <>
      <DashboardShell
        active={tab}
        title={dashboardNav.find((item) => item.id === tab)?.label}
        user={user}
        onTabChange={setTab}
      >
        {tab === "home" && <HomeView {...{ user, todayActivities, completed, totalMinutes, completedMinutes, progress, current, now, markDone, setActiveTimer, setTab, setShowForm }} />}
        {tab === "activities" && <ActivitiesView {...{ date, setDate, todayActivities, categories, mode: user?.operationMode, markDone, deleteActivity, setShowForm }} />}
        {tab === "suggestions" && <SuggestionsView {...{ categories, mode: user?.operationMode, refresh, notify }} />}
        {tab === "rewards" && <RewardsView {...{ rewards, user, notify }} />}
        {tab === "calendar" && <CalendarView {...{ activities, date, setDate, setTab }} />}
        {tab === "streak" && <StreakView {...{ user }} />}
        {tab === "settings" && <SettingsView {...{ user, theme, setTheme, refresh, notify }} />}
        {tab === "export" && <ExportView downloadExport={downloadExport} />}
      </DashboardShell>
      {showForm && <ActivityForm categories={categories} defaultDate={date} mode={user?.operationMode} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); refresh(); notify("Actividad programada."); }} />}
      {user?.pauseActive && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-warning bg-orange-50 px-4 py-3 text-center text-sm text-orange-900 shadow-lg dark:bg-orange-950/90 dark:text-orange-100"><Pause className="mr-2 inline" size={16} /> Tu agenda está en pausa{user.pauseReason ? `: ${user.pauseReason}` : ""}. <a className="ml-2 underline" href="/dashboard/settings">Gestionar</a></div>}
      {activeTimer && <FloatingTimer activity={activeTimer} seconds={timerSeconds} paused={timerPaused} onPause={() => setTimerPaused((value) => !value)} onFinalize={() => { markDone(activeTimer); setActiveTimer(null); setTimerPaused(false); }} onSnooze={() => { setActiveTimer(null); setTimerPaused(false); notify("Temporizador pospuesto."); }} onCancel={() => { setActiveTimer(null); setTimerPaused(false); }} />}
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg">{toast}</div>}
    </>
  );
}

function HomeView({ user, todayActivities, completed, totalMinutes, completedMinutes, progress, current, now, markDone, setActiveTimer, setTab, setShowForm }: any) {
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm text-muted-foreground">{user?.operationMode === "FREE" ? "Registra tu tiempo a tu ritmo" : "Tu día en control"}</p><h2 className="text-3xl font-bold tracking-tight">Buenos días, {user?.name?.split(" ")[0] ?? "equipo"}.</h2></div><Button onClick={() => setShowForm(true)}><Plus size={17} /> Nueva actividad</Button></div>
    <div className="grid gap-4 md:grid-cols-4"><Metric title="Progreso de hoy" value={`${progress}%`} detail={`${completed}/${todayActivities.length} actividades`} icon={<Target className="text-success" />} /><Metric title="Tiempo enfocado" value={`${Math.floor(completedMinutes / 60)}h ${completedMinutes % 60}m`} detail={`de ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m planeadas`} icon={<Clock3 className="text-info" />} /><Metric title="Cadena actual" value={`${user?.currentStreak ?? 0} días`} detail={`Mejor: ${user?.bestStreak ?? 0}`} icon={<Flame className="text-warning" />} /><Metric title="Puntos totales" value={`${user?.points ?? 0}`} detail="Canjeables por recompensas" icon={<Trophy className="text-warning" />} /></div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Agenda de hoy</CardTitle><Button variant="ghost" size="sm" onClick={() => setTab("activities")}>Ver todo <ChevronRight size={15} /></Button></CardHeader><CardContent className="space-y-3">{todayActivities.length === 0 ? <Empty text="No hay actividades para este día." /> : todayActivities.slice(0, 5).map((a: Activity) => <ActivityRow key={a.id} activity={a} now={now} onDone={() => markDone(a)} onTimer={() => setActiveTimer(a)} />)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Enfoque actual</CardTitle></CardHeader><CardContent>{current ? <div className="space-y-5"><div className="rounded-lg bg-muted p-5"><div className="mb-2 flex items-center justify-between"><Badge variant="success">En curso</Badge><span className="text-sm text-muted-foreground">{formatTime(current.startAt)} – {formatTime(current.endAt)}</span></div><h3 className="text-xl font-semibold">{current.title}</h3><p className="mt-1 text-sm text-muted-foreground">{current.category?.name ?? "Sin categoría"}</p></div><Button className="w-full" onClick={() => setActiveTimer(current)}><Play size={16} /> Abrir temporizador</Button></div> : <Empty text="No tienes una actividad activa ahora." />}</CardContent></Card></div></div>;
}

function Metric({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) { return <Card><CardContent className="p-4"><div className="mb-3 flex items-center justify-between text-muted-foreground"><span className="text-xs uppercase tracking-wide">{title}</span>{icon}</div><div className="text-2xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>; }
function ActivityRow({ activity, now, onDone, onTimer }: { activity: Activity; now: Date; onDone: () => void; onTimer: () => void }) { const active = new Date(activity.startAt) <= now && new Date(activity.endAt) > now; return <div className="flex items-center gap-3 rounded-lg border border-border p-3"><div className="h-10 w-1 rounded-full" style={{ backgroundColor: activity.category?.color ?? "#888" }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className={cn("truncate font-medium", activity.status === "COMPLETED" && "text-muted-foreground line-through")}>{activity.title}</p>{active && <Badge variant="success">Ahora</Badge>}</div><p className="text-xs text-muted-foreground">{formatTime(activity.startAt)} – {formatTime(activity.endAt)} · {activity.category?.name ?? "Libre"}</p></div>{activity.status === "COMPLETED" ? <Check className="text-success" size={18} /> : <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={onTimer}><Play size={15} /></Button><Button variant="outline" size="sm" onClick={onDone}>Completar</Button></div>}</div>; }

function ActivitiesView({ date, setDate, todayActivities, categories, mode, markDone, deleteActivity, setShowForm }: any) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Actividades</h2>
          <p className="text-sm text-muted-foreground">{mode === "FREE" ? "Registra cada actividad sin presión de horarios." : "Cada bloque protege una parte de tu día."}</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button onClick={() => setShowForm(true)}><Plus size={16} /> Añadir</Button>
        </div>
      </div>
      <div className="grid gap-3">
        {todayActivities.length ? todayActivities.map((a: Activity) => (
          <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="h-12 w-1 rounded-full" style={{ backgroundColor: a.category?.color ?? "#888" }} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn("font-semibold", a.status === "COMPLETED" && "line-through opacity-60")}>{a.title}</h3>
                <Badge>{a.points} pts</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{formatTime(a.startAt)} – {formatTime(a.endAt)} · {a.category?.name ?? "Actividad libre"}</p>
              {a.description && <p className="mt-1 text-sm">{a.description}</p>}
            </div>
            <div className="flex gap-2">
              {a.status !== "COMPLETED" && <Button size="sm" onClick={() => markDone(a)}><Check size={15} /> Listo</Button>}
              <Button variant="ghost" size="sm" onClick={() => deleteActivity(a.id)}><Trash2 size={15} className="text-danger" /></Button>
            </div>
          </div>
        )) : <Empty text={`No hay actividades el ${date}. Crea la primera para proteger tu tiempo.`} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c: Category) => (
          <Badge key={c.id}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}: {c.pointsPerHour} pts/h</Badge>
        ))}
      </div>
    </div>
  );
}

function TimerView({ activeTimer, setActiveTimer, current, timerSeconds, mode, markDone }: any) { const a = activeTimer ?? current; const seconds = timerSeconds; return <div className="mx-auto max-w-xl space-y-6 text-center"><div><h2 className="text-2xl font-bold">{mode === "FREE" ? "Temporizador de actividad" : "Temporizador regresivo"}</h2><p className="text-sm text-muted-foreground">{mode === "FREE" ? "El tiempo se registra sin penalización por horario." : "Sincronizado con la hora real."}</p></div>{a ? <Card><CardContent className="p-8"><Badge variant="success">Sesión enfocada</Badge><h3 className="mt-5 text-2xl font-bold">{a.title}</h3><p className="mt-1 text-muted-foreground">{a.category?.name ?? "Actividad libre"}</p><div className="my-8 font-mono text-7xl font-bold tracking-tight">{String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</div><div className="flex justify-center gap-2"><Button variant="outline" onClick={() => setActiveTimer(null)}><X size={16} /> Cerrar</Button><Button onClick={() => { markDone(a); setActiveTimer(null); }}><Check size={16} /> Completar y ganar {a.points} pts</Button></div></CardContent></Card> : <Empty text="Selecciona una actividad desde tu agenda para iniciar el temporizador." />}</div>; }

function FloatingTimer({ activity, seconds, paused, onPause, onFinalize, onSnooze, onCancel }: { activity: Activity; seconds: number; paused: boolean; onPause: () => void; onFinalize: () => void; onSnooze: () => void; onCancel: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <Card className="w-full max-w-md shadow-2xl"><CardHeader className="flex-row items-start justify-between"><div><Badge variant="success">{paused ? "Pausado" : "En curso"}</Badge><CardTitle className="mt-3">{activity.title}</CardTitle><p className="text-sm text-muted-foreground">{activity.category?.name ?? "Actividad libre"}</p></div><Button variant="ghost" size="sm" onClick={onCancel}><X size={16} /></Button></CardHeader>
      <CardContent className="space-y-6 text-center"><div className="font-mono text-6xl font-bold tracking-tight">{String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</div><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={onPause}><Pause size={16} /> {paused ? "Reanudar" : "Pausar"}</Button><Button variant="outline" onClick={onSnooze}>Posponer</Button><Button onClick={onFinalize}><Check size={16} /> Finalizar</Button></div></CardContent>
    </Card>
  </div>;
}

type Suggestion = {
  id?: string;
  title: string;
  category: string;
  duration: number;
  reason: string;
  points: number;
  suggestedTime?: string | null;
  source?: "ai" | "rule";
};

function SuggestionsView({
  categories,
  mode,
  refresh,
  notify,
}: {
  categories: Category[];
  mode?: "SYNCHRONOUS" | "FREE";
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<"ai" | "rule">("rule");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: suggestions.length ? "regenerate" : "generate" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? t("suggestionError"));
      setLoading(false);
      return;
    }
    setSuggestions(data.suggestions ?? []);
    setSource(data.source === "ai" ? "ai" : "rule");
    setLoading(false);
    if (data.warning) setError(data.warning);
  };

  useEffect(() => {
    void generate();
  }, []);

  const addToToday = async (suggestion: Suggestion) => {
    setAdding(suggestion.id ?? suggestion.title);
    const start = suggestion.suggestedTime
      ? new Date(`${toDateKey()}T${suggestion.suggestedTime}:00`)
      : new Date(Date.now() + 60 * 60 * 1000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + suggestion.duration * 60 * 1000);
    const category = categories.find((item) => item.name.toLowerCase() === suggestion.category.toLowerCase()) ?? categories[0];
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activity",
        title: suggestion.title,
        description: suggestion.reason,
        categoryId: category?.id,
        startAt: mode === "FREE" ? new Date().toISOString() : start.toISOString(),
        endAt: mode === "FREE" ? new Date(Date.now() + suggestion.duration * 60 * 1000).toISOString() : end.toISOString(),
        isFree: mode === "FREE",
      }),
    });
    setAdding(null);
    if (!response.ok) {
      setError(t("suggestionError"));
      return;
    }
    notify(t("addedToToday"));
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("suggestionsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("suggestionsDescription")}</p>
        </div>
        <Button variant="outline" onClick={() => void generate()} disabled={loading}>
          <Sparkles size={16} /> {t("regenerateSuggestions")}
        </Button>
      </div>
      {error && <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{error}</p>}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label={t("loadingSuggestions")}>
          {[1, 2, 3, 4].map((item) => <Card key={item}><CardContent className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-9 w-28 animate-pulse rounded bg-muted" /></CardContent></Card>)}
        </div>
      ) : suggestions.length === 0 ? (
        <Empty text={t("suggestionEmpty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id ?? suggestion.title}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><Sparkles size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{suggestion.title}</h3>
                      <Badge variant={source === "ai" ? "success" : "default"}>{source === "ai" ? `✨ ${t("generatedByAI")}` : t("generatedByRules")}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{suggestion.category} · {suggestion.duration} {t("suggestionMinutes")} · {suggestion.points} {t("suggestionPoints")}</p>
                  </div>
                </div>
                <p className="text-sm"><span className="font-medium">{t("suggestionReason")}:</span> {suggestion.reason}</p>
                {suggestion.suggestedTime && <p className="text-xs text-muted-foreground">{t("suggestionTime")}: {suggestion.suggestedTime}</p>}
                <Button className="w-full" variant="outline" onClick={() => void addToToday(suggestion)} disabled={adding === (suggestion.id ?? suggestion.title)}>
                  {adding === (suggestion.id ?? suggestion.title) ? t("loading") : t("addToToday")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RewardsView({ rewards, user, notify }: any) { return <div className="space-y-6"><div><h2 className="text-2xl font-bold">Recompensas</h2><p className="text-sm text-muted-foreground">Convierte tu consistencia en tiempo para disfrutar.</p></div><div className="grid gap-4 md:grid-cols-3">{rewards.map((r: Reward) => <Card key={r.id}><CardContent className="p-5"><Gift className="mb-4 text-warning" /><h3 className="font-semibold">{r.title}</h3><p className="mt-1 text-sm text-muted-foreground">{r.description ?? "Recompensa personalizada"}</p><div className="mt-5 flex items-center justify-between"><span className="font-bold">{r.cost} pts</span><Button size="sm" disabled={(user?.points ?? 0) < r.cost} onClick={() => notify("Recompensa marcada para canjear.")}>Canjear</Button></div></CardContent></Card>)}</div></div>; }

function CalendarView({ activities, date, setDate, setTab }: any) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const anchor = new Date(`${date}T12:00:00`);
  const shift = (amount: number) => {
    const next = new Date(anchor);
    next.setDate(next.getDate() + (view === "month" ? amount * 30 : view === "week" ? amount * 7 : amount));
    setDate(toDateKey(next));
  };
  const weekStart = new Date(anchor); weekStart.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const days = Array.from({ length: view === "month" ? 35 : view === "week" ? 7 : 1 }, (_, i) => {
    const d = new Date(view === "month" ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : weekStart);
    d.setDate(d.getDate() + (view === "month" ? i : i));
    return d;
  });
  const title = calendarMonthFormatter.format(anchor);
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Calendario</h2><p className="text-sm text-muted-foreground">{title}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => shift(-1)}><ChevronLeft size={15} /></Button><Button variant="outline" size="sm" onClick={() => setDate(toDateKey(new Date()))}>Hoy</Button><Button variant="outline" size="sm" onClick={() => shift(1)}><ChevronRight size={15} /></Button><Button variant="outline" onClick={() => setTab("activities")}>Gestionar</Button></div></div>
    <div className="flex gap-1 rounded-lg border border-border p-1">{(["day", "week", "month"] as const).map((item) => <button key={item} className={cn("flex-1 rounded-md px-3 py-2 text-sm", view === item && "bg-foreground text-background")} onClick={() => setView(item)}>{item === "day" ? "Día" : item === "week" ? "Semana" : "Mes"}</button>)}</div>
    <div className={cn("grid gap-2", view === "day" ? "grid-cols-1" : view === "week" ? "md:grid-cols-7" : "grid-cols-5")}>{days.map((d) => { const key = toDateKey(d); const items = activities.filter((a: Activity) => toDateKey(new Date(a.startAt)) === key); return <button key={`${key}-${d.getTime()}`} onClick={() => setDate(key)} className={cn("min-h-28 rounded-xl border border-border p-3 text-left hover:bg-muted", date === key && "border-foreground", view === "month" && d.getMonth() !== anchor.getMonth() && "opacity-40")}><p className="text-xs text-muted-foreground">{calendarDayFormatter.format(d)}</p><div className="mt-2 space-y-1">{items.map((a: Activity) => <div key={a.id} className={cn("truncate rounded px-2 py-1 text-xs", a.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200" : "bg-muted")} style={{ borderLeft: `3px solid ${a.category?.color ?? "#888"}` }}>{a.title}</div>)}{!items.length && view !== "month" && <span className="text-xs text-muted-foreground">Sin actividades</span>}</div></button>; })}</div>
  </div>;
}

function StatsView({ activities }: any) {
  const data = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + i);
    const key = toDateKey(day);
    const mins = activities
      .filter((a: Activity) => toDateKey(new Date(a.startAt)) === key && a.status === "COMPLETED")
      .reduce((s: number, a: Activity) => s + minutesBetween(a.startAt, a.endAt), 0);
    return { name: weekdayFormatter.format(day), horas: Number((mins / 60).toFixed(1)) };
  });
  const categoryMap = activities.reduce((acc: Record<string, number>, a: Activity) => {
    const key = a.category?.name ?? "Libre";
    acc[key] = (acc[key] ?? 0) + minutesBetween(a.startAt, a.endAt);
    return acc;
  }, {} as Record<string, number>);
  const categoryEntries = Object.entries(categoryMap) as [string, number][];
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Estadísticas avanzadas</h2><p className="text-sm text-muted-foreground">Entiende dónde estás invirtiendo tu tiempo.</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Horas enfocadas por día</CardTitle></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="horas" fill="currentColor" radius={4} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Tiempo por categoría</CardTitle></CardHeader><CardContent className="space-y-4">{categoryEntries.length ? categoryEntries.map(([name, mins]) => <div key={name}><div className="mb-1 flex justify-between text-sm"><span>{name}</span><span className="text-muted-foreground">{Math.round(mins / 60 * 10) / 10} h</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-foreground" style={{ width: `${Math.min(100, mins / 10)}%` }} /></div></div>) : <Empty text="Completa actividades para ver estadísticas." />}</CardContent></Card>
      </div>
    </div>
  );
}

function StreakView({ user }: any) { const current = user?.currentStreak ?? 0; const milestones = [3, 5, 7, 9, 11, 12, 15, 18, 21, 25]; return <div className="mx-auto max-w-3xl space-y-6"><div className="text-center"><div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-orange-100 text-warning dark:bg-orange-950"><Flame size={40} /></div><h2 className="text-3xl font-bold">{current} días de cadena</h2><p className="mt-2 text-muted-foreground">Tu mejor cadena: {user?.bestStreak ?? 0} días. La consistencia construye libertad.</p></div><Card><CardHeader><CardTitle>Próximos hitos</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">{milestones.map((n) => <div key={n} className={cn("rounded-lg border p-4 text-center", current >= n && "border-success bg-green-50 dark:bg-green-950/30")}><div className="text-xl font-bold">{n}</div><p className="text-xs text-muted-foreground">{current >= n ? "Desbloqueado" : `${n - current} días`}</p></div>)}</CardContent></Card></div>; }

function TravelView({ travelActive, setTravelActive, notify }: any) { return <div className="mx-auto max-w-2xl space-y-6"><div><h2 className="text-2xl font-bold">Modo viaje / campamento</h2><p className="text-sm text-muted-foreground">Pausa tu agenda sin perder el orden de tus hábitos.</p></div><Card><CardContent className="space-y-5 p-6"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-full bg-muted"><Umbrella /></div><div className="flex-1"><h3 className="font-semibold">Modo libre temporal</h3><p className="mt-1 text-sm text-muted-foreground">Desactiva las actividades de la semana y permite reprogramarlas al regresar.</p></div><button onClick={() => { setTravelActive(!travelActive); notify(!travelActive ? "Modo viaje activado." : "Modo viaje desactivado."); }} className={cn("relative h-6 w-11 rounded-full transition", travelActive ? "bg-foreground" : "bg-muted")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-background transition", travelActive ? "left-6" : "left-1")} /></button></div>{travelActive && <div className="rounded-lg border border-warning bg-orange-50 p-4 text-sm text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">Tu agenda está en pausa. Al desactivar el modo, podrás reorganizar los bloques pendientes.</div>}</CardContent></Card></div>; }

function SettingsView({ user, theme, setTheme, refresh, notify }: any) {
  const [form, setForm] = useState({
    name: user?.name ?? "", email: user?.email ?? "", birthDate: user?.birthDate?.slice(0, 10) ?? "",
    occupation: user?.occupation ?? "", bio: user?.bio ?? "", interests: user?.interests ?? "",
    goals: user?.goals ?? "", workHours: user?.workHours ?? "",
    dailyAvailableMinutes: user?.dailyAvailableMinutes?.toString() ?? "", voiceEnabled: Boolean(user?.voiceEnabled),
    timezone: user?.timezone ?? "UTC", language: user?.language ?? "es", operationMode: user?.operationMode ?? "SYNCHRONOUS"
  });
  const update = (field: string, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/bootstrap", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settings", ...form, theme: theme === "dark" ? "DARK" : "LIGHT", notifyVolume: user?.notifyVolume ?? 70 })
    });
    const data = await response.json();
    if (!response.ok) { notify(data.error ?? "No se pudieron guardar los datos."); return; }
    await refresh(); notify("Perfil guardado correctamente.");
  };
  return <div className="max-w-3xl space-y-6">
    <div><h2 className="text-2xl font-bold">Perfil personal y ajustes</h2><p className="text-sm text-muted-foreground">Personaliza TimeLock con tus datos, intereses y disponibilidad.</p></div>
    <form onSubmit={save} className="space-y-6">
      <Card><CardHeader><CardTitle>Información personal</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium">Nombre completo<Input className="mt-2" value={form.name} onChange={(e) => update("name", e.target.value)} required /></label>
        <label className="block text-sm font-medium">Correo electrónico<Input className="mt-2" type="email" value={form.email} readOnly aria-describedby="email-help" placeholder="tu@email.com" /><span id="email-help" className="mt-1 block text-xs text-muted-foreground">El correo de acceso no se puede cambiar desde aquí.</span></label>
        <label className="block text-sm font-medium">Fecha de nacimiento<Input className="mt-2" type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} /></label>
        <label className="block text-sm font-medium">Trabajo u ocupación<Input className="mt-2" value={form.occupation} onChange={(e) => update("occupation", e.target.value)} placeholder="Ej. Diseñador, estudiante..." /></label>
        <label className="block text-sm font-medium md:col-span-2">Sobre ti<textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.bio} onChange={(e) => update("bio", e.target.value)} placeholder="Cuéntanos qué es importante para ti." /></label>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Preferencias y objetivos</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium">Gustos e intereses<textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.interests} onChange={(e) => update("interests", e.target.value)} placeholder="Música, deporte, lectura..." /></label>
        <label className="block text-sm font-medium">Objetivos personales<textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.goals} onChange={(e) => update("goals", e.target.value)} placeholder="Qué quieres lograr con tu tiempo." /></label>
        <label className="block text-sm font-medium">Horario habitual de trabajo<Input className="mt-2" value={form.workHours} onChange={(e) => update("workHours", e.target.value)} placeholder="Ej. Lunes a viernes, 9:00 - 17:00" /></label>
        <label className="block text-sm font-medium">Tiempo disponible al día (minutos)<Input className="mt-2" type="number" min="0" max="1440" value={form.dailyAvailableMinutes} onChange={(e) => update("dailyAvailableMinutes", e.target.value)} placeholder="Ej. 120" /></label>
      </CardContent></Card>
      <Card><CardContent className="space-y-5 p-6"><div><p className="mb-2 text-sm font-medium">Apariencia</p><div className="flex gap-2"><Button type="button" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}><Sun size={15} /> Claro</Button><Button type="button" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}><Moon size={15} /> Oscuro</Button></div></div><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm font-medium">Zona horaria<Input className="mt-2" value={form.timezone} onChange={(e) => update("timezone", e.target.value)} /></label><label className="block text-sm font-medium">Idioma<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.language} onChange={(e) => update("language", e.target.value)}><option value="es">Español</option><option value="en">English</option></select></label></div><div><p className="mb-2 text-sm font-medium">Modo de operación</p><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.operationMode} onChange={(e) => update("operationMode", e.target.value)}><option value="SYNCHRONOUS">Sincrónico: horarios y temporizador real</option><option value="FREE">Libre: empieza cuando quieras</option></select></div><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => update("voiceEnabled", e.target.checked)} /> Activar voz para recordatorios</label><Button type="submit">Guardar perfil y ajustes</Button></CardContent></Card>
    </form>
  </div>;
}

function ExportView({ downloadExport }: { downloadExport: () => void }) { return <div className="max-w-3xl space-y-6"><div><h2 className="text-2xl font-bold">Exportador</h2><p className="text-sm text-muted-foreground">Descarga tus datos para revisar tu progreso fuera de la app.</p></div><div className="grid gap-4 md:grid-cols-3">{["Hoy", "Esta semana", "Este mes"].map((label) => <Card key={label}><CardContent className="p-5"><Download className="mb-4" /><h3 className="font-semibold">Exportar {label}</h3><p className="my-3 text-sm text-muted-foreground">Actividades, puntos, tiempo y estado.</p><Button variant="outline" size="sm" onClick={downloadExport}>Descargar CSV</Button></CardContent></Card>)}</div><Card><CardContent className="flex items-center gap-4 p-5"><div className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Download size={18} /></div><div><p className="font-medium">PDF imprimible</p><p className="text-sm text-muted-foreground">Usa la impresión del navegador para guardar una vista PDF.</p></div><Button className="ml-auto" variant="outline" onClick={() => window.print()}>Imprimir / PDF</Button></CardContent></Card></div>; }

function ActivityForm({ categories, defaultDate, mode, onClose, onCreated }: { categories: Category[]; defaultDate: string; mode?: "SYNCHRONOUS" | "FREE"; onClose: () => void; onCreated: () => void }) { const [title, setTitle] = useState(""); const [categoryId, setCategoryId] = useState(categories[0]?.id ?? ""); const [start, setStart] = useState("09:00"); const [end, setEnd] = useState("10:00"); const [description, setDescription] = useState(""); const [duration, setDuration] = useState("60"); const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!title.trim()) return; const startAt = mode === "FREE" ? new Date().toISOString() : dateTimeFor(defaultDate, start); const endAt = mode === "FREE" ? new Date(Date.now() + Number(duration || 60) * 60_000).toISOString() : dateTimeFor(defaultDate, end); const response = await fetch("/api/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activity", title, categoryId, description, startAt, endAt, isFree: mode === "FREE" }) }); if (response.ok) onCreated(); }; return <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4"><Card className="w-full max-w-md"><CardHeader className="flex-row items-center justify-between"><CardTitle>{mode === "FREE" ? "Nueva actividad libre" : "Nueva actividad"}</CardTitle><Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Título<Input className="mt-2" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Estudiar React" /></label><label className="block text-sm font-medium">Categoría<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{mode === "FREE" ? <label className="block text-sm font-medium">Duración estimada (minutos)<Input className="mt-2" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} /></label> : <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Inicio<Input className="mt-2" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="text-sm font-medium">Fin<Input className="mt-2" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>}<label className="block text-sm font-medium">Descripción<textarea className="mt-2 min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} /></label><Button className="w-full" type="submit">{mode === "FREE" ? "Registrar actividad" : "Programar actividad"}</Button></form></CardContent></Card></div>; }
