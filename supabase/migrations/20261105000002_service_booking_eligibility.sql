-- Issue #22. Apply after 20261105000000_bookable_booking_types.sql and
-- 20261105000001_preserve_service_catalogue_order.sql, and before shipping an
-- app build that writes booking_eligibility.
begin;

-- Existing services become 'both': nothing disappears or becomes unbookable,
-- and bookings behave as they did before vendors could narrow a service.
alter table public.services
  add column if not exists booking_eligibility text not null default 'both';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_booking_eligibility_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_booking_eligibility_check
      check (booking_eligibility in ('shop', 'mobile', 'both'));
  end if;
end;
$$;

-- A type no active service can be booked under is not offered. A vendor with no
-- active services keeps its types so the client sees "No services available".
-- vendors_public and vendor_bookable_slots read this, so discovery, availability
-- and booking validation stay in agreement.
create or replace function public.vendor_booking_modes(p_vendor_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select array_remove(array[
      case when coalesce(v.location_mode, 'hybrid') <> 'mobile'
        and coalesce((a.service_mode_rules->>'shopVisitsEnabled')::boolean, true)
        and (catalogue.total = 0 or catalogue.shop_eligible > 0)
        then 'shop' end,
      case when (v.location_mode in ('mobile', 'hybrid')
          or (v.location_mode is null and coalesce(v.mobile_service_enabled, false)))
        and coalesce((a.service_mode_rules->>'mobileServiceEnabled')::boolean, true)
        and (catalogue.total = 0 or catalogue.mobile_eligible > 0)
        then 'mobile' end
    ], null)
    from public.vendors v
    join public.vendor_availability a on a.vendor_id = v.id
    cross join lateral (
      select count(*) as total,
        count(*) filter (where s.booking_eligibility in ('shop', 'both')) as shop_eligible,
        count(*) filter (where s.booking_eligibility in ('mobile', 'both')) as mobile_eligible
      from public.services s
      where s.vendor_id = v.id and s.active
    ) catalogue
    where v.id = p_vendor_id and v.is_active = true
  ), array[]::text[]);
$$;
revoke all on function public.vendor_booking_modes(uuid) from public;
grant execute on function public.vendor_booking_modes(uuid) to anon, authenticated, service_role;

-- Both creation RPCs insert here, so this covers client and guest bookings and
-- any stale draft. Status changes don't fire it, and an update that leaves the
-- type and services alone is skipped, so narrowing a service later can't strand
-- bookings that were valid when created.
-- The name sorts after enforce_bookable_booking_type, so the booking type is
-- checked first.
create or replace function public.enforce_booking_service_eligibility()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_ids text[];
  v_title text;
begin
  if tg_op = 'UPDATE'
     and new.vendor_id is not distinct from old.vendor_id
     and new.booking_mode is not distinct from old.booking_mode
     and new.service_ids is not distinct from old.service_ids then
    return new;
  end if;

  select coalesce(array_agg(value), array[]::text[]) into v_ids
  from jsonb_array_elements_text(coalesce(new.service_ids, '[]'::jsonb)) as ids(value);
  if cardinality(v_ids) = 0 and new.service_id is not null then
    v_ids := array[new.service_id::text];
  end if;

  -- Hold the rows so a concurrent eligibility edit can't slip past this check.
  perform 1 from public.services s
  where s.vendor_id = new.vendor_id and s.id::text = any(v_ids)
  order by s.id
  for share;

  select s.title into v_title
  from public.services s
  where s.vendor_id = new.vendor_id
    and s.id::text = any(v_ids)
    and s.booking_eligibility not in (new.booking_mode, 'both')
  order by s.title
  limit 1;

  if v_title is not null then
    raise exception '% is not available for %. Please review your selected services.',
      v_title, case new.booking_mode when 'mobile' then 'Mobile Service' else 'Shop Visit' end;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_booking_service_eligibility() from public;

drop trigger if exists enforce_booking_service_eligibility on public.bookings;
create trigger enforce_booking_service_eligibility
before insert or update of vendor_id, booking_mode, service_ids on public.bookings
for each row execute function public.enforce_booking_service_eligibility();

commit;
