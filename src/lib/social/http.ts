import { NextResponse } from "next/server";
import { SOCIAL_ENABLED } from "@/lib/social/config";

export function socialDisabledResponse() {
  return NextResponse.json(
    { error: "Social features are disabled.", disabled: true },
    { status: 404 },
  );
}

export function requireSocialEnabled() {
  if (!SOCIAL_ENABLED) return socialDisabledResponse();
  return null;
}

export function socialError(error: unknown, fallback = "Request failed") {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
