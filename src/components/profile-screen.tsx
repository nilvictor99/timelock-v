"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Camera, Check, Copy, KeyRound, Loader2, Mail, RotateCcw, ShieldCheck, X, XCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAutosave, type AutosaveStatus } from "@/lib/use-autosave";

type Experience = "BASIC" | "INTERMEDIATE" | "EXPERT";
type Skill = { name: string; experience: Experience };
type ArrayField =
  | "hobbies"
  | "sports"
  | "creativeActivities"
  | "learningInterests"
  | "preferredActivityTypes"
  | "preferredTimesOfDay"
  | "freeDays"
  | "resourcesAccess";

type ProfileForm = {
  name: string;
  bio: string;
  country: string;
  city: string;
  birthDate: string;
  genderIdentity: string;
  fitnessLevel: string;
  physicalLimitations: string;
  exerciseIntensity: string;
  skillsWithExperience: Skill[];
  hobbies: string[];
  sports: string[];
  creativeActivities: string[];
  learningInterests: string[];
  preferredActivityTypes: string[];
  preferredDuration: string;
  preferredTimesOfDay: string[];
  soloGroupPreference: string;
  energyLevel: string;
  indoorOutdoorPreference: string;
  activityBudget: string;
  workStudyStart: string;
  workStudyEnd: string;
  freeDays: string[];
  dailyAvailableMinutes: number | null;
  resourcesAccess: string[];
  mainGoals: string[];
  shortTermGoals: string;
  motivationLevel: number | null;
};

type ProfileData = {
  user: Record<string, any>;
  activities: Array<{ status: string; startAt: string; endAt: string }>;
};

const emptyForm: ProfileForm = {
  name: "",
  bio: "",
  country: "",
  city: "",
  birthDate: "",
  genderIdentity: "",
  fitnessLevel: "",
  physicalLimitations: "",
  exerciseIntensity: "",
  skillsWithExperience: [],
  hobbies: [],
  sports: [],
  creativeActivities: [],
  learningInterests: [],
  preferredActivityTypes: [],
  preferredDuration: "",
  preferredTimesOfDay: [],
  soloGroupPreference: "",
  energyLevel: "",
  indoorOutdoorPreference: "",
  activityBudget: "",
  workStudyStart: "",
  workStudyEnd: "",
  freeDays: [],
  dailyAvailableMinutes: null,
  resourcesAccess: [],
  mainGoals: [],
  shortTermGoals: "",
  motivationLevel: null,
};

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formFromUser(user: Record<string, any>): ProfileForm {
  const skills = Array.isArray(user.skillsWithExperience)
    ? user.skillsWithExperience.filter(
        (item: any): item is Skill =>
          typeof item?.name === "string" &&
          ["BASIC", "INTERMEDIATE", "EXPERT"].includes(item.experience),
      )
    : [];
  return {
    ...emptyForm,
    name: user.name ?? "",
    bio: user.bio ?? "",
    country: user.country ?? "",
    city: user.city ?? "",
    birthDate: user.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : "",
    genderIdentity: user.genderIdentity ?? "",
    fitnessLevel: user.fitnessLevel ?? "",
    physicalLimitations: user.physicalLimitations ?? "",
    exerciseIntensity: user.exerciseIntensity ?? "",
    skillsWithExperience: skills,
    hobbies: asStrings(user.hobbies),
    sports: asStrings(user.sports),
    creativeActivities: asStrings(user.creativeActivities),
    learningInterests: asStrings(user.learningInterests),
    preferredActivityTypes: asStrings(user.preferredActivityTypes),
    preferredDuration: user.preferredDuration ?? "",
    preferredTimesOfDay: asStrings(user.preferredTimesOfDay),
    soloGroupPreference: user.soloGroupPreference ?? "",
    energyLevel: user.energyLevel ?? "",
    indoorOutdoorPreference: user.indoorOutdoorPreference ?? "",
    activityBudget: user.activityBudget ?? "",
    workStudyStart: user.workStudyStart ?? "",
    workStudyEnd: user.workStudyEnd ?? "",
    freeDays: asStrings(user.freeDays),
    dailyAvailableMinutes: user.dailyAvailableMinutes ?? null,
    resourcesAccess: asStrings(user.resourcesAccess),
    mainGoals: asStrings(user.mainGoals).slice(0, 5),
    shortTermGoals: user.shortTermGoals ?? "",
    motivationLevel: user.motivationLevel ?? null,
  };
}

