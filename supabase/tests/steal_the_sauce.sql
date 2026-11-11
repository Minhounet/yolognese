-- Checks of the yolo_* rules, run as three signed-in players inside a transaction
-- that is rolled back. Each check raises an exception when it fails.
begin;
create temp table t_ids as select
  '00000000-0000-0000-0000-00000000000a'::uuid as ann,
  '00000000-0000-0000-0000-00000000000b'::uuid as bob,
  '00000000-0000-0000-0000-00000000000c'::uuid as cid;
grant select on t_ids to authenticated;
create temp table t_out (k text primary key, v jsonb);
grant all on t_out to authenticated;

create function pg_temp.as_player(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; end; $$;

set local role authenticated;

-- sauces chosen in the room
select pg_temp.as_player(bob) from t_ids;
select public.yolo_set_sauce('TEST', array['blue','blue','blue','blue']);
select pg_temp.as_player(cid) from t_ids;
select public.yolo_set_sauce('test', array['green','green','green','green']);
select pg_temp.as_player(ann) from t_ids;
select public.yolo_set_sauce('TEST', array['red','red','red','red']);

-- a sauce must be four known colours
do $$ begin
  perform public.yolo_set_sauce('TEST', array['red','red','red','pink']);
  raise exception 'FAILED: a pink sauce was accepted';
exception when sqlstate '22023' then null; end $$;

-- only the host (first player) starts
select pg_temp.as_player(bob) from t_ids;
do $$ begin
  perform public.yolo_start('TEST', (select jsonb_build_array(jsonb_build_object('id', ann, 'name', 'Ann'), jsonb_build_object('id', bob, 'name', 'Bob')) from t_ids));
  raise exception 'FAILED: Bob started a match listing Ann as host';
exception when sqlstate '42501' then null; end $$;

select pg_temp.as_player(ann) from t_ids;
insert into t_out select 'start', public.yolo_start('TEST', jsonb_build_array(
  jsonb_build_object('id', ann, 'name', 'Ann'), jsonb_build_object('id', bob, 'name', 'Bob'), jsonb_build_object('id', cid, 'name', 'Cid'))) from t_ids;
select pg_temp.check((select jsonb_array_length(v -> 'seats') = 3 and (v ->> 'rotation')::int = 0 from t_out where k = 'start'), 'three seats, rotation 0');

-- nobody reads a sauce from a phone
select pg_temp.check((select count(*) = 0 from public.sauces), 'sauces are not readable');
select pg_temp.check((select count(*) = 1 from public.matches), 'the match is readable by a player');

-- Ann attacks Bob (blue): scored by the server
insert into t_out select 'g1', public.yolo_guess((select (v ->> 'matchId')::uuid from t_out where k = 'start'), array['blue','blue','red','red']);
select pg_temp.check((select (v ->> 'exact')::int = 2 and (v ->> 'misplaced')::int = 0 from t_out where k = 'g1'), 'Ann 2 exact on Bob');
select pg_temp.check((select count(*) = 1 from public.guesses), 'Ann sees her guess');

-- Bob sees only his own guesses, and cannot peek faster than once a second
select pg_temp.as_player(bob) from t_ids;
select pg_temp.check((select count(*) = 0 from public.guesses), 'Bob does not see Ann''s guesses');
select pg_temp.check(public.yolo_peek((select (v ->> 'matchId')::uuid from t_out where k = 'start'), 0) = 'green', 'Bob peeks at Cid''s green');
do $$ begin
  perform public.yolo_peek((select (v ->> 'matchId')::uuid from t_out where k = 'start'), 1);
  raise exception 'FAILED: a second peek within a second';
exception when sqlstate 'P0001' then null; end $$;

-- Ann cracks Bob: +1, Bob gets a new sauce (version 1), the circle turns: Ann now after Cid
select pg_temp.as_player(ann) from t_ids;
insert into t_out select 'g2', public.yolo_guess((select (v ->> 'matchId')::uuid from t_out where k = 'start'), array['blue','blue','blue','blue']);
select pg_temp.check((select (v ->> 'exact')::int = 4 and (v -> 'state' ->> 'rotation')::int = 1 from t_out where k = 'g2'), 'crack turns the circle');
select pg_temp.check((select (v -> 'state' -> 'seats' -> 0 ->> 'points')::int = 1 and (v -> 'state' -> 'seats' -> 1 ->> 'version')::int = 1 from t_out where k = 'g2'), 'Ann +1, Bob new sauce');
insert into t_out select 'g3', public.yolo_guess((select (v ->> 'matchId')::uuid from t_out where k = 'start'), array['green','green','green','green']);
select pg_temp.check((select (v ->> 'exact')::int = 4 from t_out where k = 'g3'), 'after the switch Ann attacks Cid');

-- only Bob learns his new sauce
select pg_temp.as_player(bob) from t_ids;
select pg_temp.check(array_length(public.yolo_my_sauce((select (v ->> 'matchId')::uuid from t_out where k = 'start')), 1) = 4, 'Bob reads his own new sauce');

-- a stranger cannot play
select pg_temp.as_player('00000000-0000-0000-0000-0000000000ff');
do $$ begin
  perform public.yolo_guess((select (v ->> 'matchId')::uuid from t_out where k = 'start'), array['red','red','red','red']);
  raise exception 'FAILED: a stranger guessed';
exception when sqlstate '42501' then null; end $$;
select pg_temp.check((select count(*) = 0 from public.matches), 'a stranger sees no match');

-- knock-out never goes below zero
select pg_temp.as_player(cid) from t_ids;
insert into t_out select 'ko', public.yolo_knockout((select (v ->> 'matchId')::uuid from t_out where k = 'start'));
select pg_temp.check((select (v -> 'seats' -> 2 ->> 'points')::int = 0 from t_out where k = 'ko'), 'knock-out floors at 0');

-- the timer: 45 s later the circle turns once more for everyone (time moved by editing the row as the owner)
reset role;
update public.matches set next_switch_at = clock_timestamp() - interval '1 second';
set local role authenticated;
select pg_temp.as_player(bob) from t_ids;
insert into t_out select 'sync', public.yolo_sync((select (v ->> 'matchId')::uuid from t_out where k = 'start'));
select pg_temp.check((select (v ->> 'rotation')::int = 3 from t_out where k = 'sync'), 'timed switch');

-- anonymous (not signed in) callers are refused by the grants
reset role;
set local role anon;
do $$ begin
  perform public.yolo_sync('00000000-0000-0000-0000-000000000000');
  raise exception 'FAILED: anon called the game';
exception when insufficient_privilege then null; end $$;

reset role;
select 'ALL CHECKS PASSED' as result;
rollback;
