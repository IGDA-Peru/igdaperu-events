-- Reduce el trabajo de RLS consolidando políticas permisivas que protegen la
-- misma operación. Las expresiones conservan los permisos definidos antes.

-- Comunidades: las cuentas autenticadas pueden ver comunidades aprobadas o
-- las comunidades que administran; los visitantes anónimos solo ven aprobadas.
drop policy if exists communities_public_read on public.communities;
drop policy if exists communities_admin_read on public.communities;

create policy communities_public_read
  on public.communities for select to anon
  using (status = 'approved');

create policy communities_authenticated_read
  on public.communities for select to authenticated
  using (
    status = 'approved'
    or public.is_platform_admin()
    or public.has_community_role(id, array['community_admin']::public.app_role[])
  );

drop policy if exists communities_platform_update on public.communities;
drop policy if exists communities_admin_logo_update on public.communities;

create policy communities_authenticated_update
  on public.communities for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_community_role(id, array['community_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_community_role(id, array['community_admin']::public.app_role[])
  );

-- Contactos: la política ALL ya cubre SELECT, por lo que la política de
-- lectura adicional era redundante.
drop policy if exists community_contacts_admin_read on public.community_contacts;

-- Membresías: una política de lectura y una política de gestión por operación.
drop policy if exists memberships_own_read on public.memberships;
drop policy if exists memberships_admin_read on public.memberships;
drop policy if exists memberships_platform_manage on public.memberships;

create policy memberships_authenticated_read
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_admin()
    or public.has_community_role(community_id, array['community_admin']::public.app_role[])
  );

create policy memberships_platform_insert
  on public.memberships for insert to authenticated
  with check (public.is_platform_admin());

create policy memberships_platform_update
  on public.memberships for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy memberships_platform_delete
  on public.memberships for delete to authenticated
  using (public.is_platform_admin());

-- Eventos: combina lectura de red, gestión de comunidad y administración IGDA
-- en una sola política. El filtro de estado/fecha de eliminación conserva la
-- regla vigente para eventos de borrador y eventos aún no terminados.
drop policy if exists events_network_read on public.events;
drop policy if exists events_manager_read on public.events;
drop policy if exists events_platform_read on public.events;

create policy events_authenticated_read
  on public.events for select to authenticated
  using (
    public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
    or (
      visibility in ('public', 'network')
      and (
        status = 'published'
        or (status = 'archived' and ends_at <= now())
      )
      and exists (
        select 1
        from public.communities c
        where c.id = community_id
          and c.status = 'approved'
      )
    )
    or public.is_platform_admin()
  );

drop policy if exists events_manager_insert on public.events;
drop policy if exists events_platform_insert on public.events;

create policy events_authenticated_insert
  on public.events for insert to authenticated
  with check (
    (
      public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
      and created_by = (select auth.uid())
    )
    or public.is_platform_admin()
  );

drop policy if exists events_manager_update on public.events;
drop policy if exists events_platform_update on public.events;

create policy events_authenticated_update
  on public.events for update to authenticated
  using (
    public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
    or public.is_platform_admin()
  )
  with check (
    public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
    or public.is_platform_admin()
  );

drop policy if exists events_manager_delete on public.events;
drop policy if exists events_platform_delete on public.events;

create policy events_authenticated_delete
  on public.events for delete to authenticated
  using (
    ((status = 'draft' and ends_at is null) or ends_at > now())
    and (
      public.has_community_role(community_id, array['community_admin']::public.app_role[])
      or public.is_platform_admin()
    )
  );

-- Invitaciones: el acceso de lectura de administradores se separa de las
-- operaciones exclusivas de administración de plataforma.
drop policy if exists invitations_admin_read on public.invitations;
drop policy if exists invitations_platform_manage on public.invitations;

create policy invitations_authenticated_read
  on public.invitations for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_community_role(community_id, array['community_admin']::public.app_role[])
  );

create policy invitations_platform_insert
  on public.invitations for insert to authenticated
  with check (public.is_platform_admin());

create policy invitations_platform_update
  on public.invitations for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy invitations_platform_delete
  on public.invitations for delete to authenticated
  using (public.is_platform_admin());

-- Reportes: quien reporta puede leer los suyos; IGDA puede gestionar todos.
drop policy if exists reports_authenticated_insert on public.event_reports;
drop policy if exists reports_own_read on public.event_reports;
drop policy if exists reports_platform_manage on public.event_reports;

create policy reports_authenticated_read
  on public.event_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_platform_admin());

create policy reports_authenticated_insert
  on public.event_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) or public.is_platform_admin());

create policy reports_platform_update
  on public.event_reports for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy reports_platform_delete
  on public.event_reports for delete to authenticated
  using (public.is_platform_admin());
