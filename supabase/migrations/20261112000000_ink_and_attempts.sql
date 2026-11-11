-- Yolognese, round 14 (user): see the other players, and ink them.
-- 1. Each guess is told to the room with what was tried and its score, so the
--    player whose sauce it is sees the attempts live ("steal.pressure" keeps its
--    fields; the new ones are optional for older phones).
-- 2. yolo_ink: a player throws ink at the player whose sauce it is after; the
--    server checks the caller is seated and the pace (one ink every 10 s), and
--    tells the room. The ink item itself appears on the phone: the server
--    cannot see it, the pace keeps it fair.

alter table public.seats add column last_ink_at timestamptz;

create or replace function public.yolo_guess(p_match uuid, p_guess text[]) returns jsonb
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
    jsonb_build_object('v', 1, 't', 'steal.pressure', 'by', v_me, 'on', v_target, 'best', v_best,
      'guess', to_jsonb(p_guess), 'exact', v_exact, 'misplaced', v_shared - v_exact));
  return jsonb_build_object('exact', v_exact, 'misplaced', v_shared - v_exact, 'target', v_target,
    'state', case when v_turned then public.yolo_say_state(p_match, jsonb_build_object('kind', 'switch'))
                  else public.yolo_state(p_match) end);
end;
$$;


create function public.yolo_ink(p_match uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_last timestamptz;
  v_target uuid;
begin
  perform public.yolo_require_seat(p_match);
  if clock_timestamp() >= (select ends_at from public.matches where id = p_match) then
    raise exception 'match over' using errcode = 'P0001';
  end if;
  select last_ink_at into v_last from public.seats where match_id = p_match and player = v_me for update;
  if v_last is not null and clock_timestamp() - v_last < interval '10 seconds' then
    raise exception 'too fast' using errcode = 'P0001';
  end if;
  update public.seats set last_ink_at = clock_timestamp() where match_id = p_match and player = v_me;
  v_target := public.yolo_target(p_match, v_me);
  perform public.yolo_broadcast((select code from public.matches where id = p_match),
    jsonb_build_object('v', 1, 't', 'steal.ink', 'by', v_me, 'on', v_target));
  return v_target;
end;
$$;

revoke all on function public.yolo_ink from public, anon, authenticated;
grant execute on function public.yolo_ink to authenticated;