const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  currentPassword: z.string().min(1),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
  confirmPassword: z.string().min(1),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
});

function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
}

function ageFromBirthDate(value: string) {
  if (!value) return "";
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayNotReached =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? String(age) : "";
}

export default function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [qr, setQr] = useState<{ imageUrl: string; token: string; loginUrl: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [skillExperience, setSkillExperience] = useState<Experience>("BASIC");
  const [email, setEmail] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = async () => {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json();
    setData(next);
    setForm(formFromUser(next.user));
    setEmail(next.user.email ?? "");
    setLocale(next.user.language === "en" ? "en" : "es");
    setLoaded(true);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!qr) return;
    const remaining = new Date(qr.expiresAt).getTime() - Date.now();
    const timeout = window.setTimeout(() => setQr(null), Math.max(0, remaining));
    return () => window.clearTimeout(timeout);
  }, [qr]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const stats = useMemo(() => {
    const activities = data?.activities ?? [];
    const completed = activities.filter((activity) => activity.status === "COMPLETED");
    return {
      days: new Set(completed.map((activity) => new Date(activity.startAt).toDateString())).size,
      minutes: completed.reduce(
        (sum, activity) =>
          sum + Math.max(0, (new Date(activity.endAt).getTime() - new Date(activity.startAt).getTime()) / 60000),
        0,
      ),
    };
  }, [data]);

  const setProfileValue = useCallback(<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const saveProfileField = useCallback(async (key: keyof ProfileForm, value: ProfileForm[keyof ProfileForm]) => {
    const nullableSelects = ["genderIdentity", "fitnessLevel", "exerciseIntensity", "preferredDuration", "soloGroupPreference", "energyLevel", "indoorOutdoorPreference", "activityBudget"];
    const payload = nullableSelects.includes(String(key)) && value === "" ? null : value;
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settings", [key]: payload }),
    });
    if (!response.ok) {
      setMessage(t("profileValidationError"));
      return false;
    }
    const next = await response.json();
    setData((current) => current ? { ...current, user: next } : current);
    setMessage(t("saved"));
    return true;
  }, [t]);

  const { statuses, revert } = useAutosave({
    values: form,
    ready: loaded && Boolean(data),
    save: (key, value) => saveProfileField(key, value),
    onRevert: (key, value) => setProfileValue(key, value),
  });

  if (!data) {
    return (
      <DashboardShell active="profile" title={t("profile")}>
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      </DashboardShell>
    );
  }

  const initials =
    data.user.name?.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "TL";
  const age = ageFromBirthDate(form.birthDate);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfileValue(key, value);
  }

  function toggleArray(field: ArrayField, value: string) {
    const current = form[field];
    setField(field, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function addSkill(event?: React.KeyboardEvent<HTMLInputElement>) {
    event?.preventDefault();
    const name = newSkill.trim();
    if (!name || form.skillsWithExperience.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) return;
    setField("skillsWithExperience", [...form.skillsWithExperience, { name, experience: skillExperience }]);
    setNewSkill("");
  }

  async function updateEmail() {
    const parsed = emailChangeSchema.safeParse({ email, currentPassword: emailPassword });
    if (!parsed.success) {
      setMessage(t("profileValidationError"));
      return;
    }
    setEmailSaving(true);
    const response = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json().catch(() => ({}));
    setEmailSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? t("saveError"));
      return;
    }
    setEmailModalOpen(false);
    setEmailPassword("");
    setToast(t("emailChanged"));
    await load();
  }

  async function updatePassword() {
    const parsed = passwordChangeSchema.safeParse(passwordForm);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.path[0] === "confirmPassword" ? t("passwordMismatch") : t("profileValidationError"));
      return;
    }
    setPasswordSaving(true);
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const result = await response.json().catch(() => ({}));
    setPasswordSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? t("saveError"));
      return;
    }
    setPasswordModalOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setToast(t("passwordChanged"));
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage(t("invalidFile"));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/profile/avatar", { method: "POST", body });
    if (response.ok) {
      await load();
      setMessage(t("saved"));
    } else {
      setMessage((await response.json()).error ?? t("invalidFile"));
    }
  }

  async function generateQr() {
    const response = await fetch("/api/auth/qr", { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    const loginUrl = `${window.location.origin}/login?qr=${encodeURIComponent(result.token)}`;
    setQr({
      imageUrl: await QRCode.toDataURL(loginUrl, { margin: 2, width: 240 }),
      token: result.token,
      loginUrl,
      expiresAt: result.expiresAt,
    });
  }

  function downloadQrPng() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr.imageUrl;
    link.download = "timelock-qr-login.png";
    link.click();
  }

  async function downloadQrPdf() {
    if (!qr) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ format: "a4", unit: "mm" });
    pdf.setFontSize(18);
    pdf.text("TimeLock-v", 20, 25);
    pdf.setFontSize(13);
    pdf.text(t("qrLogin"), 20, 35);
    pdf.addImage(qr.imageUrl, "PNG", 20, 45, 70, 70);
    pdf.setFontSize(10);
    pdf.text(t("qrExpires"), 20, 125);
    pdf.text(new Date(qr.expiresAt).toLocaleString(locale), 20, 133);
    pdf.save("timelock-qr-login.pdf");
  }

  return (
    <DashboardShell active="profile" title={t("profile")}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("profile")}</h1>
          <p className="text-sm text-muted-foreground">{data.user.email}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mail size={18} /> {t("account")}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-foreground text-2xl font-bold text-background">
                    {data.user.avatarUrl ? <img src={data.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted">
                    <Camera size={16} /> {t("uploadAvatar")}
                    <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} />
                  </label>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-sm font-medium">{t("email")}<Input className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                  <Button type="button" onClick={() => setEmailModalOpen(true)} disabled={email === (data.user.email ?? "")}>{t("updateEmail")}</Button>
                </div>
                <Button type="button" variant="outline" onClick={() => setPasswordModalOpen(true)}><KeyRound size={16} /> {t("changePassword")}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("profilePersonal")}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <label className="block text-sm font-medium">{t("name")}<Input className="mt-2" value={form.name} onChange={(event) => setField("name", event.target.value)} /></label>
                <AutoStatus status={statuses.name} onRevert={() => revert("name")} t={t} />
                <label className="block text-sm font-medium">{t("bio")}<textarea maxLength={160} className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.bio} onChange={(event) => setField("bio", event.target.value)} /></label>
                <AutoStatus status={statuses.bio} onRevert={() => revert("bio")} t={t} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">{t("country")}<Input className="mt-2" value={form.country} onChange={(event) => setField("country", event.target.value)} /><AutoStatus status={statuses.country} onRevert={() => revert("country")} t={t} /></label>
                  <label className="text-sm font-medium">{t("city")}<Input className="mt-2" value={form.city} onChange={(event) => setField("city", event.target.value)} /><AutoStatus status={statuses.city} onRevert={() => revert("city")} t={t} /></label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">{t("birthDate")}<Input className="mt-2" type="date" value={form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} /></label>
                  <label className="text-sm font-medium">{t("age")}<Input className="mt-2" value={age || "—"} readOnly aria-readonly="true" /></label>
                  <SelectField label={t("genderIdentity")} value={form.genderIdentity} onChange={(value) => setField("genderIdentity", value)} options={[["MAN", t("man")], ["WOMAN", t("woman")], ["NON_BINARY", t("nonBinary")], ["PREFER_NOT_TO_SAY", t("preferNotToSay")], ["OTHER", t("other")]]} t={t} />
                </div>
                <AutoStatus status={statuses.birthDate} onRevert={() => revert("birthDate")} t={t} />
                <AutoStatus status={statuses.genderIdentity} onRevert={() => revert("genderIdentity")} t={t} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("accountStats")}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label={t("activeDays")} value={String(stats.days)} />
                <Metric label={t("currentStreak")} value={`${data.user.currentStreak ?? 0}`} />
                <Metric label={t("totalPoints")} value={`${data.user.points ?? 0}`} />
                <Metric label={t("totalTime")} value={`${Math.round(stats.minutes)}m`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={18} /> {t("security")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("qrExpires")}</p>
                <div className="mt-4 flex flex-wrap items-start gap-5">
                  {qr && <div className="rounded-lg border bg-white p-2"><img src={qr.imageUrl} alt={t("qrLogin")} className="h-56 w-56" /><p className="mt-2 text-center text-xs text-slate-700">{t("qrScan")}</p></div>}
                  <div className="min-w-0 space-y-2">
                    <Button onClick={() => void generateQr()}>{t("generateQr")}</Button>
                    {qr && <><p className="text-xs text-muted-foreground">{t("qrValidUntil")}: {new Date(qr.expiresAt).toLocaleString(locale)}</p><div className="space-y-1 text-sm"><p className="break-all"><span className="font-medium">{t("qrToken")}:</span> {qr.token}</p><Button variant="outline" onClick={() => navigator.clipboard?.writeText(qr.token)}><Copy size={15} /> {t("copyToken")}</Button><p className="break-all"><span className="font-medium">{t("qrLink")}:</span> {qr.loginUrl}</p><Button variant="outline" onClick={() => navigator.clipboard?.writeText(qr.loginUrl)}><Copy size={15} /> {t("copyLink")}</Button></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={downloadQrPng}>{t("downloadPng")}</Button><Button variant="outline" size="sm" onClick={() => void downloadQrPdf()}>{t("downloadPdf")}</Button></div><p className="max-w-xs text-xs text-warning">{t("qrDownloadWarning")}</p></>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <Section title={t("profilePhysical")}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label={t("fitnessLevel")} value={form.fitnessLevel} onChange={(value) => setField("fitnessLevel", value)} options={[["BEGINNER", t("beginner")], ["INTERMEDIATE", t("intermediate")], ["ADVANCED", t("advanced")]]} t={t} />
            <SelectField label={t("exerciseIntensity")} value={form.exerciseIntensity} onChange={(value) => setField("exerciseIntensity", value)} options={[["GENTLE", t("gentle")], ["MODERATE", t("moderate")], ["INTENSE", t("intense")]]} t={t} />
          </div>
          <label className="block text-sm font-medium">{t("physicalLimitations")}<textarea maxLength={500} className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.physicalLimitations} onChange={(event) => setField("physicalLimitations", event.target.value)} /></label>
          <AutoStatus status={statuses.fitnessLevel} onRevert={() => revert("fitnessLevel")} t={t} />
          <AutoStatus status={statuses.exerciseIntensity} onRevert={() => revert("exerciseIntensity")} t={t} />
          <AutoStatus status={statuses.physicalLimitations} onRevert={() => revert("physicalLimitations")} t={t} />
        </Section>

        <Section title={t("profileInterests")}>
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="text-sm font-medium">{t("skills")}<Input className="mt-2" value={newSkill} placeholder={t("skillPlaceholder")} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addSkill(event); }} /></label>
              <label className="text-sm font-medium">{t("experience")}<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={skillExperience} onChange={(event) => setSkillExperience(event.target.value as Experience)}><option value="BASIC">{t("basic")}</option><option value="INTERMEDIATE">{t("intermediate")}</option><option value="EXPERT">{t("expert")}</option></select></label>
            </div>
            <div className="flex flex-wrap gap-2">{form.skillsWithExperience.map((skill, index) => <span key={`${skill.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">{skill.name}<span className="text-xs text-muted-foreground">{t(skill.experience === "BASIC" ? "basic" : skill.experience === "EXPERT" ? "expert" : "intermediate")}</span><button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`${t("removeTag")} ${skill.name}`} onClick={() => setField("skillsWithExperience", form.skillsWithExperience.filter((_, skillIndex) => skillIndex !== index))}><X size={13} /></button></span>)}</div>
            <TagInput label={t("hobbies")} values={form.hobbies} onChange={(value) => setField("hobbies", value)} placeholder={t("tagPlaceholder")} t={t} />
            <TagInput label={t("sports")} values={form.sports} onChange={(value) => setField("sports", value)} placeholder={t("tagPlaceholder")} t={t} />
            <TagInput label={t("creativeActivities")} values={form.creativeActivities} onChange={(value) => setField("creativeActivities", value)} placeholder={t("tagPlaceholder")} t={t} />
            <TagInput label={t("learningInterests")} values={form.learningInterests} onChange={(value) => setField("learningInterests", value)} placeholder={t("tagPlaceholder")} t={t} />
            <AutoStatus status={statuses.skillsWithExperience} onRevert={() => revert("skillsWithExperience")} t={t} />
            <AutoStatus status={statuses.hobbies} onRevert={() => revert("hobbies")} t={t} />
            <AutoStatus status={statuses.sports} onRevert={() => revert("sports")} t={t} />
            <AutoStatus status={statuses.creativeActivities} onRevert={() => revert("creativeActivities")} t={t} />
            <AutoStatus status={statuses.learningInterests} onRevert={() => revert("learningInterests")} t={t} />
          </div>
        </Section>

        <Section title={t("profilePreferences")}>
          <CheckboxGroup label={t("activityTypes")} values={form.preferredActivityTypes} options={[["PHYSICAL", t("physical")], ["MENTAL", t("mental")], ["CREATIVE", t("creative")], ["SOCIAL", t("social")], ["RELAXING", t("relaxing")], ["PRODUCTIVE", t("productive")]]} onToggle={(value) => toggleArray("preferredActivityTypes", value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label={t("preferredDuration")} value={form.preferredDuration} onChange={(value) => setField("preferredDuration", value)} options={[["15", t("minutes15")], ["30", t("minutes30")], ["45", t("minutes45")], ["60", t("minutes60")], ["90", t("minutes90")], ["FLEXIBLE", t("flexible")]]} t={t} />
            <SelectField label={t("soloGroup")} value={form.soloGroupPreference} onChange={(value) => setField("soloGroupPreference", value)} options={[["SOLO", t("solo")], ["GROUP", t("group")], ["INDIFFERENT", t("indifferent")]]} t={t} />
            <SelectField label={t("energyLevel")} value={form.energyLevel} onChange={(value) => setField("energyLevel", value)} options={[["LOW", t("low")], ["MEDIUM", t("medium")], ["HIGH", t("high")]]} t={t} />
            <SelectField label={t("indoorOutdoor")} value={form.indoorOutdoorPreference} onChange={(value) => setField("indoorOutdoorPreference", value)} options={[["INDOOR", t("indoor")], ["OUTDOOR", t("outdoor")], ["INDIFFERENT", t("indifferent")]]} t={t} />
            <SelectField label={t("budget")} value={form.activityBudget} onChange={(value) => setField("activityBudget", value)} options={[["FREE", t("noCost")], ["LOW", t("low")], ["MEDIUM", t("medium")], ["HIGH", t("high")], ["UNLIMITED", t("unlimited")]]} t={t} />
          </div>
          <CheckboxGroup label={t("preferredTimes")} values={form.preferredTimesOfDay} options={[["MORNING", t("morning")], ["MIDDAY", t("midday")], ["AFTERNOON", t("afternoon")], ["NIGHT", t("night")]]} onToggle={(value) => toggleArray("preferredTimesOfDay", value)} />
          <AutoStatus status={statuses.preferredActivityTypes} onRevert={() => revert("preferredActivityTypes")} t={t} />
          <AutoStatus status={statuses.preferredDuration} onRevert={() => revert("preferredDuration")} t={t} />
          <AutoStatus status={statuses.preferredTimesOfDay} onRevert={() => revert("preferredTimesOfDay")} t={t} />
          <AutoStatus status={statuses.soloGroupPreference} onRevert={() => revert("soloGroupPreference")} t={t} />
          <AutoStatus status={statuses.energyLevel} onRevert={() => revert("energyLevel")} t={t} />
          <AutoStatus status={statuses.indoorOutdoorPreference} onRevert={() => revert("indoorOutdoorPreference")} t={t} />
          <AutoStatus status={statuses.activityBudget} onRevert={() => revert("activityBudget")} t={t} />
        </Section>

        <Section title={t("profileAvailability")}>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">{t("workStudyStart")}<Input className="mt-2" type="time" value={form.workStudyStart} onChange={(event) => setField("workStudyStart", event.target.value)} /></label>
            <label className="text-sm font-medium">{t("workStudyEnd")}<Input className="mt-2" type="time" value={form.workStudyEnd} onChange={(event) => setField("workStudyEnd", event.target.value)} /></label>
            <label className="text-sm font-medium">{t("dailyMinutes")}<Input className="mt-2" type="number" min={0} max={1440} value={form.dailyAvailableMinutes ?? ""} onChange={(event) => setField("dailyAvailableMinutes", event.target.value === "" ? null : Number(event.target.value))} /></label>
          </div>
          <CheckboxGroup label={t("freeDays")} values={form.freeDays} options={[["MONDAY", t("monShort")], ["TUESDAY", t("tueShort")], ["WEDNESDAY", t("wedShort")], ["THURSDAY", t("thuShort")], ["FRIDAY", t("friShort")], ["SATURDAY", t("satShort")], ["SUNDAY", t("sunShort")]]} onToggle={(value) => toggleArray("freeDays", value)} />
          <CheckboxGroup label={t("resources")} values={form.resourcesAccess} options={[["GYM", t("gym")], ["KITCHEN", t("kitchen")], ["PARK", t("park")], ["LIBRARY", t("library")], ["POOL", t("pool")], ["STUDIO", t("studio")], ["OTHER", t("resourceOther")]]} onToggle={(value) => toggleArray("resourcesAccess", value)} />
          <AutoStatus status={statuses.resourcesAccess} onRevert={() => revert("resourcesAccess")} t={t} />
          <AutoStatus status={statuses.workStudyStart} onRevert={() => revert("workStudyStart")} t={t} />
          <AutoStatus status={statuses.workStudyEnd} onRevert={() => revert("workStudyEnd")} t={t} />
          <AutoStatus status={statuses.dailyAvailableMinutes} onRevert={() => revert("dailyAvailableMinutes")} t={t} />
          <AutoStatus status={statuses.freeDays} onRevert={() => revert("freeDays")} t={t} />
        </Section>

        <Section title={t("profileGoals")}>
          <label className="block text-sm font-medium">{t("mainGoals")}<textarea className="mt-2 min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" placeholder={t("goalPlaceholder")} value={form.mainGoals.join("\n")} onChange={(event) => setField("mainGoals", event.target.value.split("\n").map((goal) => goal.trim()).filter(Boolean).slice(0, 5))} /></label>
          <label className="block text-sm font-medium">{t("shortTermGoals")}<textarea maxLength={1000} className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.shortTermGoals} onChange={(event) => setField("shortTermGoals", event.target.value)} /></label>
          <label className="block text-sm font-medium">{t("motivation")}<input className="mt-3 w-full accent-foreground" type="range" min={1} max={10} value={form.motivationLevel ?? 5} onChange={(event) => setField("motivationLevel", Number(event.target.value))} /><span className="text-xs text-muted-foreground">{form.motivationLevel ?? 5}/10</span></label>
          <AutoStatus status={statuses.mainGoals} onRevert={() => revert("mainGoals")} t={t} />
          <AutoStatus status={statuses.shortTermGoals} onRevert={() => revert("shortTermGoals")} t={t} />
          <AutoStatus status={statuses.motivationLevel} onRevert={() => revert("motivationLevel")} t={t} />
        </Section>
      </div>
      {emailModalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>{t("updateEmail")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("currentPassword")}</p>
            <Input type="password" autoComplete="current-password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setEmailModalOpen(false); setEmailPassword(""); }}>{t("cancel")}</Button><Button type="button" disabled={emailSaving} onClick={() => void updateEmail()}>{emailSaving ? t("loading") : t("updateEmail")}</Button></div>
          </CardContent>
        </Card>
      </div>}
      {passwordModalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>{t("changePassword")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium">{t("currentPassword")}<Input className="mt-2" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
            <label className="block text-sm font-medium">{t("newPassword")}<Input className="mt-2" type="password" autoComplete="new-password" minLength={12} value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} /></label>
            <div aria-live="polite">
              <div className="flex gap-1">{[1, 2, 3].map((level) => <span key={level} className={`h-1.5 flex-1 rounded-full ${passwordStrength(passwordForm.newPassword) >= level ? level === 3 ? "bg-success" : "bg-warning" : "bg-muted"}`} />)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t("passwordStrength")}: {passwordStrength(passwordForm.newPassword) >= 3 ? t("strong") : passwordStrength(passwordForm.newPassword) >= 2 ? t("mediumStrength") : t("weak")}</p>
            </div>
            <label className="block text-sm font-medium">{t("confirmPassword")}<Input className="mt-2" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setPasswordModalOpen(false); setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }}>{t("cancel")}</Button><Button type="button" disabled={passwordSaving} onClick={() => void updatePassword()}>{passwordSaving ? t("loading") : t("save")}</Button></div>
          </CardContent>
        </Card>
      </div>}
      {toast && <div className="fixed bottom-6 right-6 z-[60] rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg" role="status">{toast}</div>}
    </DashboardShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <details open className="rounded-lg border border-border bg-card"><summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold">{title}</summary><div className="space-y-5 border-t border-border px-5 py-5">{children}</div></details>;
}

function SelectField({ label, value, onChange, options, t }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; t: (key: any) => string }) {
  return <label className="text-sm font-medium">{label}<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{t("chooseOption")}</option>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}

function CheckboxGroup({ label, values, options, onToggle }: { label: string; values: string[]; options: Array<[string, string]>; onToggle: (value: string) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{options.map(([value, text]) => <label key={value} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:bg-muted"><input type="checkbox" className="accent-foreground" checked={values.includes(value)} onChange={() => onToggle(value)} />{text}</label>)}</div></fieldset>;
}

function TagInput({ label, values, onChange, placeholder, t }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; t: (key: any) => string }) {
  const [input, setInput] = useState("");
  function add(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = input.trim();
    if (value && !values.some((item) => item.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setInput("");
  }
  return <div><label className="block text-sm font-medium">{label}<Input className="mt-2" value={input} placeholder={placeholder} onChange={(event) => setInput(event.target.value)} onKeyDown={add} /></label><div className="mt-2 flex flex-wrap gap-2">{values.map((value, index) => <span key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">{value}<button type="button" className="rounded-full p-0.5 hover:bg-background" aria-label={`${t("removeTag")} ${value}`} onClick={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}><X size={13} /></button></span>)}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function AutoStatus({ status, onRevert, t }: { status?: AutosaveStatus; onRevert: () => void; t: (key: any) => string }) {
  if (!status || status === "idle") return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      {status === "saving" && <Loader2 size={13} className="animate-spin" />}
      {status === "saved" && <Check size={13} className="text-success" />}
      {status === "error" && <XCircle size={13} className="text-danger" />}
      <span>{t(status === "modified" ? "autosaveModified" : status === "saving" ? "autosaveSaving" : status === "saved" ? "autosaveSaved" : "autosaveError")}</span>
      {(status === "modified" || status === "error") && <Button type="button" variant="ghost" size="sm" onClick={onRevert}><RotateCcw size={13} />{t("autosaveRevert")}</Button>}
    </div>
  );
}
