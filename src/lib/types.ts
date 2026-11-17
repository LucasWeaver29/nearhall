export type MealPeriod = "breakfast" | "lunch" | "dinner";

export type DayHours = {
  enabled: boolean;
  start: string | null;
  end: string | null;
  is24Hours: boolean;
};

export type WeekHours = Record<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
  DayHours
>;

export type DiningHall = {
  id: number;
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingStatus: string;
  mealTypes: string[];
  /** Facility-wide fallback hours when a meal schedule is missing. */
  facilityHours: WeekHours;
  /** Meal-period schedules from Nutrislice (Breakfast / Lunch / Dinner). */
  mealHours: Partial<Record<MealPeriod, WeekHours>>;
  /** Resolved schedule for the currently requested meal + day. */
  hours: WeekHours;
  openNow: boolean;
  hoursLabel: string;
};

export type NutritionInfo = {
  calories: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  addedSugarG: number | null;
  proteinG: number | null;
  potassiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  vitaminCMg: number | null;
  vitaminAMcg: number | null;
  vitaminDMcg: number | null;
};

export type MenuDish = {
  id: string;
  name: string;
  station: string | null;
  servingSize: string | null;
  ingredients: string | null;
  dietaryTags: string[];
  hasNutrition: boolean;
  nutrition: NutritionInfo | null;
};

export type HallMenu = {
  hall: DiningHall;
  meal: MealPeriod;
  dishes: MenuDish[];
  distanceMeters: number | null;
  matchingDishes: MenuDish[];
};

export type MenusResponse = {
  date: string;
  meal: MealPeriod;
  query: string;
  source: "live" | "sample";
  halls: HallMenu[];
};
