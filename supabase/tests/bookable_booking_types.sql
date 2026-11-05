-- Run as postgres in a disposable Supabase database after the issue #21 migration.
-- Exercises the actual RPCs, not source text. All fixtures roll back.
begin;
set local app.bypass_protected_columns = 'true';

do $$
declare
  test_client_id uuid := gen_random_uuid();
  test_vendor_id uuid;
  test_service_id uuid;
  test_vehicle_id uuid := gen_random_uuid();
  config record;
  mode text;
  expected text[];
  actual text[];
  booking public.bookings;
  test_date text := (current_date + 7)::text;
  rules jsonb;
  rejected boolean;
begin
  insert into auth.users(id, email) values (test_client_id, test_client_id::text || '@example.com');
  insert into public.profiles(id, email, full_name, role)
  values (test_client_id, test_client_id::text || '@example.com', 'Booking Type Test', 'client')
  on conflict (id) do update set role = 'client';
  perform set_config('request.jwt.claim.sub', test_client_id::text, true);
  insert into public.vehicles(id, owner_id, make, model, year)
  values (test_vehicle_id, test_client_id, 'Honda', 'Civic', '2024');
  select jsonb_object_agg(d::text, jsonb_build_object('bookable', true, 'openTime', '09:00', 'closeTime', '12:00'))
  into rules from generate_series(0, 6) d;

  for config in select * from (values
    ('fixed', true, true, array['shop']::text[]),
    ('mobile', true, true, array['mobile']::text[]),
    ('hybrid', true, true, array['shop','mobile']::text[]),
    ('hybrid', false, false, array[]::text[])
  ) as configs(location, shop, mobile, modes) loop
    test_vendor_id := gen_random_uuid();
    test_service_id := gen_random_uuid();
    expected := config.modes;
    insert into public.vendors(id, owner_id, business_type, name, description, address, latitude, longitude, location_mode, mobile_service_enabled, is_active)
    values (test_vendor_id, test_client_id, 'shop', 'Booking Type Test', 'Test', '123 Main St', 43, -79, config.location, true, true);
    insert into public.vendor_availability(vendor_id, weekly_rules, slot_length_minutes, capacity_per_slot, service_mode_rules)
    values (test_vendor_id, rules, 30, 20, jsonb_build_object('shopVisitsEnabled', config.shop, 'mobileServiceEnabled', config.mobile));
    insert into public.services(id, vendor_id, title, category, duration_minutes, price, active)
    values (test_service_id, test_vendor_id, 'Oil change', 'oil', 30, 80, true);

    actual := public.vendor_booking_modes(test_vendor_id);
    assert actual = expected, format('Mode contract mismatch: %s', config.location);
    assert (select booking_modes = expected from public.vendors_public where id = test_vendor_id), 'Discovery contract mismatch';
    assert (exists(select 1 from public.vendor_bookable_slots(test_vendor_id, test_service_id, null, test_date::date, test_date::date))) = (cardinality(expected) > 0), 'Any-mode slot mismatch';
    assert not exists(select 1 from public.vendor_bookable_slots(test_vendor_id, test_service_id, 'fixed', test_date::date, test_date::date)), 'Invalid mode returned slots';

    foreach mode in array array['shop','mobile'] loop
      assert (exists(select 1 from public.vendor_bookable_slots(test_vendor_id, test_service_id, mode, test_date::date, test_date::date))) = (mode = any(expected)), 'Mode slot mismatch';
      rejected := false;
      begin
        booking := public.create_booking(test_vendor_id, array[test_service_id], test_vehicle_id, mode,
          (test_date || ' 09:00')::timestamptz, test_date, '09:00', '123 Main St');
        assert booking.booking_mode = mode, 'Client mode was changed';
      exception when raise_exception then rejected := true;
      end;
      assert rejected = (not (mode = any(expected))), format('Client creation mismatch: %s %s', config.location, mode);

      rejected := false;
      begin
        booking := public.create_guest_booking(test_vendor_id, array[test_service_id], mode, test_date, '09:30',
          '123 Main St', null, 'Guest Test', gen_random_uuid()::text || '@example.com',
          ('416' || lpad((floor(random() * 10000000))::text, 7, '0')), 'Honda', 'Civic', '2024', null, null, null, gen_random_uuid());
        assert booking.booking_mode = mode and booking.booking_origin = 'guest', 'Guest mode was changed';
      exception when raise_exception then rejected := true;
      end;
      assert rejected = (not (mode = any(expected))), format('Guest creation mismatch: %s %s', config.location, mode);
    end loop;

    -- Simulate disabling a type after discovery but before submission.
    update public.vendor_availability set service_mode_rules = '{"shopVisitsEnabled":false,"mobileServiceEnabled":false}' where vendor_id = test_vendor_id;
    foreach mode in array expected loop
      assert not exists(select 1 from public.vendor_bookable_slots(test_vendor_id, test_service_id, mode, test_date::date, test_date::date)), 'Stale mode returned slots';
      rejected := false;
      begin
        perform public.create_booking(test_vendor_id, array[test_service_id], test_vehicle_id, mode,
          (test_date || ' 10:00')::timestamptz, test_date, '10:00', '123 Main St');
      exception when raise_exception then rejected := true;
      end;
      assert rejected, 'Stale client booking was accepted';
      rejected := false;
      begin
        perform public.create_guest_booking(test_vendor_id, array[test_service_id], mode, test_date, '10:00',
          '123 Main St', null, 'Guest Test', gen_random_uuid()::text || '@example.com',
          ('647' || lpad((floor(random() * 10000000))::text, 7, '0')), 'Honda', 'Civic', '2024', null, null, null, gen_random_uuid());
      exception when raise_exception then rejected := true;
      end;
      assert rejected, 'Stale guest booking was accepted';
    end loop;
  end loop;
end;
$$;
rollback;
