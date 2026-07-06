create table if not exists public.proyecto_documento (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto_obra(id) on delete cascade,
  tipo_documento text not null,
  nombre_archivo text not null,
  ruta_storage text not null unique,
  mime_type text,
  tamano_bytes bigint,
  descripcion text,
  subido_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_proyecto_documento_proyecto_id
  on public.proyecto_documento(proyecto_id);

create index if not exists idx_proyecto_documento_tipo
  on public.proyecto_documento(tipo_documento);

alter table public.proyecto_documento enable row level security;

drop policy if exists "authenticated_read_project_documents" on public.proyecto_documento;
create policy "authenticated_read_project_documents"
on public.proyecto_documento
for select
to authenticated
using (true);

drop policy if exists "authenticated_insert_project_documents" on public.proyecto_documento;
create policy "authenticated_insert_project_documents"
on public.proyecto_documento
for insert
to authenticated
with check (true);

drop policy if exists "authenticated_update_project_documents" on public.proyecto_documento;
create policy "authenticated_update_project_documents"
on public.proyecto_documento
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_delete_project_documents" on public.proyecto_documento;
create policy "authenticated_delete_project_documents"
on public.proyecto_documento
for delete
to authenticated
using (true);

grant select, insert, update, delete on public.proyecto_documento to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proyectos-documentos',
  'proyectos-documentos',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated_can_read_sdmo_storage_objects" on storage.objects;
create policy "authenticated_can_read_sdmo_storage_objects"
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'imagenes_articulo',
    'imagenes-articulos',
    'imagenes-ste',
    'imagenes-sti',
    'Img-activos',
    'ordenes-trabajo',
    'proyectos-documentos'
  )
);

drop policy if exists "authenticated_can_upload_sdmo_storage_objects" on storage.objects;
create policy "authenticated_can_upload_sdmo_storage_objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'imagenes_articulo',
    'imagenes-articulos',
    'imagenes-ste',
    'imagenes-sti',
    'Img-activos',
    'ordenes-trabajo',
    'proyectos-documentos'
  )
);

drop policy if exists "authenticated_can_update_sdmo_storage_objects" on storage.objects;
create policy "authenticated_can_update_sdmo_storage_objects"
on storage.objects
for update
to authenticated
using (
  bucket_id in (
    'imagenes_articulo',
    'imagenes-articulos',
    'imagenes-ste',
    'imagenes-sti',
    'Img-activos',
    'ordenes-trabajo',
    'proyectos-documentos'
  )
)
with check (
  bucket_id in (
    'imagenes_articulo',
    'imagenes-articulos',
    'imagenes-ste',
    'imagenes-sti',
    'Img-activos',
    'ordenes-trabajo',
    'proyectos-documentos'
  )
);

drop policy if exists "authenticated_can_delete_sdmo_storage_objects" on storage.objects;
create policy "authenticated_can_delete_sdmo_storage_objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id in (
    'imagenes_articulo',
    'imagenes-articulos',
    'imagenes-ste',
    'imagenes-sti',
    'Img-activos',
    'ordenes-trabajo',
    'proyectos-documentos'
  )
);
