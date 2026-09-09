-- Fix stale player-position anchors after the UUID V2 world cutover.
-- Long-idle accounts may rebase once; ordinary action movement keeps its
-- existing rate envelope. Action state returns that trusted coordinate.

create or replace function public.track_position(_uid uuid, _x numeric, _y numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  previous public.player_positions%rowtype;
  base_x numeric;
  base_y numeric;
  elapsed numeric;
  allowed numeric;
  distance numeric;
begin
  if caller is null or _uid is distinct from caller then return false; end if;
  if _x is null or _y is null or _x < 0 or _y < 0 or _x > 5600 or _y > 3750 then return false; end if;

  select * into previous from public.player_positions where user_id = caller for update;
  if found then
    base_x := previous.x;
    base_y := previous.y;
    elapsed := greatest(0, extract(epoch from (now() - previous.updated_at)));
    distance := sqrt(power(_x - base_x, 2) + power(_y - base_y, 2));

    if elapsed < 0.25 then return distance <= 5; end if;

    if elapsed >= 300 then
      insert into public.player_positions (user_id, x, y, updated_at)
      values (caller, _x, _y, now())
      on conflict (user_id) do update
        set x = excluded.x, y = excluded.y, updated_at = excluded.updated_at;
      return true;
    end if;

    allowed := 400 * least(elapsed, 2) + 80;
  else
    select coalesce((data->>'px')::numeric, 1064), coalesce((data->>'py')::numeric, 2195)
      into base_x, base_y
      from public.player_saves where user_id = caller;
    if not found then return false; end if;
    distance := sqrt(power(_x - base_x, 2) + power(_y - base_y, 2));
    allowed := 80;
  end if;

  if coalesce(distance, sqrt(power(_x - base_x, 2) + power(_y - base_y, 2))) > allowed then
    return false;
  end if;

  insert into public.player_positions (user_id, x, y, updated_at)
  values (caller, _x, _y, now())
  on conflict (user_id) do update
    set x = excluded.x, y = excluded.y, updated_at = excluded.updated_at;
  return true;
end
$$;

create or replace function public.pl_state(_d jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'inv', coalesce(_d->'inv', '[]'::jsonb),
    'gold', coalesce(_d->'gold', '0'::jsonb),
    'skills', coalesce(_d->'skills', '{}'::jsonb),
    'weapon', _d->'weapon',
    'armor', _d->'armor',
    'food', _d->'food',
    'bank', coalesce(_d->'bank', jsonb_build_object('gold', 0, 'items', '[]'::jsonb)),
    'hp', coalesce(_d->'hp', to_jsonb(public.player_max_hp(_d))),
    'px', coalesce((select to_jsonb(x) from public.player_positions where user_id = auth.uid()), _d->'px', '1064'::jsonb),
    'py', coalesce((select to_jsonb(y) from public.player_positions where user_id = auth.uid()), _d->'py', '2195'::jsonb),
    'quest', coalesce(_d->'quest', 'null'::jsonb),
    'completed', coalesce(_d->'completed', '[]'::jsonb),
    'autoEatAt', coalesce(_d->'autoEatAt', '0.5'::jsonb)
  )
$$;
