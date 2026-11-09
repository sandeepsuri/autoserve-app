-- No previous order metadata exists. Establish a deterministic baseline once;
-- subsequent inserts append and updates never include catalogue_order.
begin;

lock table public.services in access exclusive mode;
alter table public.services add column if not exists catalogue_order bigint;

with ranked as (
  select id, row_number() over (order by vendor_id, id) as position
  from public.services
)
update public.services as service
set catalogue_order = ranked.position
from ranked
where service.id = ranked.id and service.catalogue_order is null;

create sequence if not exists public.services_catalogue_order_seq;
alter sequence public.services_catalogue_order_seq owned by public.services.catalogue_order;
select setval('public.services_catalogue_order_seq',
  greatest(coalesce((select max(catalogue_order) from public.services), 0) + 1, 1), false);

alter table public.services
  alter column catalogue_order set default nextval('public.services_catalogue_order_seq'),
  alter column catalogue_order set not null;

-- Existing services INSERT policies continue to govern writes; the sequence
-- supplies order for owner inserts and approval RPC inserts that omit it.
grant usage on sequence public.services_catalogue_order_seq to authenticated, service_role;
create index if not exists services_vendor_catalogue_order_idx
  on public.services (vendor_id, catalogue_order, id);

commit;
