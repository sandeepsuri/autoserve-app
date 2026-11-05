-- Issue #21. Apply after restrict_vendor_public_columns.sql,
-- security_fixes_booking_payment_documents.sql and add_guest_booking_flow.sql.
-- Keep booking values shop/mobile; fixed/mobile/hybrid describe vendor locations.
begin;

create or replace function public.vendor_booking_modes(p_vendor_id uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select array_remove(array[
      case when coalesce(v.location_mode, 'hybrid') <> 'mobile'
        and coalesce((a.service_mode_rules->>'shopVisitsEnabled')::boolean, true)
        then 'shop' end,
      case when (v.location_mode in ('mobile', 'hybrid')
          or (v.location_mode is null and coalesce(v.mobile_service_enabled, false)))
        and coalesce((a.service_mode_rules->>'mobileServiceEnabled')::boolean, true)
        then 'mobile' end
    ], null)
    from public.vendors v
    join public.vendor_availability a on a.vendor_id = v.id
    where v.id = p_vendor_id and v.is_active = true
  ), array[]::text[]);
$$;
revoke all on function public.vendor_booking_modes(uuid) from public;
grant execute on function public.vendor_booking_modes(uuid) to anon, authenticated, service_role;

-- Append safe columns, retaining the existing view's column order and grants.
create or replace view public.vendors_public
with (security_invoker = false) as
select id, owner_id, business_type, name, description, address,
  distance_miles, rating, review_count, mobile_service_enabled,
  service_radius_miles, next_available, hero_image, service_categories,
  latitude, longitude, business_hours, stripe_transfers_status,
  stripe_account_updated_at, is_active, location_mode,
  public.vendor_booking_modes(id) as booking_modes
from public.vendors where is_active = true;
grant select on public.vendors_public to anon, authenticated;

-- Both creation RPCs insert here. Lock the availability row before checking so
-- a booking cannot bypass a concurrent change to the vendor's acceptance rules.
create or replace function public.enforce_bookable_booking_type()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.vendor_availability where vendor_id = new.vendor_id for update;
  if new.booking_mode is null or not (new.booking_mode = any(public.vendor_booking_modes(new.vendor_id))) then
    raise exception 'This booking type is no longer available. Please choose an available booking type.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_bookable_booking_type() from public;
drop trigger if exists enforce_bookable_booking_type on public.bookings;
create trigger enforce_bookable_booking_type
before insert or update of vendor_id, booking_mode on public.bookings
for each row execute function public.enforce_bookable_booking_type();

