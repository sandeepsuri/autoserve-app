-- Run as postgres in a disposable Supabase database after the issue #22 migration.
-- Exercises the actual RPCs, not source text. All fixtures roll back.
begin;
set local app.bypass_protected_columns = 'true';

do $$
declare
  test_client_id uuid := gen_random_uuid();
  test_vendor_id uuid := gen_random_uuid();
  legacy_id uuid := gen_random_uuid();
  shop_id uuid := gen_random_uuid();
  mobile_id uuid := gen_random_uuid();
  test_vehicle_id uuid := gen_random_uuid();
  other_vendor_id uuid := gen_random_uuid();
  other_shop_id uuid := gen_random_uuid();
  empty_vendor_id uuid := gen_random_uuid();
  test_date text := (current_date + 7)::text;
  rules jsonb;
  booking public.bookings;
  rejected boolean;
  message text;
  phone_suffix integer := 1000000;
  other_owner_id uuid := gen_random_uuid();
  empty_owner_id uuid := gen_random_uuid();
  scenario record;
begin
  -- An owner may have only one active vendor.
  insert into auth.users(id, email)
  select id, id::text || '@example.com' from unnest(array[test_client_id, other_owner_id, empty_owner_id]) as id;
  insert into public.profiles(id, email, full_name, role)
  values (test_client_id, test_client_id::text || '@example.com', 'Eligibility Test', 'client')
  on conflict (id) do update set role = 'client';
  perform set_config('request.jwt.claim.sub', test_client_id::text, true);
  insert into public.vehicles(id, owner_id, make, model, year)
  values (test_vehicle_id, test_client_id, 'Honda', 'Civic', '2024');
  select jsonb_object_agg(d::text, jsonb_build_object('bookable', true, 'openTime', '08:00', 'closeTime', '18:00'))
  into rules from generate_series(0, 6) d;

  insert into public.vendors(id, owner_id, business_type, name, description, address, latitude, longitude, location_mode, mobile_service_enabled, is_active)
  values
    (test_vendor_id, test_client_id, 'shop', 'Hybrid', 'Test', '1 Main St', 43, -79, 'hybrid', true, true),
    (other_vendor_id, other_owner_id, 'shop', 'Shop services only', 'Test', '2 Main St', 43, -79, 'hybrid', true, true),
    (empty_vendor_id, empty_owner_id, 'shop', 'No services', 'Test', '3 Main St', 43, -79, 'hybrid', true, true);
  insert into public.vendor_availability(vendor_id, weekly_rules, slot_length_minutes, capacity_per_slot, service_mode_rules)
  select id, rules, 30, 50, '{"shopVisitsEnabled":true,"mobileServiceEnabled":true}'::jsonb
  from unnest(array[test_vendor_id, other_vendor_id, empty_vendor_id]) as id;

  -- Migration default: a row inserted without the column, as older builds and
  -- the approval RPC do, is explicitly 'both'.
  insert into public.services(id, vendor_id, title, category, duration_minutes, price, active)
  values (legacy_id, test_vendor_id, 'Legacy', 'oil', 30, 80, true);
  assert (select booking_eligibility from public.services where id = legacy_id) = 'both', 'Default is not both';

  insert into public.services(id, vendor_id, title, category, duration_minutes, price, active, booking_eligibility)
  values
    (shop_id, test_vendor_id, 'Alignment', 'repairs', 30, 90, true, 'shop'),
    (mobile_id, test_vendor_id, 'Roadside', 'repairs', 30, 60, true, 'mobile'),
    (other_shop_id, other_vendor_id, 'Rack only', 'repairs', 30, 60, true, 'shop');

  -- The constraint rejects anything else.
  rejected := false;
  begin
    update public.services set booking_eligibility = 'anywhere' where id = legacy_id;
  exception when check_violation then rejected := true;
  end;
  assert rejected, 'Constraint accepted an invalid value';

  -- Client-facing reads expose the value through the public policy path.
  assert (select booking_eligibility from public.services where id = shop_id) = 'shop', 'Eligibility not persisted';

  -- Discovery: a type with no eligible service is not offered; no services keeps both.
  assert public.vendor_booking_modes(test_vendor_id) = array['shop','mobile'], 'Mixed catalogue modes';
  assert public.vendor_booking_modes(other_vendor_id) = array['shop'], 'Shop-only catalogue still offers mobile';
  assert public.vendor_booking_modes(empty_vendor_id) = array['shop','mobile'], 'Empty catalogue lost its types';
  assert (select booking_modes from public.vendors_public where id = other_vendor_id) = array['shop'], 'Discovery disagrees';
  assert not exists(select 1 from public.vendor_bookable_slots(other_vendor_id, other_shop_id, 'mobile', test_date::date, test_date::date)), 'Slots offered for an unavailable type';

  -- Booking contract, for both creation paths.
  for scenario in select * from (values
    ('both as shop',      array[legacy_id], 'shop',   true),
    ('both as mobile',    array[legacy_id], 'mobile', true),
    ('shop as shop',      array[shop_id], 'shop', true),
    ('shop as mobile',    array[shop_id], 'mobile', false),
    ('mobile as mobile',  array[mobile_id], 'mobile', true),
    ('mobile as shop',    array[mobile_id], 'shop', false),
    ('mixed as shop',     array[legacy_id, shop_id, mobile_id], 'shop', false),
    ('mixed as mobile',   array[legacy_id, shop_id, mobile_id], 'mobile', false),
    ('compatible mix',    array[legacy_id, shop_id], 'shop', true)
  ) as s(name, ids, mode, allowed) loop
    rejected := false;
    message := null;
    begin
      booking := public.create_booking(test_vendor_id, scenario.ids, test_vehicle_id, scenario.mode,
        (test_date || ' 09:00')::timestamptz, test_date, '09:00', '1 Main St');
    exception when raise_exception then
      rejected := true;
      get stacked diagnostics message = message_text;
    end;
    assert rejected = (not scenario.allowed), format('Client mismatch: %s (%s)', scenario.name, message);
    if rejected then assert message like '%is not available for%', format('Client message: %s', message); end if;

    rejected := false;
    message := null;
    phone_suffix := phone_suffix + 1;
    begin
      booking := public.create_guest_booking(test_vendor_id, scenario.ids, scenario.mode, test_date, '09:30',
        '1 Main St', null, 'Guest Test', gen_random_uuid()::text || '@example.com',
        '416' || phone_suffix::text, 'Honda', 'Civic', '2024', null, null, null, gen_random_uuid());
    exception when raise_exception then
      rejected := true;
      get stacked diagnostics message = message_text;
    end;
    assert rejected = (not scenario.allowed), format('Guest mismatch: %s (%s)', scenario.name, message);
    if rejected then assert message like '%is not available for%', format('Guest message: %s', message); end if;
  end loop;

  -- Stale draft: the vendor narrows a service after the client selected it.
  update public.services set booking_eligibility = 'shop' where id = legacy_id;
  rejected := false;
  begin
    perform public.create_booking(test_vendor_id, array[legacy_id], test_vehicle_id, 'mobile',
      (test_date || ' 10:00')::timestamptz, test_date, '10:00', '1 Main St');
  exception when raise_exception then rejected := true;
  end;
  assert rejected, 'Stale client draft was accepted';
  rejected := false;
  begin
    perform public.create_guest_booking(test_vendor_id, array[legacy_id], 'mobile', test_date, '10:00',
      '1 Main St', null, 'Guest Test', gen_random_uuid()::text || '@example.com',
      '647' || (phone_suffix + 1)::text, 'Honda', 'Civic', '2024', null, null, null, gen_random_uuid());
  exception when raise_exception then rejected := true;
  end;
  assert rejected, 'Stale guest draft was accepted';
  update public.services set booking_eligibility = 'both' where id = legacy_id;

  -- A booking made while eligible stays manageable after the vendor narrows it.
  booking := public.create_booking(test_vendor_id, array[legacy_id], test_vehicle_id, 'mobile',
    (test_date || ' 11:00')::timestamptz, test_date, '11:00', '1 Main St');
  update public.services set booking_eligibility = 'shop' where id = legacy_id;
  update public.bookings set status = 'confirmed' where id = booking.id;
  assert (select status from public.bookings where id = booking.id) = 'confirmed', 'Status update was blocked';
  update public.bookings set booking_mode = booking_mode, status = 'completed' where id = booking.id;
  assert (select status from public.bookings where id = booking.id) = 'completed', 'No-op mode update was blocked';

  -- But moving it to a type its services can't serve is still rejected.
  update public.services set booking_eligibility = 'mobile' where id = legacy_id;
  rejected := false;
  begin
    update public.bookings set booking_mode = 'shop' where id = booking.id;
  exception when raise_exception then rejected := true;
  end;
  assert rejected, 'Changing to an incompatible type was accepted';
end;
$$;
rollback;
