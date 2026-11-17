import { NextRequest, NextResponse } from "next/server";
import { estimateWalkMeters, haversineMeters } from "@/lib/geo";
import { inferMealPeriod } from "@/lib/hours";
import { sampleHallMenus } from "@/lib/sample-data";
import {
  fetchDiningHalls,
  fetchHallMenu,
  todayEasternIso,
} from "@/lib/nutrislice";
import type { HallMenu, MealPeriod } from "@/lib/types";

const MEALS: MealPeriod[] = ["breakfast", "lunch", "dinner"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim() ?? "";
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const hasUserLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const mealParam = (searchParams.get("meal") ?? inferMealPeriod()) as MealPeriod;
  const meal = MEALS.includes(mealParam) ? mealParam : inferMealPeriod();
  const openOnly = searchParams.get("open") === "1";
  const campusOnly = searchParams.get("campus") !== "0";

  try {
    const halls = await fetchDiningHalls();
    const filtered = halls.filter((hall) => {
      if (openOnly && !hall.openNow) return false;
      if (campusOnly && hall.slug === "west-campus") return false;
      return true;
    });

    const menus = await Promise.all(
      filtered.map(async (hall) => {
        try {
          const dishes = await fetchHallMenu(hall, meal);
          const matchingDishes = query
            ? dishes.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
            : dishes;
          const distanceMeters = hasUserLocation
            ? estimateWalkMeters(
                haversineMeters(
                  { lat, lng },
                  { lat: hall.latitude, lng: hall.longitude },
                ),
              )
            : null;
          return {
            hall,
            meal,
            dishes,
            matchingDishes,
            distanceMeters,
          } satisfies HallMenu;
        } catch {
          return null;
        }
      }),
    );

    let hallsWithMenus = menus.filter((row): row is HallMenu => row != null);
    if (query) {
      hallsWithMenus = hallsWithMenus.filter((row) => row.matchingDishes.length > 0);
    }

    hallsWithMenus.sort((a, b) => {
      const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
      const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.hall.name.localeCompare(b.hall.name);
    });

    return NextResponse.json({
      date: todayEasternIso(),
      meal,
      query,
      source: "live" as const,
      halls: hallsWithMenus,
    });
  } catch (error) {
    console.error("menus fallback", error);
    const halls = sampleHallMenus(meal, query).map((row) => ({
      ...row,
      distanceMeters: hasUserLocation
        ? estimateWalkMeters(
            haversineMeters(
              { lat, lng },
              { lat: row.hall.latitude, lng: row.hall.longitude },
            ),
          )
        : null,
    }));
    halls.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    return NextResponse.json({
      date: todayEasternIso(),
      meal,
      query,
      source: "sample" as const,
      halls,
      warning: "Live Nutrislice data unavailable; showing sample menus.",
    });
  }
}
