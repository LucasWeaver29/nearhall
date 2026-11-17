import { easternNoonFromIso, todayEasternIso } from "@/lib/dates";
import type { DayHours, DiningHall, MealPeriod, WeekHours } from "@/lib/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

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

export function getTodayKey(date = new Date(), timeZone = "America/New_York"): DayKey {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
    .format(date)
    .toLowerCase()
    .slice(0, 3) as DayKey;
  return weekday;
}

export function getDayKeyForIso(iso: string): DayKey {
  const noon = easternNoonFromIso(iso);
  return getTodayKey(noon ?? new Date());
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

export function hoursLabel(hours: DayHours, meal?: MealPeriod): string {
  if (!hours.enabled) return meal ? `${mealLabel(meal)} closed` : "Closed today";
  if (hours.is24Hours) return "Open 24 hours";
  const range = `${formatClock(hours.start)} – ${formatClock(hours.end)}`;
  return meal ? `${mealLabel(meal)} ${range}` : range;
}

function mealLabel(meal: MealPeriod): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

export function inferMealPeriod(date = new Date()): MealPeriod {
  const minutes = getEasternMinutesNow(date);
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60 + 30) return "lunch";
  return "dinner";
}

export function resolveWeekHours(
  hall: Pick<DiningHall, "facilityHours" | "mealHours">,
  meal: MealPeriod,
): WeekHours {
  return hall.mealHours[meal] ?? hall.facilityHours;
}

export function withMealContext(
  hall: Omit<DiningHall, "openNow" | "hoursLabel" | "hours"> &
    Partial<Pick<DiningHall, "hours">>,
  meal: MealPeriod,
  dateIso: string = todayEasternIso(),
  now = new Date(),
): DiningHall {
  const week = resolveWeekHours(hall, meal);
  const dayKey = getDayKeyForIso(dateIso);
  const dayHours = week[dayKey];
  const isToday = dateIso === todayEasternIso(now);

  return {
    ...hall,
    hours: week,
    openNow:
      isToday &&
      hall.operatingStatus !== "closed" &&
      isOpenNow(dayHours, now),
    hoursLabel: hoursLabel(dayHours, meal),
  };
}

/** @deprecated prefer withMealContext */
export function withOpenState<
  T extends Omit<DiningHall, "openNow" | "hoursLabel" | "hours"> &
    Partial<Pick<DiningHall, "hours">>,
>(hall: T, date = new Date()): DiningHall {
  return withMealContext(hall, inferMealPeriod(date), todayEasternIso(date), date);
}
