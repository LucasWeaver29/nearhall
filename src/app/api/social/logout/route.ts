import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/social/auth";
import { SOCIAL_SESSION_COOKIE } from "@/lib/social/config";
import { requireSocialEnabled } from "@/lib/social/http";

export async function POST() {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const jar = await cookies();
  await destroySession(jar.get(SOCIAL_SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SOCIAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
