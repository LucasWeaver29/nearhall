import type { DayHours, DiningHall } from "@/lib/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatClock(value: string | null): string {
  if (!value) return "?";
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return value.slice(0, 5);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function getTodayKey(date = new Date(), timeZone = "America/New_York") {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
    .format(date)
    .toLowerCase()
    .slice(0, 3) as (typeof DAY_KEYS)[number];
  return weekday;
}

export function getEasternMinutesNow(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isOpenNow(hours: DayHours, date = new Date()): boolean {
  if (!hours.enabled) return false;
  if (hours.is24Hours) return true;
  const start = parseTimeToMinutes(hours.start);
  const end = parseTimeToMinutes(hours.end);
  if (start == null || end == null) return false;
  const now = getEasternMinutesNow(date);
  if (end < start) {
    return now >= start || now <= end;
  }
  return now >= start && now <= end;
}

export function hoursLabel(hours: DayHours): string {
  if (!hours.enabled) return "Closed today";
  if (hours.is24Hours) return "Open 24 hours";
  return `${formatClock(hours.start)} – ${formatClock(hours.end)}`;
}

export function inferMealPeriod(date = new Date()): "breakfast" | "lunch" | "dinner" {
  const minutes = getEasternMinutesNow(date);
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60 + 30) return "lunch";
  return "dinner";
}

export function withOpenState<T extends Omit<DiningHall, "openNow" | "hoursLabel">>(
  hall: T,
  date = new Date(),
): DiningHall {
  const today = getTodayKey(date);
  const todayHours = hall.hours[today];
  return {
    ...hall,
    openNow: isOpenNow(todayHours, date) && hall.operatingStatus !== "closed",
    hoursLabel: hoursLabel(todayHours),
  };
}
