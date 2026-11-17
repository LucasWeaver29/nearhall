create table if not exists social_users (
  id bigserial primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists social_sessions (
  token text primary key,
  user_id bigint not null references social_users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists social_sessions_user_id_idx on social_sessions (user_id);

create table if not exists social_friendships (
  user_id bigint not null references social_users (id) on delete cascade,
  friend_id bigint not null references social_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists social_checkins (
  id bigserial primary key,
  user_id bigint not null references social_users (id) on delete cascade,
  hall_slug text not null,
  hall_name text not null,
  meal text not null,
  menu_date text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists social_checkins_user_created_idx
  on social_checkins (user_id, created_at desc);

create index if not exists social_checkins_date_meal_idx
  on social_checkins (menu_date, meal, created_at desc);
