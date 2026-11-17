import { NextResponse } from "next/server";
import {
  createSession,
  createUser,
  sessionCookieOptions,
} from "@/lib/social/auth";
import { SOCIAL_SESSION_DAYS } from "@/lib/social/config";
import { requireSocialEnabled, socialError } from "@/lib/social/http";

export async function POST(request: Request) {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
    };
    const user = await createUser({
      username: body.username ?? "",
      displayName: body.displayName ?? "",
      password: body.password ?? "",
    });
    const token = await createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(
      sessionCookieOptions(token, SOCIAL_SESSION_DAYS * 24 * 60 * 60),
    );
    return response;
  } catch (error) {
    return socialError(error, "Could not register");
  }
}
