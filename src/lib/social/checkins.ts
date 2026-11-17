import { sql } from "@/lib/db";
import type { MealPeriod } from "@/lib/types";

export type Checkin = {
  id: number;
  userId: number;
  displayName: string;
  username: string;
  hallSlug: string;
  hallName: string;
  meal: MealPeriod;
  menuDate: string;
  note: string | null;
  createdAt: string;
  isSelf: boolean;
};

type CheckinRow = {
  id: string | number;
  user_id: string | number;
  display_name: string;
  username: string;
  hall_slug: string;
  hall_name: string;
  meal: string;
  menu_date: string;
  note: string | null;
  created_at: string | Date;
};

function mapCheckin(row: CheckinRow, selfId: number): Checkin {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    displayName: row.display_name,
    username: row.username,
    hallSlug: row.hall_slug,
    hallName: row.hall_name,
    meal: row.meal as MealPeriod,
    menuDate: row.menu_date,
    note: row.note,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    isSelf: Number(row.user_id) === selfId,
  };
}

export async function createCheckin(input: {
  userId: number;
  hallSlug: string;
  hallName: string;
  meal: MealPeriod;
  menuDate: string;
  note?: string;
}): Promise<void> {
  await sql(
    `insert into social_checkins
      (user_id, hall_slug, hall_name, meal, menu_date, note)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.userId,
      input.hallSlug,
      input.hallName,
      input.meal,
      input.menuDate,
      input.note?.trim() || null,
    ],
  );
}

/** Latest check-in per friend (and self) for a meal/date. */
export async function listVisibleCheckins(input: {
  userId: number;
  menuDate: string;
  meal: MealPeriod;
}): Promise<Checkin[]> {
  const rows = await sql<CheckinRow>(
    `with visible as (
       select $1::bigint as user_id
       union
       select friend_id from social_friendships where user_id = $1
     ),
     ranked as (
       select
         c.id,
         c.user_id,
         u.display_name,
         u.username,
         c.hall_slug,
         c.hall_name,
         c.meal,
         c.menu_date,
         c.note,
         c.created_at,
         row_number() over (
           partition by c.user_id
           order by c.created_at desc, c.id desc
         ) as rn
       from social_checkins c
       join social_users u on u.id = c.user_id
       join visible v on v.user_id = c.user_id
       where c.menu_date = $2 and c.meal = $3
     )
     select *
     from ranked
     where rn = 1
     order by created_at desc`,
    [input.userId, input.menuDate, input.meal],
  );
  return rows.map((row) => mapCheckin(row, input.userId));
}
