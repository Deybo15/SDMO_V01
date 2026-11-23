begin;

create schema sdmo_private;
revoke all on schema sdmo_private from public;
grant usage on schema sdmo_private to authenticated, anon, service_role;

create table sdmo_private.bodega_users (
    user_id uuid primary key references auth.users(id) on delete cascade
);

create function sdmo_private.is_bodega()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from sdmo_private.bodega_users where user_id = (select auth.uid())
    );
$$;
revoke all on function sdmo_private.is_bodega() from public;
grant execute on function sdmo_private.is_bodega() to authenticated, anon, service_role;

create function public.sdmo_access_profile()
returns text
language sql
stable
set search_path = ''
as $$
    select case when sdmo_private.is_bodega() then 'bodega' else 'general' end;
$$;
revoke all on function public.sdmo_access_profile() from public, anon;
grant execute on function public.sdmo_access_profile() to authenticated;

create function sdmo_private.enforce_bodega_access()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
    if not sdmo_private.is_bodega() then
        return;
    end if;

    if coalesce(current_setting('request.method', true), '') in ('GET', 'HEAD')
       and coalesce(
           nullif(current_setting('request.headers', true), '')::jsonb ->> 'accept-profile',
           'public'
       ) = 'public'
       and current_setting('request.path', true) in (
           '/rpc/sdmo_access_profile',
           '/articulo_01', '/inventario_actual', '/inventario_con_datos',
           '/entrada_articulo_07', '/dato_entrada_12',
           '/salida_articulo_08', '/dato_salida_13',
           '/vw_resumen_diario_salida', '/vw_solicitudes_sti_estado',
           '/colaboradores_06', '/solicitud_17',
           '/tipo_solicitud_75', '/dependencias_municipales'
       ) then
        return;
    end if;

    raise insufficient_privilege using message = 'Operaci�n fuera del perfil de Bodega';
end;
$$;
revoke all on function sdmo_private.enforce_bodega_access() from public;
grant execute on function sdmo_private.enforce_bodega_access() to authenticated, anon, service_role;

-- PostgREST has one pre-request function. Preserve an existing configuration.
do $$
begin
    if exists (
        select 1 from pg_catalog.pg_db_role_setting
        where setrole = 'authenticator'::regrole
        and exists (
            select 1 from unnest(setconfig) setting
            where setting like 'pgrst.db_pre_request=%'
        )
    ) then
        raise exception 'Ya hay un control API previo. Integre ambos controles antes de instalar.';
    end if;
end;
$$;

alter role authenticator set pgrst.db_pre_request to 'sdmo_private.enforce_bodega_access';

-- Storage is independent of PostgREST. Public buckets still serve public URLs.
create policy bodega_storage_select on storage.objects as restrictive
for select to authenticated
using (not (select sdmo_private.is_bodega()) or bucket_id in ('imagenes-articulos', 'imagenes_articulo'));

create policy bodega_storage_insert on storage.objects as restrictive
for insert to authenticated with check (not (select sdmo_private.is_bodega()));

create policy bodega_storage_update on storage.objects as restrictive
for update to authenticated
using (not (select sdmo_private.is_bodega()))
with check (not (select sdmo_private.is_bodega()));

create policy bodega_storage_delete on storage.objects as restrictive
for delete to authenticated using (not (select sdmo_private.is_bodega()));

-- Cover embedded asset relationships and any later Realtime publication.
do $$
declare
    asset_table text;
begin
    foreach asset_table in array array[
        'activos_50', 'accesorio_activo_51', 'entrada_activo_52',
        'dato_entrada_activo_54', 'salida_activo_55', 'dato_salida_activo_56'
    ] loop
        execute format(
            'create policy bodega_exclude_assets on public.%I as restrictive for all to authenticated
             using (not (select sdmo_private.is_bodega()))
             with check (not (select sdmo_private.is_bodega()))',
            asset_table
        );
    end loop;
end;
$$;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
commit;

