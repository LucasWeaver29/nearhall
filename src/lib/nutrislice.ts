import { parseIsoDate, todayEasternIso } from "@/lib/dates";
import { withOpenState } from "@/lib/hours";
import type { DayHours, DiningHall, MealPeriod, MenuDish } from "@/lib/types";

export { todayEasternIso } from "@/lib/dates";

const API_BASE = "https://yalehospitality.api.nutrislice.com";

type NutrisliceMenuType = {
  id: number;
  name: string;
  slug: string;
};

type NutrisliceSchool = {
  id: number;
  name: string;
  slug: string;
  address: string;
  operating_status: string;
  geolocation?: { latitude?: number; longitude?: number } | null;
  active_menu_types?: NutrisliceMenuType[];
  mon_enabled: boolean;
  mon_start: string | null;
  mon_end: string | null;
  mon_is_24_hours: boolean;
  tue_enabled: boolean;
  tue_start: string | null;
  tue_end: string | null;
  tue_is_24_hours: boolean;
  wed_enabled: boolean;
  wed_start: string | null;
  wed_end: string | null;
  wed_is_24_hours: boolean;
  thu_enabled: boolean;
  thu_start: string | null;
  thu_end: string | null;
  thu_is_24_hours: boolean;
  fri_enabled: boolean;
  fri_start: string | null;
  fri_end: string | null;
  fri_is_24_hours: boolean;
  sat_enabled: boolean;
  sat_start: string | null;
  sat_end: string | null;
  sat_is_24_hours: boolean;
  sun_enabled: boolean;
  sun_start: string | null;
  sun_end: string | null;
  sun_is_24_hours: boolean;
};

type NutrisliceMenuItem = {
  is_section_title?: boolean;
  is_station_header?: boolean;
  text?: string | null;
  food?: { name?: string | null } | null;
};

type NutrisliceWeekMenu = {
  days: Array<{
    date: string;
    menu_items: NutrisliceMenuItem[];
  }>;
};

function dayHours(
  enabled: boolean,
  start: string | null,
  end: string | null,
  is24Hours: boolean,
): DayHours {
  return { enabled, start, end, is24Hours };
}

function mapSchool(school: NutrisliceSchool): DiningHall | null {
  const lat = school.geolocation?.latitude;
  const lng = school.geolocation?.longitude;
  if (lat == null || lng == null) return null;

  const mealTypes = (school.active_menu_types ?? [])
    .map((m) => m.slug)
    .filter((slug) => ["breakfast", "lunch", "dinner"].includes(slug));

  return withOpenState({
    id: school.id,
    slug: school.slug,
    name: school.name,
    address: school.address,
    latitude: lat,
    longitude: lng,
    operatingStatus: school.operating_status,
    mealTypes,
    hours: {
      mon: dayHours(school.mon_enabled, school.mon_start, school.mon_end, school.mon_is_24_hours),
      tue: dayHours(school.tue_enabled, school.tue_start, school.tue_end, school.tue_is_24_hours),
      wed: dayHours(school.wed_enabled, school.wed_start, school.wed_end, school.wed_is_24_hours),
      thu: dayHours(school.thu_enabled, school.thu_start, school.thu_end, school.thu_is_24_hours),
      fri: dayHours(school.fri_enabled, school.fri_start, school.fri_end, school.fri_is_24_hours),
      sat: dayHours(school.sat_enabled, school.sat_start, school.sat_end, school.sat_is_24_hours),
      sun: dayHours(school.sun_enabled, school.sun_start, school.sun_end, school.sun_is_24_hours),
    },
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Nutrislice ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchDiningHalls(): Promise<DiningHall[]> {
  const schools = await fetchJson<NutrisliceSchool[]>("/menu/api/schools/");
  return schools
    .map(mapSchool)
    .filter((h): h is DiningHall => h != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchHallMenu(
  hall: DiningHall,
  meal: MealPeriod,
  dateIso: string = todayEasternIso(),
): Promise<MenuDish[]> {
  if (!hall.mealTypes.includes(meal)) return [];
  const parts = parseIsoDate(dateIso);
  if (!parts) return [];
  const { year, month, day } = parts;
  const week = await fetchJson<NutrisliceWeekMenu>(
    `/menu/api/weeks/school/${hall.slug}/menu-type/${meal}/${year}/${month}/${day}/`,
  );
  const dayMenu = week.days.find((d) => d.date === dateIso);
  if (!dayMenu) return [];

  const dishes: MenuDish[] = [];
  let station: string | null = null;
  for (const item of dayMenu.menu_items ?? []) {
    if (item.is_section_title || item.is_station_header) {
      station = item.text?.trim() || station;
      continue;
    }
    const name = item.food?.name?.trim() || item.text?.trim();
    if (!name) continue;
    dishes.push({ name, station });
  }
  return dishes;
}
