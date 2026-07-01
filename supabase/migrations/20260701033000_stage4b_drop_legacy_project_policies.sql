-- SDMO Etapa 4b: eliminar politicas legadas amplias del modulo de proyectos.
--
-- La verificacion posterior a stage4 encontro politicas "Acceso autenticado a ..."
-- con cmd ALL y qual true. Esas politicas dejan la escritura abierta a cualquier
-- usuario authenticated cuando existe grant de tabla. Esta migracion conserva las
-- politicas nuevas granulares y retira las legadas.

begin;

drop policy if exists "Acceso autenticado a proyecto_obra" on public.proyecto_obra;
drop policy if exists "Acceso autenticado a presupuesto_proyecto" on public.presupuesto_proyecto;
drop policy if exists "Acceso autenticado a contrato_obra" on public.contrato_obra;
drop policy if exists "Acceso autenticado a fase_proyecto" on public.fase_proyecto;
drop policy if exists "Acceso autenticado a seguimiento_proyecto" on public.seguimiento_proyecto;
drop policy if exists "Acceso autenticado a historial_fase_proyecto" on public.historial_fase_proyecto;

commit;

-- Verificacion sugerida:
-- select tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'proyecto_obra',
--     'presupuesto_proyecto',
--     'contrato_obra',
--     'fase_proyecto',
--     'seguimiento_proyecto',
--     'historial_fase_proyecto'
--   )
-- order by tablename, policyname;
