-- Yolognese, "steal the sauce" with the server holding the truth.
-- Phones never read or write the tables: they call the yolo_* functions (RPC),
-- which check who is calling (auth.uid(), anonymous sign-in), apply the rules
-- and broadcast what changed to the room's Realtime channel. Sauces are read
-- only inside these functions: no policy lets a phone select them.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9]{3,6}$'),
  host uuid not null,
  rotation int not null default 0,
  next_switch_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.seats (
  match_id uuid not null references public.matches on delete cascade,
  player uuid not null,
  name text not null check (char_length(name) between 1 and 24),
  seat int not null,
  points int not null default 0 check (points >= 0),
  last_peek_at timestamptz,
  primary key (match_id, player),
  unique (match_id, seat)
);

-- The sauce a player chose in the room, before a match starts.
create table public.lobby_sauces (
  code text not null,
  player uuid not null,
  secret text[] not null,
  updated_at timestamptz not null default now(),
  primary key (code, player)
);

create table public.sauces (
  match_id uuid not null references public.matches on delete cascade,
  player uuid not null,
  secret text[] not null,
  version int not null default 0,
  primary key (match_id, player)
);

create table public.guesses (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches on delete cascade,
  attacker uuid not null,
  target uuid not null,
  sauce_version int not null,
  guess text[] not null,
  exact int not null,
  misplaced int not null,
  created_at timestamptz not null default now()
);
create index guesses_by_attack on public.guesses (match_id, attacker, target, sauce_version);

alter table public.matches enable row level security;
alter table public.seats enable row level security;
alter table public.lobby_sauces enable row level security;
alter table public.sauces enable row level security;
alter table public.guesses enable row level security;

create function public.yolo_is_player(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.seats where match_id = p_match and player = auth.uid());
$$;

-- Read access for reconnecting or history; no write policy anywhere, no policy on sauces.
create policy "players see their match" on public.matches for select to authenticated using (public.yolo_is_player(id));
create policy "players see the seats" on public.seats for select to authenticated using (public.yolo_is_player(match_id));
create policy "players see their own guesses" on public.guesses for select to authenticated using (attacker = auth.uid());

-- ---- rules

