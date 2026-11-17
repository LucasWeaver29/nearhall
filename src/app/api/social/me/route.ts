import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/social/auth";
import { listVisibleCheckins } from "@/lib/social/checkins";
import { SOCIAL_ENABLED } from "@/lib/social/config";
import { listFriends } from "@/lib/social/friends";
import { requireSocialEnabled } from "@/lib/social/http";
import { todayEasternIso } from "@/lib/dates";
import { inferMealPeriod } from "@/lib/hours";
import type { MealPeriod } from "@/lib/types";

export async function GET(request: Request) {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({
      enabled: SOCIAL_ENABLED,
      user: null,
      friends: [],
      checkins: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const meal = (searchParams.get("meal") as MealPeriod) || inferMealPeriod();
  const menuDate = searchParams.get("date") || todayEasternIso();
  const [friends, checkins] = await Promise.all([
    listFriends(user.id),
    listVisibleCheckins({ userId: user.id, menuDate, meal }),
  ]);

  return NextResponse.json({
    enabled: SOCIAL_ENABLED,
    user,
    friends,
    checkins,
  });
}
