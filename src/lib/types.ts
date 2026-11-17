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

export type MenuDish = {
  name: string;
  station: string | null;
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
