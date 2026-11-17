import { withOpenState } from "@/lib/hours";
import type { DiningHall, HallMenu, MealPeriod } from "@/lib/types";

const openDay = {
  enabled: true,
  start: "07:30:00",
  end: "20:30:00",
  is24Hours: false,
};

function hall(
  partial: Omit<DiningHall, "openNow" | "hoursLabel" | "hours" | "operatingStatus" | "mealTypes"> & {
    mealTypes?: string[];
  },
): DiningHall {
  return withOpenState({
    ...partial,
    operatingStatus: "open",
    mealTypes: partial.mealTypes ?? ["breakfast", "lunch", "dinner"],
    hours: {
      sun: openDay,
      mon: openDay,
      tue: openDay,
      wed: openDay,
      thu: openDay,
      fri: openDay,
      sat: { enabled: true, start: "09:00:00", end: "20:00:00", is24Hours: false },
    },
  });
}

export const SAMPLE_HALLS: DiningHall[] = [
  hall({
    id: 1,
    slug: "berkeley-college",
    name: "Berkeley College",
    address: "205 Elm Street, New Haven, CT",
    latitude: 41.3101779,
    longitude: -72.9282051,
  }),
  hall({
    id: 2,
    slug: "hopper-college",
    name: "Grace Hopper College",
    address: "189 Elm Street, New Haven, CT",
    latitude: 41.3098043,
    longitude: -72.9273852,
  }),
  hall({
    id: 3,
    slug: "silliman-college",
    name: "Silliman College",
    address: "505 College Street, New Haven, CT",
    latitude: 41.3113503,
    longitude: -72.9253003,
  }),
  hall({
    id: 4,
    slug: "schwarzman-center",
    name: "Schwarzman Center",
    address: "168 Grove Street, New Haven, CT",
    latitude: 41.3115564,
    longitude: -72.926006,
  }),
];

const SAMPLE_MENUS: Record<string, Record<MealPeriod, string[]>> = {
  "berkeley-college": {
    breakfast: ["Egg & Cheese Sandwich", "Steel-Cut Oatmeal", "Fresh Fruit"],
    lunch: ["Beef Machaca Brisket Tacos", "Plant-spired Beef Burrito Bowl", "Mozzarella Pizza"],
    dinner: ["Herb Roast Chicken", "Mushroom Risotto", "Seasonal Greens"],
  },
  "hopper-college": {
    breakfast: ["Breakfast Burrito", "Yogurt Parfait", "Hash Browns"],
    lunch: ["Chicken Shawarma", "Falafel Plate", "Caesar Salad"],
    dinner: ["Pasta Primavera", "Grilled Salmon", "Roasted Broccoli"],
  },
  "silliman-college": {
    breakfast: ["Pancakes", "Scrambled Eggs", "Bacon"],
    lunch: ["BBQ Pulled Chicken", "Mac & Cheese", "Cornbread"],
    dinner: ["Steak Tips", "Garlic Mashed Potatoes", "Green Beans"],
  },
  "schwarzman-center": {
    breakfast: ["Avocado Toast", "Cold Brew", "Pastries"],
    lunch: ["Commons Grain Bowl", "Tomato Soup", "Turkey Club"],
    dinner: ["Flatbread Pizza", "Kale Salad", "Soup of the Day"],
  },
};

export function sampleHallMenus(meal: MealPeriod, query: string): HallMenu[] {
  const q = query.trim().toLowerCase();
  return SAMPLE_HALLS.map((h) => {
    const dishes = (SAMPLE_MENUS[h.slug]?.[meal] ?? []).map((name, index) => ({
      id: `${h.slug}-${meal}-${index}`,
      name,
      station: "Sample station",
      servingSize: "1 serving",
      ingredients: "Sample ingredients for demo mode.",
      dietaryTags: index % 2 === 0 ? ["VG"] : ["GF"],
      hasNutrition: true,
      nutrition: {
        calories: 320 + index * 40,
        fatG: 12,
        saturatedFatG: 4,
        transFatG: 0,
        cholesterolMg: 35,
        sodiumMg: 480,
        carbsG: 36,
        fiberG: 4,
        sugarG: 6,
        addedSugarG: 2,
        proteinG: 18,
        potassiumMg: 400,
        calciumMg: 80,
        ironMg: 2,
        vitaminCMg: 8,
        vitaminAMcg: 120,
        vitaminDMcg: 0,
      },
    }));
    const matchingDishes = q
      ? dishes.filter((d) => d.name.toLowerCase().includes(q))
      : dishes;
    return {
      hall: h,
      meal,
      dishes,
      matchingDishes,
      distanceMeters: null,
    };
  }).filter((row) => (q ? row.matchingDishes.length > 0 : true));
}
