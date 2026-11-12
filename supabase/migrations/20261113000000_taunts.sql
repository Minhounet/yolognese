-- Yolognese, round 15 (user): the taunt duel.
-- A player taunts the player whose sauce it is after with one of the app's 8
-- insults (a number); the taunted player has 5 s to answer with a comeback (a
-- number too). The server alone settles the duel: the insult's own comeback
-- (the same number) wins it for the taunted player, anything else, or nothing
-- before the deadline, for the taunter. It then draws the penalty the loser
-- suffers and tells the room. For a 🔍 it draws a peg of the sauce the winner
-- is after, and answers it to the winner only (never broadcast).
-- One taunt every 15 s per player; a player in an open duel cannot be taunted
-- nor taunt.

alter table public.seats add column last_taunt_at timestamptz;

create table public.taunts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  taunter uuid not null,
  target uuid not null,
  insult int not null check (insult between 0 and 7),
  -- 5 s to answer, and a second for the network
  deadline timestamptz not null,
  comeback int,
  winner uuid,
  penalty text check (penalty in ('peg', 'life', 'scramble', 'flip')),
  peg_index int,
  peg_color text,
  created_at timestamptz not null default now()
);
create index taunts_by_match on public.taunts (match_id);
alter table public.taunts enable row level security;
-- no policy: phones only learn a duel through the functions below

-- What a player is told of a settled duel: the peg only to the winner of a 🔍.
create function public.yolo_duel_outcome(p_taunt public.taunts, p_caller uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p_taunt.id, 'taunter', p_taunt.taunter, 'target', p_taunt.target,
                            'winner', p_taunt.winner, 'penalty', p_taunt.penalty)
    || case when p_taunt.penalty = 'peg' and p_taunt.winner = p_caller
            then jsonb_build_object('peg', jsonb_build_object('index', p_taunt.peg_index, 'color', p_taunt.peg_color))
            else '{}'::jsonb end;
$$;

-- Settles a duel (the row is locked by the caller): the winner, the penalty, the peg for a 🔍; tells the room.
create function public.yolo_settle_taunt(p_taunt uuid, p_comeback int) returns public.taunts
language plpgsql security definer set search_path = '' as $$
declare
  v_taunt public.taunts;
  v_winner uuid;
  v_penalty text := (array['peg', 'life', 'scramble', 'flip'])[1 + floor(random() * 4)::int];
  v_index int := floor(random() * 4)::int;
  v_color text;
begin
  select * into v_taunt from public.taunts where id = p_taunt;
  v_winner := case when p_comeback = v_taunt.insult then v_taunt.target else v_taunt.taunter end;
  if v_penalty = 'peg' then
    select secret[v_index + 1] into v_color from public.sauces
     where match_id = v_taunt.match_id and player = public.yolo_target(v_taunt.match_id, v_winner);
  end if;
  update public.taunts
     set comeback = p_comeback, winner = v_winner, penalty = v_penalty,
         peg_index = case when v_penalty = 'peg' then v_index end, peg_color = v_color
   where id = p_taunt
  returning * into v_taunt;
  perform public.yolo_broadcast((select code from public.matches where id = v_taunt.match_id),
    jsonb_build_object('v', 1, 't', 'steal.duel', 'id', v_taunt.id, 'by', v_taunt.taunter, 'on', v_taunt.target,
                       'winner', v_taunt.winner, 'penalty', v_taunt.penalty));
  return v_taunt;
end;
$$;

create function public.yolo_taunt(p_match uuid, p_insult int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_last timestamptz;
  v_target uuid;
  v_id uuid;
begin
  perform public.yolo_require_seat(p_match);
  if p_insult is null or p_insult not between 0 and 7 then raise exception 'not an insult' using errcode = '22023'; end if;
  perform 1 from public.matches where id = p_match for update;
  if clock_timestamp() >= (select ends_at from public.matches where id = p_match) then
    raise exception 'match over' using errcode = 'P0001';
  end if;
  select last_taunt_at into v_last from public.seats where match_id = p_match and player = v_me;
  if v_last is not null and clock_timestamp() - v_last < interval '15 seconds' then
    raise exception 'too fast' using errcode = 'P0001';
  end if;
  v_target := public.yolo_target(p_match, v_me);
  if exists (select 1 from public.taunts
              where match_id = p_match and winner is null and deadline > clock_timestamp()
                and (taunter in (v_me, v_target) or target in (v_me, v_target))) then
    raise exception 'a duel is open' using errcode = 'P0001';
  end if;
  update public.seats set last_taunt_at = clock_timestamp() where match_id = p_match and player = v_me;
  insert into public.taunts (match_id, taunter, target, insult, deadline)
  values (p_match, v_me, v_target, p_insult, clock_timestamp() + interval '6 seconds')
  returning id into v_id;
  perform public.yolo_broadcast((select code from public.matches where id = p_match),
    jsonb_build_object('v', 1, 't', 'steal.taunt', 'id', v_id, 'by', v_me, 'on', v_target, 'insult', p_insult));
  return v_id;
end;
$$;

-- The taunted player's comeback; late, the duel is settled as unanswered. Answers the verdict.
create function public.yolo_retort(p_taunt uuid, p_comeback int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_taunt public.taunts;
begin
  select * into v_taunt from public.taunts where id = p_taunt for update;
  if v_taunt.id is null or v_taunt.target is distinct from auth.uid() then
    raise exception 'not your duel' using errcode = '42501';
  end if;
  if v_taunt.winner is null then
    v_taunt := public.yolo_settle_taunt(p_taunt, case when clock_timestamp() < v_taunt.deadline then p_comeback end);
  end if;
  return public.yolo_duel_outcome(v_taunt, auth.uid());
end;
$$;

-- Either side asks for the verdict: null while the taunted player may still answer; settled once the time is up.
create function public.yolo_taunt_result(p_taunt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_taunt public.taunts;
begin
  select * into v_taunt from public.taunts where id = p_taunt for update;
  if v_taunt.id is null or auth.uid() is null or auth.uid() not in (v_taunt.taunter, v_taunt.target) then
    raise exception 'not your duel' using errcode = '42501';
  end if;
  if v_taunt.winner is null then
    if clock_timestamp() < v_taunt.deadline then return null; end if;
    v_taunt := public.yolo_settle_taunt(p_taunt, null);
  end if;
  return public.yolo_duel_outcome(v_taunt, auth.uid());
end;
$$;

revoke all on function public.yolo_duel_outcome from public, anon, authenticated;
revoke all on function public.yolo_settle_taunt from public, anon, authenticated;
revoke all on function public.yolo_taunt from public, anon, authenticated;
revoke all on function public.yolo_retort from public, anon, authenticated;
revoke all on function public.yolo_taunt_result from public, anon, authenticated;
grant execute on function public.yolo_taunt to authenticated;
grant execute on function public.yolo_retort to authenticated;
grant execute on function public.yolo_taunt_result to authenticated;
