begin;

create table sdmo_private.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade
);
alter table sdmo_private.admin_users enable row level security;
revoke all on sdmo_private.admin_users from public, anon, authenticated, service_role;

insert into sdmo_private.admin_users (user_id)
select id from auth.users where lower(email) = 'dgamboa@msj.go.cr';

create function public.sdmo_can_manage_profiles()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select not sdmo_private.is_bodega() and exists (
        select 1
        from sdmo_private.admin_users a
        join auth.users u on u.id = a.user_id
        where a.user_id = (select auth.uid())
          and exists (
              select 1 from public.colaboradores_06 c
              where c.correo_colaborador = u.email and c.autorizado is true
          )
    );
$$;

create function public.sdmo_list_user_profiles()
returns table (user_id uuid, email text, profile text, is_admin boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.sdmo_can_manage_profiles() then
        raise insufficient_privilege using message = 'Se requiere permiso de Administrador';
    end if;

    return query
    select u.id, u.email::text,
           case when b.user_id is null then 'general' else 'bodega' end,
           a.user_id is not null
    from auth.users u
    left join sdmo_private.bodega_users b on b.user_id = u.id
    left join sdmo_private.admin_users a on a.user_id = u.id
    where exists (
        select 1 from public.colaboradores_06 c
        where c.correo_colaborador = u.email and c.autorizado is true
    )
    order by u.email;
end;
$$;

create function public.sdmo_set_user_profile(target_user_id uuid, new_profile text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.sdmo_can_manage_profiles() then
        raise insufficient_privilege using message = 'Se requiere permiso de Administrador';
    end if;

    if new_profile is null or new_profile not in ('general', 'bodega') then
        raise invalid_parameter_value using message = 'Perfil inv�lido';
    end if;

    perform 1 from auth.users u
    where u.id = target_user_id and exists (
        select 1 from public.colaboradores_06 c
        where c.correo_colaborador = u.email and c.autorizado is true
    ) for update of u;
    if not found then
        raise invalid_parameter_value using message = 'La cuenta debe estar autorizada en SDMO';
    end if;

    if new_profile = 'bodega' then
        if exists (select 1 from sdmo_private.admin_users a where a.user_id = target_user_id) then
            raise invalid_parameter_value using message = 'Las cuentas administradoras requieren perfil General';
        end if;
        insert into sdmo_private.bodega_users (user_id) values (target_user_id)
        on conflict (user_id) do nothing;
    else
        delete from sdmo_private.bodega_users b where b.user_id = target_user_id;
    end if;
end;
$$;

revoke all on function public.sdmo_can_manage_profiles(), public.sdmo_list_user_profiles(),
    public.sdmo_set_user_profile(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.sdmo_can_manage_profiles(), public.sdmo_list_user_profiles(),
    public.sdmo_set_user_profile(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;

