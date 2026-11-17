import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/social/auth";
import { addFriendByCode, listFriends } from "@/lib/social/friends";
import { requireSocialEnabled, socialError } from "@/lib/social/http";

export async function GET() {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const friends = await listFriends(user.id);
  return NextResponse.json({ friends, friendCode: user.friendCode });
}

export async function POST(request: Request) {
  const disabled = requireSocialEnabled();
  if (disabled) return disabled;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { code?: string };
    const friend = await addFriendByCode(user, body.code ?? "");
    const friends = await listFriends(user.id);
    return NextResponse.json({ friend, friends });
  } catch (error) {
    return socialError(error, "Could not add friend");
  }
}
