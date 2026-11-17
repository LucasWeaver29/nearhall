import { parseIsoDate, todayEasternIso } from "@/lib/dates";
import { withOpenState } from "@/lib/hours";
import { hasAnyNutrition } from "@/lib/nutrition";
import type {
  DayHours,
  DiningHall,
  MealPeriod,
  MenuDish,
  NutritionInfo,
} from "@/lib/types";

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

type NutrisliceNutrition = {
  calories?: number | null;
  g_fat?: number | null;
  g_saturated_fat?: number | null;
  g_trans_fat?: number | null;
  mg_cholesterol?: number | null;
  g_carbs?: number | null;
  g_added_sugar?: number | null;
  g_sugar?: number | null;
  mg_potassium?: number | null;
  mg_sodium?: number | null;
  g_fiber?: number | null;
  g_protein?: number | null;
  mg_iron?: number | null;
  mg_calcium?: number | null;
  mg_vitamin_c?: number | null;
  mcg_vitamin_a?: number | null;
  mcg_vitamin_d?: number | null;
};

type NutrisliceFoodIcon = {
  enabled?: boolean;
  synced_name?: string | null;
  slug?: string | null;
};

type NutrisliceFood = {
  id?: number;
  name?: string | null;
  ingredients?: string | null;
  has_nutrition_info?: boolean;
  rounded_nutrition_info?: NutrisliceNutrition | null;
  serving_size_info?: {
    serving_size_amount?: string | null;
    serving_size_unit?: string | null;
  } | null;
  icons?: { food_icons?: NutrisliceFoodIcon[] } | null;
};

type NutrisliceMenuItem = {
  id?: number;
  is_section_title?: boolean;
  is_station_header?: boolean;
  text?: string | null;
  food?: NutrisliceFood | null;
};

function mapNutrition(raw?: NutrisliceNutrition | null): NutritionInfo | null {
  if (!raw) return null;
  const nutrition: NutritionInfo = {
    calories: raw.calories ?? null,
    fatG: raw.g_fat ?? null,
    saturatedFatG: raw.g_saturated_fat ?? null,
    transFatG: raw.g_trans_fat ?? null,
    cholesterolMg: raw.mg_cholesterol ?? null,
    sodiumMg: raw.mg_sodium ?? null,
    carbsG: raw.g_carbs ?? null,
    fiberG: raw.g_fiber ?? null,
    sugarG: raw.g_sugar ?? null,
    addedSugarG: raw.g_added_sugar ?? null,
    proteinG: raw.g_protein ?? null,
    potassiumMg: raw.mg_potassium ?? null,
    calciumMg: raw.mg_calcium ?? null,
    ironMg: raw.mg_iron ?? null,
    vitaminCMg: raw.mg_vitamin_c ?? null,
    vitaminAMcg: raw.mcg_vitamin_a ?? null,
    vitaminDMcg: raw.mcg_vitamin_d ?? null,
  };
  return hasAnyNutrition(nutrition) ? nutrition : null;
}

function mapDietaryTags(food: NutrisliceFood): string[] {
  const icons = food.icons?.food_icons ?? [];
  const tags: string[] = [];
  for (const icon of icons) {
    if (!icon.enabled) continue;
    const label = (icon.synced_name || icon.slug || "").trim();
    if (!label) continue;
    if (!tags.includes(label)) tags.push(label);
  }
  return tags;
}

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
    const food = item.food;
    const name = food?.name?.trim() || item.text?.trim();
    if (!name) continue;
    const amount = food?.serving_size_info?.serving_size_amount?.trim();
    const unit = food?.serving_size_info?.serving_size_unit?.trim();
    const servingSize = amount ? `${amount}${unit ? ` ${unit}` : ""}` : null;
    const nutrition = mapNutrition(food?.rounded_nutrition_info);
    dishes.push({
      id: String(food?.id ?? item.id ?? `${station ?? "x"}-${name}`),
      name,
      station,
      servingSize,
      ingredients: food?.ingredients?.trim() || null,
      dietaryTags: food ? mapDietaryTags(food) : [],
      hasNutrition: Boolean(food?.has_nutrition_info && nutrition),
      nutrition,
    });
  }
  return dishes;
}
