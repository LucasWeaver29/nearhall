/** How far ahead users can browse menus (today inclusive → +3 more days). */
export const MENU_DAY_HORIZON = 3;

const EASTERN = "America/New_York";

export function todayEasternIso(now = new Date()): string {
  return formatEasternIso(now);
}

export function formatEasternIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string): { year: string; month: string; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

/** Noon Eastern on an ISO date — avoids DST edge cases when shifting days. */
export function easternNoonFromIso(iso: string): Date | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  return new Date(`${parsed.year}-${parsed.month}-${parsed.day}T12:00:00-05:00`);
}

function addEasternDays(fromIso: string, days: number): string | null {
  const base = easternNoonFromIso(fromIso);
  if (!base) return null;
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatEasternIso(next);
}

export type MenuDayOption = {
  iso: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
};

export function menuDayOptions(now = new Date()): MenuDayOption[] {
  const today = todayEasternIso(now);
  const options: MenuDayOption[] = [];

  for (let offset = 0; offset <= MENU_DAY_HORIZON; offset += 1) {
    const iso = offset === 0 ? today : addEasternDays(today, offset);
    if (!iso) continue;

    const noon = easternNoonFromIso(iso)!;
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN,
      weekday: "short",
    }).format(noon);
    const monthDay = new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN,
      month: "short",
      day: "numeric",
    }).format(noon);

    if (offset === 0) {
      options.push({
        iso,
        label: `Today · ${monthDay}`,
        shortLabel: "Today",
        isToday: true,
      });
    } else if (offset === 1) {
      options.push({
        iso,
        label: `Tomorrow · ${monthDay}`,
        shortLabel: "Tomorrow",
        isToday: false,
      });
    } else {
      options.push({
        iso,
        label: `${weekday} · ${monthDay}`,
        shortLabel: weekday,
        isToday: false,
      });
    }
  }

  return options;
}

export function clampMenuDate(iso: string | null | undefined, now = new Date()): string {
  const today = todayEasternIso(now);
  const allowed = new Set(menuDayOptions(now).map((d) => d.iso));
  if (iso && allowed.has(iso)) return iso;
  return today;
}
