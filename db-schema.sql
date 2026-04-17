create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists users_name_lower_unique_idx
  on public.users (lower(name));

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text not null,
  room text not null,
  date date not null,
  start_min integer not null,
  end_min integer not null,
  created_at timestamptz not null default now(),
  constraint bookings_room_check check (
    room in ('кабинет большой', 'песочница', 'кабинет математики')
  ),
  constraint bookings_time_check check (
    start_min >= 540 and end_min <= 1320 and end_min > start_min
  )
);

create index if not exists bookings_room_date_idx
  on public.bookings (room, date, start_min);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_overlap_excl'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap_excl
      exclude using gist (
        room with =,
        date with =,
        int4range(start_min, end_min, '[)') with &&
      );
  end if;
end $$;