create or replace function public.vendor_bookable_slots(
  p_vendor_id  uuid,
  p_service_id uuid   default null,
  p_mode       text   default null,
  p_from       date   default current_date + 1,
  p_to         date   default current_date + 14
)
returns table (
  slot_date  date,
  slot_time  text,
  remaining  integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_availability  vendor_availability%rowtype;
  v_slot_minutes  integer;
  v_capacity      integer;
  v_smr           jsonb;
  v_sameday_ok    boolean;
  v_lead_hours    integer;

  cur_date        date;
  dow             integer;
  day_rule        jsonb;
  is_bookable     boolean;
  open_mins       integer;
  close_mins      integer;

  t               integer;
  slot_time_str   text;
  slot_end_mins   integer;

  booked_count    integer;
  cap_remaining   integer;
  is_blocked      boolean;
begin
  if not exists (
    select 1 from vendors v
    where v.id = p_vendor_id
      and v.is_active = true
  ) then
    return;
  end if;

  select * into v_availability
  from vendor_availability
  where vendor_id = p_vendor_id;

  if not found then
    return;
  end if;

  v_slot_minutes := v_availability.slot_length_minutes;
  v_capacity     := v_availability.capacity_per_slot;
  v_smr          := v_availability.service_mode_rules;

  v_sameday_ok := coalesce((v_smr->>'sameDayBookingEnabled')::boolean, false);
  v_lead_hours := coalesce((v_smr->>'sameDayLeadHours')::integer, 2);

  -- Null means any currently offered type; invalid and disabled types yield no slots.
  if cardinality(public.vendor_booking_modes(p_vendor_id)) = 0 then return; end if;
  if p_mode is not null and not (p_mode = any(public.vendor_booking_modes(p_vendor_id))) then return; end if;

  cur_date := p_from;
  while cur_date <= p_to loop
    dow := extract(dow from cur_date)::integer;

    day_rule := v_availability.weekly_rules->dow::text;
    is_bookable := coalesce((day_rule->>'bookable')::boolean, false);

    if not is_bookable then
      cur_date := cur_date + 1;
      continue;
    end if;

    if exists (
      select 1 from vendor_blocked_periods bp
      where bp.vendor_id = p_vendor_id
        and bp.all_day = true
        and bp.date = cur_date
    ) then
      cur_date := cur_date + 1;
      continue;
    end if;

    if exists (
      select 1 from vendor_blocked_periods bp
      where bp.vendor_id = p_vendor_id
        and bp.all_day = true
        and bp.recurring = true
        and dow = any(bp.recurring_days)
        and bp.date <= cur_date
    ) then
      cur_date := cur_date + 1;
      continue;
    end if;

    if v_sameday_ok and cur_date = current_date then
      null;
    elsif not v_sameday_ok and cur_date = current_date then
      cur_date := cur_date + 1;
      continue;
    end if;

    open_mins  := (split_part(day_rule->>'openTime',  ':', 1)::integer) * 60
                + (split_part(day_rule->>'openTime',  ':', 2)::integer);
    close_mins := (split_part(day_rule->>'closeTime', ':', 1)::integer) * 60
                + (split_part(day_rule->>'closeTime', ':', 2)::integer);

    t := open_mins;
    while t + v_slot_minutes <= close_mins loop
      slot_time_str  := lpad((t / 60)::text, 2, '0') || ':' || lpad((t % 60)::text, 2, '0');
      slot_end_mins  := t + v_slot_minutes;

      if cur_date = current_date and v_sameday_ok then
        declare
          cutoff_mins integer;
        begin
          cutoff_mins := (extract(hour from now())::integer) * 60
                       + (extract(minute from now())::integer)
                       + (v_lead_hours * 60);
          if t < cutoff_mins then
            t := t + v_slot_minutes;
            continue;
          end if;
        end;
      end if;

      is_blocked := exists (
        select 1 from vendor_blocked_periods bp
        where bp.vendor_id = p_vendor_id
          and bp.all_day = false
          and bp.start_time is not null
          and bp.end_time is not null
          and (
            (bp.date = cur_date)
            or
            (bp.recurring = true and dow = any(bp.recurring_days) and bp.date <= cur_date)
          )
          and t < (
            (split_part(bp.end_time::text,   ':', 1)::integer) * 60 +
            (split_part(bp.end_time::text,   ':', 2)::integer)
          )
          and slot_end_mins > (
            (split_part(bp.start_time::text, ':', 1)::integer) * 60 +
            (split_part(bp.start_time::text, ':', 2)::integer)
          )
      );

      if not is_blocked then
        select count(*) into booked_count
        from bookings b
        where b.vendor_id = p_vendor_id
          and b.appointment_date = cur_date::text
          and b.appointment_time = slot_time_str
          and b.status in ('pending', 'confirmed');

        cap_remaining := v_capacity - coalesce(booked_count, 0);

        if cap_remaining > 0 then
          slot_date  := cur_date;
          slot_time  := slot_time_str;
          remaining  := cap_remaining;
          return next;
        end if;
      end if;

      t := t + v_slot_minutes;
    end loop;

    cur_date := cur_date + 1;
  end loop;
end;
$$;

revoke all on function public.vendor_bookable_slots(uuid, uuid, text, date, date) from public;
grant execute on function public.vendor_bookable_slots(uuid, uuid, text, date, date) to anon;
grant execute on function public.vendor_bookable_slots(uuid, uuid, text, date, date) to authenticated;

commit;
