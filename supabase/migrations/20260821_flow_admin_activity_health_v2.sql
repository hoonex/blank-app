alter table public.flow_admin_probe_log add column if not exists probe_kind text not null default 'deep';
create index if not exists flow_school_events_created_at_idx on public.flow_school_events (created_at desc);
create index if not exists flow_quest_events_occurred_at_idx on public.flow_quest_events (occurred_at desc);

create or replace function public.flow_admin_overview(p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours integer := greatest(1, least(coalesce(p_hours, 24), 168));
  v_since timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 168)));
  v_total bigint;
  v_unique bigint;
  v_profiles bigint;
  v_top jsonb;
  v_hourly jsonb;
  v_sources jsonb;
  v_probes jsonb;
begin
  with all_events as (
    select created_at as event_at, 'school:' || anonymous_id::text as anonymous_key, 'school.' || event_name as event_name, 'school' as source
    from public.flow_school_events
    where created_at >= v_since
    union all
    select occurred_at as event_at, 'quest:' || anon_id as anonymous_key, 'quest.' || event_name as event_name, 'quest' as source
    from public.flow_quest_events
    where occurred_at >= v_since
  )
  select count(*), count(distinct anonymous_key)
    into v_total, v_unique
  from all_events;

  select count(*) into v_profiles from public.flow_profiles;

  with all_events as (
    select created_at as event_at, 'school.' || event_name as event_name, 'school' as source
    from public.flow_school_events where created_at >= v_since
    union all
    select occurred_at, 'quest.' || event_name, 'quest'
    from public.flow_quest_events where occurred_at >= v_since
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', event_name, 'count', event_count) order by event_count desc, event_name), '[]'::jsonb)
    into v_top
  from (
    select event_name, count(*)::bigint as event_count
    from all_events
    group by event_name
    order by event_count desc, event_name
    limit 12
  ) ranked;

  with all_events as (
    select created_at as event_at from public.flow_school_events where created_at >= v_since
    union all
    select occurred_at from public.flow_quest_events where occurred_at >= v_since
  )
  select coalesce(jsonb_agg(jsonb_build_object('hour', bucket, 'count', event_count) order by bucket), '[]'::jsonb)
    into v_hourly
  from (
    select date_trunc('hour', event_at) as bucket, count(*)::bigint as event_count
    from all_events
    group by 1
    order by 1
  ) hours;

  with all_events as (
    select 'school' as source from public.flow_school_events where created_at >= v_since
    union all
    select 'quest' from public.flow_quest_events where occurred_at >= v_since
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', source, 'count', event_count) order by event_count desc, source), '[]'::jsonb)
    into v_sources
  from (
    select source, count(*)::bigint as event_count
    from all_events group by source
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
      'checkedAt', checked_at,
      'service', service,
      'action', action,
      'kind', probe_kind,
      'status', status,
      'durationMs', duration_ms,
      'ok', ok
    ) order by checked_at desc), '[]'::jsonb)
    into v_probes
  from (
    select checked_at, service, action, probe_kind, status, duration_ms, ok
    from public.flow_admin_probe_log
    order by checked_at desc
    limit 80
  ) recent;

  return jsonb_build_object(
    'generatedAt', now(),
    'windowHours', v_hours,
    'activity', jsonb_build_object(
      'totalEvents', coalesce(v_total, 0),
      'uniqueAnonymous', coalesce(v_unique, 0),
      'registeredProfiles', coalesce(v_profiles, 0),
      'topEvents', coalesce(v_top, '[]'::jsonb),
      'hourly', coalesce(v_hourly, '[]'::jsonb),
      'sources', coalesce(v_sources, '[]'::jsonb)
    ),
    'probes', coalesce(v_probes, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.flow_admin_overview(integer) from public, anon, authenticated;
grant execute on function public.flow_admin_overview(integer) to service_role;
