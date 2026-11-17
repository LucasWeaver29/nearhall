import type { NutritionInfo } from "@/lib/types";

export function formatNutrient(
  value: number | null | undefined,
  unit: string,
  digits = 0,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded =
    digits === 0 ? Math.round(value) : Number(value.toFixed(digits));
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

export function hasAnyNutrition(info: NutritionInfo | null | undefined): boolean {
  if (!info) return false;
  return Object.values(info).some((v) => v != null && !Number.isNaN(v));
}

export const NUTRITION_FACT_ROWS: Array<{
  key: keyof NutritionInfo;
  label: string;
  unit: string;
  digits?: number;
}> = [
  { key: "calories", label: "Calories", unit: "" },
  { key: "fatG", label: "Total Fat", unit: "g", digits: 1 },
  { key: "saturatedFatG", label: "Saturated Fat", unit: "g", digits: 1 },
  { key: "transFatG", label: "Trans Fat", unit: "g", digits: 1 },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "carbsG", label: "Total Carbohydrate", unit: "g", digits: 1 },
  { key: "fiberG", label: "Dietary Fiber", unit: "g", digits: 1 },
  { key: "sugarG", label: "Total Sugars", unit: "g", digits: 1 },
  { key: "addedSugarG", label: "Added Sugars", unit: "g", digits: 1 },
  { key: "proteinG", label: "Protein", unit: "g", digits: 1 },
  { key: "vitaminDMcg", label: "Vitamin D", unit: "mcg", digits: 1 },
  { key: "calciumMg", label: "Calcium", unit: "mg" },
  { key: "ironMg", label: "Iron", unit: "mg", digits: 1 },
  { key: "potassiumMg", label: "Potassium", unit: "mg" },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg", digits: 1 },
  { key: "vitaminAMcg", label: "Vitamin A", unit: "mcg" },
];