create function public.yolo_valid_sauce(p_secret text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(array_length(p_secret, 1), 0) = 4
     and p_secret <@ array['red','yellow','green','blue','purple','orange'];
$$;

create function public.yolo_random_sauce() returns text[]
language sql volatile set search_path = '' as $$
  select array_agg((array['red','yellow','green','blue','purple','orange'])[1 + floor(random() * 6)::int])
  from generate_series(1, 4);
$$;

-- The player the given one attacks: seat + step, step = 1 + rotation mod (n - 1).
create function public.yolo_target(p_match uuid, p_player uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  with m as (select rotation from public.matches where id = p_match),
       n as (select count(*)::int as n from public.seats where match_id = p_match),
       me as (select seat from public.seats where match_id = p_match and player = p_player)
  select s.player from public.seats s, m, n, me
  where s.match_id = p_match
    and s.seat = (me.seat + 1 + m.rotation % greatest(1, n.n - 1)) % n.n;
$$;

create function public.yolo_state(p_match uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'matchId', m.id,
    'rotation', m.rotation,
    'nextSwitchAt', (extract(epoch from m.next_switch_at) * 1000)::bigint,
    'endsAt', (extract(epoch from m.ends_at) * 1000)::bigint,
    'serverNow', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'finished', clock_timestamp() >= m.ends_at,
    'seats', (
      select jsonb_agg(jsonb_build_object('id', s.player, 'name', s.name, 'points', s.points, 'version', sa.version) order by s.seat)
      from public.seats s join public.sauces sa on sa.match_id = s.match_id and sa.player = s.player
      where s.match_id = m.id
    )
  )
  from public.matches m where m.id = p_match;
$$;

create function public.yolo_broadcast(p_code text, p_message jsonb) returns void
language sql security definer set search_path = '' as $$
  select realtime.send(p_message, 'race', 'yolognese:race:' || p_code, false);
$$;

create function public.yolo_say_state(p_match uuid, p_cause jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_state jsonb := public.yolo_state(p_match);
begin
  perform public.yolo_broadcast((select code from public.matches where id = p_match),
    jsonb_build_object('v', 1, 't', 'srv.state', 'state', v_state, 'cause', p_cause));
  return v_state;
end;
$$;

-- Turns the circle for every 45 s past; true when it turned. The caller holds the match row lock.
create function public.yolo_advance(p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_due int;
  v_players int := (select count(*) from public.seats where match_id = p_match);
begin
  select greatest(0, floor(extract(epoch from (least(clock_timestamp(), ends_at) - next_switch_at)) / 45)::int + 1)
    into v_due from public.matches where id = p_match and clock_timestamp() >= next_switch_at;
  if v_due is null or v_due = 0 then return false; end if;
  update public.matches
     set rotation = rotation + case when v_players > 2 then v_due else 0 end,
         next_switch_at = next_switch_at + make_interval(secs => 45 * v_due)
   where id = p_match;
  return v_players > 2;
end;
$$;

create function public.yolo_require_seat(p_match uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.yolo_is_player(p_match) then
    raise exception 'not a player of this match' using errcode = '42501';
  end if;
end;
$$;

-- ---- what phones call

create function public.yolo_set_sauce(p_code text, p_secret text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.yolo_valid_sauce(p_secret) then raise exception 'not a sauce' using errcode = '22023'; end if;
  insert into public.lobby_sauces (code, player, secret) values (upper(p_code), auth.uid(), p_secret)
  on conflict (code, player) do update set secret = excluded.secret, updated_at = now();
end;
$$;

-- p_players: [{id, name}] in seat order, the caller (the host) first.
create function public.yolo_start(p_code text, p_players jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(p_code);
  v_match uuid;
  v_count int := jsonb_array_length(p_players);
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if v_count < 2 or v_count > 6 then raise exception '2 to 6 players' using errcode = '22023'; end if;
  if (p_players -> 0 ->> 'id')::uuid is distinct from auth.uid() then
    raise exception 'only the host starts' using errcode = '42501';
  end if;
  insert into public.matches (code, host, next_switch_at, ends_at)
  values (v_code, auth.uid(), clock_timestamp() + interval '45 seconds', clock_timestamp() + interval '5 minutes')
  returning id into v_match;
  insert into public.seats (match_id, player, name, seat)
  select v_match, (p ->> 'id')::uuid, left(coalesce(nullif(p ->> 'name', ''), 'Player'), 24), (i - 1)::int
  from jsonb_array_elements(p_players) with ordinality as t(p, i);
  insert into public.sauces (match_id, player, secret)
  select v_match, s.player, coalesce(
    (select ls.secret from public.lobby_sauces ls where ls.code = v_code and ls.player = s.player),
    public.yolo_random_sauce())
  from public.seats s where s.match_id = v_match;
  return public.yolo_say_state(v_match, jsonb_build_object('kind', 'start'));
end;
$$;

create function public.yolo_sync(p_match uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.yolo_require_seat(p_match);
  perform 1 from public.matches where id = p_match for update;
  if public.yolo_advance(p_match) then
    return public.yolo_say_state(p_match, jsonb_build_object('kind', 'switch'));
  end if;
  return public.yolo_state(p_match);
end;
$$;

create function public.yolo_guess(p_match uuid, p_guess text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_sauce public.sauces;
  v_exact int;
  v_shared int;
  v_best int;
  v_turned boolean;
begin
  perform public.yolo_require_seat(p_match);
  if not public.yolo_valid_sauce(p_guess) then raise exception 'not a guess' using errcode = '22023'; end if;
  perform 1 from public.matches where id = p_match for update;
  v_turned := public.yolo_advance(p_match);
  if clock_timestamp() >= (select ends_at from public.matches where id = p_match) then
    return jsonb_build_object('rejected', 'match-over', 'state', public.yolo_state(p_match));
  end if;
  v_target := public.yolo_target(p_match, v_me);
  select * into v_sauce from public.sauces where match_id = p_match and player = v_target;
  select count(*) into v_exact from generate_series(1, 4) i where p_guess[i] = v_sauce.secret[i];
  select coalesce(sum(least(
           (select count(*) from unnest(v_sauce.secret) x where x = c),
           (select count(*) from unnest(p_guess) y where y = c))), 0)
    into v_shared from unnest(array['red','yellow','green','blue','purple','orange']) c;
  insert into public.guesses (match_id, attacker, target, sauce_version, guess, exact, misplaced)
  values (p_match, v_me, v_target, v_sauce.version, p_guess, v_exact, v_shared - v_exact);

  if v_exact = 4 then
    update public.seats set points = points + 1 where match_id = p_match and player = v_me;
    update public.sauces set secret = public.yolo_random_sauce(), version = version + 1
     where match_id = p_match and player = v_target;
    update public.matches set rotation = rotation + 1, next_switch_at = clock_timestamp() + interval '45 seconds'
     where id = p_match;
    return jsonb_build_object('exact', v_exact, 'misplaced', v_shared - v_exact, 'target', v_target,
      'state', public.yolo_say_state(p_match, jsonb_build_object('kind', 'stolen', 'by', v_me, 'victim', v_target)));
  end if;

  select max(exact) into v_best from public.guesses
   where match_id = p_match and attacker = v_me and target = v_target and sauce_version = v_sauce.version;
  perform public.yolo_broadcast((select code from public.matches where id = p_match),
    jsonb_build_object('v', 1, 't', 'steal.pressure', 'by', v_me, 'on', v_target, 'best', v_best));
  return jsonb_build_object('exact', v_exact, 'misplaced', v_shared - v_exact, 'target', v_target,
    'state', case when v_turned then public.yolo_say_state(p_match, jsonb_build_object('kind', 'switch'))
                  else public.yolo_state(p_match) end);
end;
$$;

-- One peg of the current target's sauce (a peek the guardian missed, or the x-ray glasses).
-- The guardian lives on the phone; the server only limits the pace: one per second.
create function public.yolo_peek(p_match uuid, p_index int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_last timestamptz;
begin
  perform public.yolo_require_seat(p_match);
  if p_index not between 0 and 3 then raise exception 'no such peg' using errcode = '22023'; end if;
  select last_peek_at into v_last from public.seats where match_id = p_match and player = auth.uid() for update;
  if v_last is not null and clock_timestamp() - v_last < interval '1 second' then
    raise exception 'too fast' using errcode = 'P0001';
  end if;
  update public.seats set last_peek_at = clock_timestamp() where match_id = p_match and player = auth.uid();
  return (select secret[p_index + 1] from public.sauces
           where match_id = p_match and player = public.yolo_target(p_match, auth.uid()));
end;
$$;

-- The phone's life hit 0: a point lost (never below 0).
create function public.yolo_knockout(p_match uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.yolo_require_seat(p_match);
  update public.seats set points = greatest(0, points - 1) where match_id = p_match and player = auth.uid();
  return public.yolo_say_state(p_match, jsonb_build_object('kind', 'knockout', 'by', auth.uid()));
end;
$$;

-- The caller's own sauce: after being robbed, only the robbed player learns the new one.
create function public.yolo_my_sauce(p_match uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  perform public.yolo_require_seat(p_match);
  return (select secret from public.sauces where match_id = p_match and player = auth.uid());
end;
$$;

-- Only signed-in players call the game; helpers are not callable at all.
revoke all on function public.yolo_is_player, public.yolo_valid_sauce, public.yolo_random_sauce, public.yolo_target,
  public.yolo_state, public.yolo_broadcast, public.yolo_say_state, public.yolo_advance, public.yolo_require_seat,
  public.yolo_set_sauce, public.yolo_start, public.yolo_sync, public.yolo_guess, public.yolo_peek, public.yolo_knockout,
  public.yolo_my_sauce from public, anon, authenticated;
grant execute on function public.yolo_set_sauce, public.yolo_start, public.yolo_sync, public.yolo_guess,
  public.yolo_peek, public.yolo_knockout, public.yolo_my_sauce to authenticated;
-- the select policy calls it as the reading user
grant execute on function public.yolo_is_player to authenticated;
