begin;

create table if not exists public.proyecto_permiso (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  tipo_permiso text not null,
  entidad_emisora text not null,
  estado text not null default 'Pendiente',
  numero_referencia text,
  fecha_solicitud date,
  fecha_aprobacion date,
  fecha_vencimiento date,
  responsable text,
  observaciones text,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_proyecto_permiso_proyecto_id
  on public.proyecto_permiso(proyecto_id);

create index if not exists idx_proyecto_permiso_estado
  on public.proyecto_permiso(estado);

create table if not exists public.proyecto_hito (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  nombre text not null,
  descripcion text,
  fecha_plan date,
  fecha_real date,
  estado text not null default 'Pendiente',
  porcentaje_avance numeric not null default 0,
  responsable text,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint proyecto_hito_porcentaje_check check (porcentaje_avance >= 0 and porcentaje_avance <= 1)
);

create index if not exists idx_proyecto_hito_proyecto_id
  on public.proyecto_hito(proyecto_id);

create index if not exists idx_proyecto_hito_estado
  on public.proyecto_hito(estado);

alter table public.proyecto_permiso enable row level security;
alter table public.proyecto_hito enable row level security;

drop policy if exists "authenticated_read_project_permits" on public.proyecto_permiso;
create policy "authenticated_read_project_permits"
on public.proyecto_permiso
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_permits" on public.proyecto_permiso;
create policy "authenticated_insert_project_permits"
on public.proyecto_permiso
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_project_permits" on public.proyecto_permiso;
create policy "authenticated_update_project_permits"
on public.proyecto_permiso
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_project_permits" on public.proyecto_permiso;
create policy "authenticated_delete_project_permits"
on public.proyecto_permiso
for delete
to authenticated
using (true);

drop policy if exists "authenticated_read_project_milestones" on public.proyecto_hito;
create policy "authenticated_read_project_milestones"
on public.proyecto_hito
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_milestones" on public.proyecto_hito;
create policy "authenticated_insert_project_milestones"
on public.proyecto_hito
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_project_milestones" on public.proyecto_hito;
create policy "authenticated_update_project_milestones"
on public.proyecto_hito
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_project_milestones" on public.proyecto_hito;
create policy "authenticated_delete_project_milestones"
on public.proyecto_hito
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.proyecto_permiso to authenticated;
grant select, insert, update, delete on public.proyecto_hito to authenticated;

commit;
