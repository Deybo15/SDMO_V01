begin;

create table if not exists public.historial_estado_proyecto (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  motivo text,
  modificado_por text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_historial_estado_proyecto_proyecto_id
  on public.historial_estado_proyecto(proyecto_id);

create table if not exists public.historial_proyecto (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  entidad text not null default 'proyecto_obra',
  campo_modificado text not null,
  valor_anterior text,
  valor_nuevo text,
  modificado_por text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_historial_proyecto_proyecto_id
  on public.historial_proyecto(proyecto_id);

create index if not exists idx_historial_proyecto_campo
  on public.historial_proyecto(campo_modificado);

alter table public.historial_estado_proyecto enable row level security;
alter table public.historial_proyecto enable row level security;

drop policy if exists "authenticated_read_project_status_history" on public.historial_estado_proyecto;
create policy "authenticated_read_project_status_history"
on public.historial_estado_proyecto
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_status_history" on public.historial_estado_proyecto;
create policy "authenticated_insert_project_status_history"
on public.historial_estado_proyecto
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_read_project_audit_history" on public.historial_proyecto;
create policy "authenticated_read_project_audit_history"
on public.historial_proyecto
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_audit_history" on public.historial_proyecto;
create policy "authenticated_insert_project_audit_history"
on public.historial_proyecto
for insert
to authenticated
with check (true);

grant select, insert on public.historial_estado_proyecto to authenticated;
grant select, insert on public.historial_proyecto to authenticated;

commit;
