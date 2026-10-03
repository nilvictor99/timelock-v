import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const timeFormatter = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function formatTime(date: string | Date) {
  return timeFormatter.format(new Date(date));
}

export function minutesBetween(start: string | Date, end: string | Date) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}
