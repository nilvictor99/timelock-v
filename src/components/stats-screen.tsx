"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Download, Flame, Gift, Trophy, Clock3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, minutesBetween, toDateKey } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { DashboardShell } from "@/components/dashboard-shell";

type Category = { id: string; name: string; color: string };
type Activity = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  points: number;
  category?: Category | null;
};
type Reward = { id: string; title: string; cost: number; redeemedAt?: string | null };
type Bootstrap = { activities: Activity[]; categories: Category[]; rewards: Reward[]; user: { name?: string | null; currentStreak?: number; bestStreak?: number } };
type RangePreset = "today" | "week" | "month" | "custom";

const colors = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#db2777", "#ca8a04"];
const weekdayKeys = ["sunShort", "monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort"] as const;
const dateRangeSchema = z.object({ from: z.string().date(), to: z.string().date() });

function localKey(date: Date) {
  return toDateKey(date);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function dateFromKey(value: string, end = false) {
  const date = new Date(`${value}T00:00:00`);
  return end ? endOfDay(date) : date;
}

function formatDuration(minutes: number, t: (key: any) => string) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest} ${t("statsMinutes")}`;
  return `${hours} ${t("statsHours")} ${rest} ${t("statsMinutes")}`;
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground"><span>{title}</span>{icon}</div><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><div className="h-64 w-full" role="img" aria-label={title}>{children}</div></CardContent></Card>;
}

export default function StatsScreen() {
  const { t, locale, setLocale } = useI18n();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<RangePreset>("week");
  const [customFrom, setCustomFrom] = useState(localKey(new Date()));
  const [customTo, setCustomTo] = useState(localKey(new Date()));
  const [activitySearch, setActivitySearch] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/bootstrap", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? t("statsError"));
        if (!cancelled) {
          setData(result);
          if (result.user?.language === "en") setLocale("en");
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : t("statsError")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setLocale, t]);

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "today") return { from: new Date(now.setHours(0, 0, 0, 0)), to: endOfDay(new Date()) };
    if (preset === "week") return { from: startOfWeek(now), to: endOfDay(new Date()) };
    if (preset === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(new Date()) };
    const parsed = dateRangeSchema.safeParse({ from: customFrom, to: customTo });
    if (!parsed.success) {
      const today = new Date();
      return { from: new Date(today.setHours(0, 0, 0, 0)), to: endOfDay(new Date()) };
    }
    const from = dateFromKey(parsed.data.from);
    const to = dateFromKey(parsed.data.to, true);
    return from <= to ? { from, to } : { from: to, to: endOfDay(from) };
  }, [customFrom, customTo, preset]);

  const filteredActivities = useMemo(() => {
    if (!data) return [];
    return data.activities.filter((activity) => {
      const start = new Date(activity.startAt);
      const categoryId = activity.category?.id ?? "";
      return start >= range.from && start <= range.to &&
        (!selectedActivities.length || selectedActivities.includes(activity.id)) &&
        (!selectedCategories.length || selectedCategories.includes(categoryId));
    });
  }, [data, range, selectedActivities, selectedCategories]);

  const filteredRewards = useMemo(() => {
    if (!data) return [];
    return data.rewards.filter((reward) => reward.redeemedAt && new Date(reward.redeemedAt) >= range.from && new Date(reward.redeemedAt) <= range.to);
  }, [data, range]);

  const stats = useMemo(() => {
    const categoryMap = new Map<string, { name: string; minutes: number; color: string }>();
    const dailyMap = new Map<string, { date: string; minutes: number; completed: number; total: number }>();
    const activityMap = new Map<string, number>();
    const weekdayMap = weekdayKeys.map((key) => ({ day: t(key), completed: 0, total: 0 }));
    for (const activity of filteredActivities) {
      const minutes = minutesBetween(activity.startAt, activity.endAt);
      const category = activity.category?.name ?? t("statsNoCategory");
      const categoryId = activity.category?.id ?? "none";
      const previousCategory = categoryMap.get(categoryId);
      categoryMap.set(categoryId, { name: category, minutes: (previousCategory?.minutes ?? 0) + minutes, color: activity.category?.color ?? colors[categoryMap.size % colors.length] });
      const date = localKey(new Date(activity.startAt));
      const previousDay = dailyMap.get(date) ?? { date, minutes: 0, completed: 0, total: 0 };
      dailyMap.set(date, { date, minutes: previousDay.minutes + minutes, completed: previousDay.completed + (activity.status === "COMPLETED" ? 1 : 0), total: previousDay.total + 1 });
      activityMap.set(activity.title, (activityMap.get(activity.title) ?? 0) + 1);
      const day = new Date(activity.startAt).getDay();
      weekdayMap[day].total += 1;
      if (activity.status === "COMPLETED") weekdayMap[day].completed += 1;
    }
    const days = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const completedDates = new Set(filteredActivities.filter((a) => a.status === "COMPLETED").map((a) => localKey(new Date(a.startAt))));
    const allDates = [...new Set(filteredActivities.map((a) => localKey(new Date(a.startAt))))].sort();
    let longest = 0;
    let run = 0;
    let previous: Date | null = null;
    for (const value of allDates) {
      const current = dateFromKey(value);
      if (completedDates.has(value) && previous && (current.getTime() - previous.getTime()) === 86_400_000) run += 1;
      else run = completedDates.has(value) ? 1 : 0;
      longest = Math.max(longest, run);
      previous = current;
    }
    let current = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (completedDates.has(localKey(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    const perfectDays = days.filter((day) => day.total > 0 && day.completed === day.total).length;
    const streakHistory: { date: string; completed: boolean; total: number }[] = [];
    const historyCursor = new Date(range.from);
    historyCursor.setHours(0, 0, 0, 0);
    const historyEnd = new Date(range.to);
    historyEnd.setHours(0, 0, 0, 0);
    while (historyCursor <= historyEnd && streakHistory.length < 370) {
      const date = localKey(historyCursor);
      const day = dailyMap.get(date);
      streakHistory.push({ date, completed: Boolean(day?.total && day.completed === day.total), total: day?.total ?? 0 });
      historyCursor.setDate(historyCursor.getDate() + 1);
    }
    return {
      totalMinutes: filteredActivities.reduce((sum, item) => sum + minutesBetween(item.startAt, item.endAt), 0),
      completed: filteredActivities.filter((item) => item.status === "COMPLETED").length,
      points: filteredActivities.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + item.points, 0),
      category: [...categoryMap.values()].sort((a, b) => b.minutes - a.minutes),
      daily: days,
      topActivities: [...activityMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      weekday: weekdayMap.map((item) => ({ ...item, compliance: item.total ? Math.round((item.completed / item.total) * 100) : 0 })),
      current: Math.max(current, data?.user?.currentStreak ?? 0),
      longest: Math.max(longest, data?.user?.bestStreak ?? 0),
      perfectDays,
      streakHistory,
    };
  }, [data, filteredActivities, range, t]);

  const rewardTrend = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const reward of filteredRewards) {
      if (!reward.redeemedAt) continue;
      const date = new Date(reward.redeemedAt);
      const keyDate = preset === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : startOfWeek(date);
      const key = localKey(keyDate);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [filteredRewards, preset]);

  const visibleActivities = useMemo(() => data?.activities.filter((activity) => activity.title.toLowerCase().includes(activitySearch.toLowerCase())) ?? [], [activitySearch, data]);
  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const exportQuery = `from=${encodeURIComponent(localKey(range.from))}&to=${encodeURIComponent(localKey(range.to))}`;
  const hasData = filteredActivities.length > 0;

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("statsLoading")}</div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-lg"><CardContent className="p-6 text-sm text-danger">{error || t("statsError")}</CardContent></Card></div>;

  return (
    <DashboardShell active="stats" title={t("statsTitle")} user={data.user}>
      <div className="space-y-6">
        <div><h2 className="text-3xl font-bold tracking-tight">{t("statsTitle")}</h2><p className="mt-1 text-muted-foreground">{t("statsSubtitle")}</p></div>
        <Card><CardContent className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div><label className="mb-2 block text-sm font-medium">{t("statsDateRange")}</label><div className="flex flex-wrap gap-2">{(["today", "week", "month", "custom"] as RangePreset[]).map((value) => <button key={value} onClick={() => setPreset(value)} className={cn("rounded-md border px-3 py-2 text-sm", preset === value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{t(value === "today" ? "statsToday" : value === "week" ? "statsThisWeek" : value === "month" ? "statsThisMonth" : "statsCustom")}</button>)}</div></div>
          {preset === "custom" && <div className="grid grid-cols-2 gap-2"><label className="text-sm">{t("from")}<Input className="mt-2" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label><label className="text-sm">{t("to")}<Input className="mt-2" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label></div>}
          <div><label className="mb-2 block text-sm font-medium">{t("statsActivities")}</label><Input placeholder={t("statsSearchActivities")} value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} /><div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-auto">{visibleActivities.slice(0, 12).map((activity) => <label key={activity.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedActivities.includes(activity.id)} onChange={() => toggle(activity.id, selectedActivities, setSelectedActivities)} />{activity.title}</label>)}{data.activities.length > 12 && <span className="text-xs text-muted-foreground">+{data.activities.length - 12}</span>}</div></div>
          <div><label className="mb-2 block text-sm font-medium">{t("statsCategories")}</label><div className="flex max-h-24 flex-wrap gap-2 overflow-auto">{data.categories.map((category) => <label key={category.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggle(category.id, selectedCategories, setSelectedCategories)} />{category.name}</label>)}</div><button className="mt-2 text-xs text-muted-foreground underline" onClick={() => { setSelectedActivities([]); setSelectedCategories([]); }}>{t("statsAll")}</button></div>
        </CardContent></Card>

        {!hasData ? <Card><CardContent className="p-12 text-center"><CalendarDays className="mx-auto mb-4 text-muted-foreground" size={36} /><p className="text-sm text-muted-foreground">{t("statsEmpty")}</p></CardContent></Card> : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title={t("statsTotalTime")} value={formatDuration(stats.totalMinutes, t)} icon={<Clock3 className="text-info" size={18} />} />
            <Metric title={t("statsCompletedActivities")} value={String(stats.completed)} icon={<CheckCircle2 className="text-success" size={18} />} />
            <Metric title={t("statsPointsEarned")} value={String(stats.points)} icon={<Trophy className="text-warning" size={18} />} />
            <Metric title={t("statsRewardsRedeemed")} value={String(filteredRewards.length)} icon={<Gift className="text-warning" size={18} />} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title={t("statsTimeByCategory")}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.category} dataKey="minutes" nameKey="name" outerRadius={90} label>{stats.category.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => formatDuration(value, t)} /></PieChart></ResponsiveContainer></ChartCard>
            <ChartCard title={t("statsDailyEvolution")}><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value: number) => formatDuration(value, t)} /><Line type="monotone" dataKey="minutes" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
            <ChartCard title={t("statsTopActivities")}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.topActivities} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard>
            <ChartCard title={t("statsComplianceByDay")}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.weekday}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, 100]} /><Tooltip formatter={(value: number) => `${value}%`} /><Bar dataKey="compliance" fill="#9333ea" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          </div>
          <Card><CardHeader><CardTitle>{t("statsRedeemedRewards")}</CardTitle></CardHeader><CardContent><div className="mb-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">{t("statsPointsSpent")}</span><strong>{filteredRewards.reduce((sum, reward) => sum + reward.cost, 0)} {t("statsPointsAbbrev")}</strong></div>{filteredRewards.length ? <div className="grid gap-5 lg:grid-cols-[1fr_220px]"><div className="space-y-2">{filteredRewards.map((reward) => <div key={reward.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span className="flex items-center gap-2"><Gift size={16} className="text-warning" />{reward.title}</span><span className="text-muted-foreground">{reward.redeemedAt ? new Date(reward.redeemedAt).toLocaleDateString(locale) : ""} · {reward.cost} {t("statsPointsAbbrev")}</span></div>)}</div>{rewardTrend.length > 0 && <div className="h-32"><ResponsiveContainer width="100%" height="100%"><BarChart data={rewardTrend}><XAxis dataKey="date" hide /><YAxis allowDecimals={false} width={24} /><Tooltip /><Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</div> : <p className="text-sm text-muted-foreground">{t("statsNoRewards")}</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>{t("statsChains")}</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-lg bg-muted p-4"><Flame className="mb-2 text-warning" size={20} /><p className="text-xs text-muted-foreground">{t("statsCurrentStreak")}</p><strong className="text-2xl">{stats.current}</strong></div><div className="rounded-lg bg-muted p-4"><Trophy className="mb-2 text-warning" size={20} /><p className="text-xs text-muted-foreground">{t("statsLongestStreak")}</p><strong className="text-2xl">{stats.longest}</strong></div><div className="rounded-lg bg-muted p-4"><CheckCircle2 className="mb-2 text-success" size={20} /><p className="text-xs text-muted-foreground">{t("statsPerfectDays")}</p><strong className="text-2xl">{stats.perfectDays}</strong></div></div><div className="mt-5 flex flex-wrap gap-1" aria-label={t("statsChains")}>{stats.streakHistory.map((day) => <span key={day.date} title={`${day.date}: ${day.total}`} className={cn("h-4 w-4 rounded-sm border border-border", day.completed ? "bg-success" : day.total ? "bg-warning/50" : "bg-muted")} />)}</div></CardContent></Card>
        </>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { window.location.href = `/api/export?${exportQuery}`; }}><Download size={16} />{t("statsExportCsv")}</Button><Button variant="outline" onClick={() => window.print()}><Download size={16} />{t("statsExportPdf")}</Button></div>
      </div>
    </DashboardShell>
  );
}
