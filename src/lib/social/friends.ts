import { sql } from "@/lib/db";
import type { SocialUser } from "@/lib/social/auth";

export type FriendSummary = {
  id: number;
  username: string;
  displayName: string;
  friendCode: string;
};

type FriendRow = {
  id: string | number;
  username: string;
  display_name: string;
  friend_code: string;
};

function mapFriend(row: FriendRow): FriendSummary {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    friendCode: row.friend_code,
  };
}

export async function listFriends(userId: number): Promise<FriendSummary[]> {
  const rows = await sql<FriendRow>(
    `select u.id, u.username, u.display_name, u.friend_code
     from social_friendships f
     join social_users u on u.id = f.friend_id
     where f.user_id = $1
     order by u.display_name asc`,
    [userId],
  );
  return rows.map(mapFriend);
}

export async function addFriendByCode(
  user: SocialUser,
  rawCode: string,
): Promise<FriendSummary> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error("Enter a friend code.");

  const targets = await sql<FriendRow>(
    `select id, username, display_name, friend_code
     from social_users where friend_code = $1 limit 1`,
    [code],
  );
  const target = targets[0];
  if (!target) throw new Error("No user with that friend code.");
  if (Number(target.id) === user.id) {
    throw new Error("You can’t add yourself.");
  }

  await sql(
    `insert into social_friendships (user_id, friend_id)
     values ($1, $2), ($2, $1)
     on conflict do nothing`,
    [user.id, Number(target.id)],
  );

  return mapFriend(target);
}
