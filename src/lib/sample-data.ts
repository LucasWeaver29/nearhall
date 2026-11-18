import { withMealContext } from "@/lib/hours";
import type { DiningHall, HallMenu, MealPeriod, WeekHours } from "@/lib/types";

const breakfastDay = {
  enabled: true,
  start: "08:00:00",
  end: "11:00:00",
  is24Hours: false,
};
const lunchDay = {
  enabled: true,
  start: "11:30:00",
  end: "13:30:00",
  is24Hours: false,
};
const dinnerDay = {
  enabled: true,
  start: "17:00:00",
  end: "19:30:00",
  is24Hours: false,
};
const closedDay = {
  enabled: false,
  start: null,
  end: null,
  is24Hours: false,
};

function week(day: WeekHours["mon"], weekend = day): WeekHours {
  return {
    mon: day,
    tue: day,
    wed: day,
    thu: day,
    fri: day,
    sat: weekend,
    sun: weekend,
  };
}

function hall(
  partial: Omit<
    DiningHall,
    | "openNow"
    | "hoursLabel"
    | "hours"
    | "facilityHours"
    | "mealHours"
    | "operatingStatus"
    | "mealTypes"
  > & { mealTypes?: string[] },
): DiningHall {
  return withMealContext(
    {
      ...partial,
      operatingStatus: "open",
      mealTypes: partial.mealTypes ?? ["breakfast", "lunch", "dinner"],
      facilityHours: week({
        enabled: true,
        start: "07:00:00",
        end: "21:00:00",
        is24Hours: false,
      }),
      mealHours: {
        breakfast: week(breakfastDay, closedDay),
        lunch: week(lunchDay),
        dinner: week(dinnerDay, {
          enabled: true,
          start: "17:00:00",
          end: "19:00:00",
          is24Hours: false,
        }),
      },
    },
    "lunch",
  );
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
  return SAMPLE_HALLS.map((base) => {
    const h = withMealContext(base, meal);
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
    const nameMatch =
      !!q &&
      (h.name.toLowerCase().includes(q) ||
        h.slug.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q));
    const dishMatches = q
      ? dishes.filter((d) => d.name.toLowerCase().includes(q))
      : dishes;
    const matchingDishes = nameMatch ? dishes : dishMatches;
    return {
      hall: h,
      meal,
      dishes,
      matchingDishes,
      distanceMeters: null,
      nameMatch,
    };
  })
    .filter((row) => (q ? row.nameMatch || row.matchingDishes.length > 0 : true))
    .map(({ nameMatch: _nameMatch, ...row }) => row);
}
