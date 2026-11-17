import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import {
  SOCIAL_ENABLED,
  SOCIAL_SESSION_COOKIE,
  SOCIAL_SESSION_DAYS,
} from "@/lib/social/config";

export type SocialUser = {
  id: number;
  username: string;
  displayName: string;
  friendCode: string;
};

type UserRow = {
  id: string | number;
  username: string;
  display_name: string;
  friend_code: string;
  password_hash?: string;
};

function mapUser(row: UserRow): SocialUser {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    friendCode: row.friend_code,
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function makeFriendCode(username: string): string {
  const digest = createHash("sha256")
    .update(`${username}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
  return `YALE-${digest}`;
}

export function makeSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<SocialUser> {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim() || username;
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error("Username must be 3–24 chars: letters, numbers, underscore.");
  }
  if (input.password.length < 4) {
    throw new Error("Password must be at least 4 characters for this demo.");
  }

  const friendCode = makeFriendCode(username);
  const passwordHash = hashPassword(input.password);
  try {
    const rows = await sql<UserRow>(
      `insert into social_users (username, display_name, password_hash, friend_code)
       values ($1, $2, $3, $4)
       returning id, username, display_name, friend_code`,
      [username, displayName, passwordHash, friendCode],
    );
    return mapUser(rows[0]!);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("unique")) {
      throw new Error("That username is taken.");
    }
    throw error;
  }
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<SocialUser> {
  const rows = await sql<UserRow>(
    `select id, username, display_name, friend_code, password_hash
     from social_users where username = $1 limit 1`,
    [username.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    throw new Error("Invalid username or password.");
  }
  return mapUser(row);
}

export async function createSession(userId: number): Promise<string> {
  const token = makeSessionToken();
  const expires = new Date(
    Date.now() + SOCIAL_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  await sql(
    `insert into social_sessions (token, user_id, expires_at) values ($1, $2, $3)`,
    [token, userId, expires.toISOString()],
  );
  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await sql(`delete from social_sessions where token = $1`, [token]);
}

export async function getUserBySession(
  token: string | undefined,
): Promise<SocialUser | null> {
  if (!token) return null;
  const rows = await sql<UserRow>(
    `select u.id, u.username, u.display_name, u.friend_code
     from social_sessions s
     join social_users u on u.id = s.user_id
     where s.token = $1 and s.expires_at > now()
     limit 1`,
    [token],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getRequestUser(): Promise<SocialUser | null> {
  if (!SOCIAL_ENABLED) return null;
  const jar = await cookies();
  return getUserBySession(jar.get(SOCIAL_SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(token: string, maxAgeSeconds: number) {
  return {
    name: SOCIAL_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
