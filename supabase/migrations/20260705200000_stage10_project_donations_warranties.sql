begin;

create table if not exists public.proyecto_donacion (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  tipo_donacion text not null,
  donante text not null,
  descripcion text,
  valor_estimado numeric not null default 0,
  fecha_recepcion date,
  estado text not null default 'Registrada',
  responsable text,
  observaciones text,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint proyecto_donacion_valor_check check (valor_estimado >= 0)
);

create index if not exists idx_proyecto_donacion_proyecto_id
  on public.proyecto_donacion(proyecto_id);

create index if not exists idx_proyecto_donacion_estado
  on public.proyecto_donacion(estado);

create table if not exists public.contrato_garantia (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  contrato_id uuid references public.contrato_obra(id) on delete set null,
  tipo_garantia text not null,
  entidad_emisora text,
  numero_referencia text,
  monto numeric not null default 0,
  fecha_emision date,
  fecha_vencimiento date,
  estado text not null default 'Vigente',
  observaciones text,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint contrato_garantia_monto_check check (monto >= 0)
);

create index if not exists idx_contrato_garantia_proyecto_id
  on public.contrato_garantia(proyecto_id);

create index if not exists idx_contrato_garantia_contrato_id
  on public.contrato_garantia(contrato_id);

create index if not exists idx_contrato_garantia_estado
  on public.contrato_garantia(estado);

alter table public.proyecto_donacion enable row level security;
alter table public.contrato_garantia enable row level security;

drop policy if exists "authenticated_read_project_donations" on public.proyecto_donacion;
create policy "authenticated_read_project_donations"
on public.proyecto_donacion
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_donations" on public.proyecto_donacion;
create policy "authenticated_insert_project_donations"
on public.proyecto_donacion
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_project_donations" on public.proyecto_donacion;
create policy "authenticated_update_project_donations"
on public.proyecto_donacion
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_project_donations" on public.proyecto_donacion;
create policy "authenticated_delete_project_donations"
on public.proyecto_donacion
for delete
to authenticated
using (true);

drop policy if exists "authenticated_read_contract_warranties" on public.contrato_garantia;
create policy "authenticated_read_contract_warranties"
on public.contrato_garantia
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_contract_warranties" on public.contrato_garantia;
create policy "authenticated_insert_contract_warranties"
on public.contrato_garantia
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_contract_warranties" on public.contrato_garantia;
create policy "authenticated_update_contract_warranties"
on public.contrato_garantia
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_contract_warranties" on public.contrato_garantia;
create policy "authenticated_delete_contract_warranties"
on public.contrato_garantia
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.proyecto_donacion to authenticated;
grant select, insert, update, delete on public.contrato_garantia to authenticated;

commit;
