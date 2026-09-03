insert into public.communities (id, slug, name, description, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'igda-peru',
  'IGDA Perú',
  'Comunidad peruana para conectar, visibilizar y fortalecer a quienes crean videojuegos.',
  'approved'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status;

-- El primer administrador de plataforma debe agregarse después de crear su usuario:
-- insert into public.memberships (user_id, role, status) values ('USER_UUID', 'platform_admin', 'active');
