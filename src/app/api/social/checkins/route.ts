import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/social/auth";
import { createCheckin, listVisibleCheckins } from "@/lib/social/checkins";
import { requireSocialEnabled, socialError } from "@/lib/social/http";
import { todayEasternIso } from "@/lib/dates";
import { inferMealPeriod } from "@/lib/hours";
import type { MealPeriod } from "@/lib/types";

const MEALS: MealPeriod[] = ["breakfast", "lunch", "dinner"];

export async function GET(request: Request) {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mealParam = (searchParams.get("meal") as MealPeriod) || inferMealPeriod();
  const meal = MEALS.includes(mealParam) ? mealParam : inferMealPeriod();
  const menuDate = searchParams.get("date") || todayEasternIso();
  const checkins = await listVisibleCheckins({
    userId: user.id,
    menuDate,
    meal,
  });
  return NextResponse.json({ checkins });
}

export async function POST(request: Request) {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      hallSlug?: string;
      hallName?: string;
      meal?: MealPeriod;
      menuDate?: string;
      note?: string;
    };
    const meal = body.meal && MEALS.includes(body.meal) ? body.meal : null;
    if (!body.hallSlug || !body.hallName || !meal) {
      throw new Error("hallSlug, hallName, and meal are required.");
    }
    const menuDate = body.menuDate || todayEasternIso();
    await createCheckin({
      userId: user.id,
      hallSlug: body.hallSlug,
      hallName: body.hallName,
      meal,
      menuDate,
      note: body.note,
    });
    const checkins = await listVisibleCheckins({
      userId: user.id,
      menuDate,
      meal,
    });
    return NextResponse.json({ checkins });
  } catch (error) {
    return socialError(error, "Could not save check-in");
  }
}
