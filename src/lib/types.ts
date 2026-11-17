export type MealPeriod = "breakfast" | "lunch" | "dinner";

export type DayHours = {
  enabled: boolean;
  start: string | null;
  end: string | null;
  is24Hours: boolean;
};

export type DiningHall = {
  id: number;
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingStatus: string;
  mealTypes: string[];
  hours: Record<
    "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
    DayHours
  >;
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
