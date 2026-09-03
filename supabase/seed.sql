-- Importación inicial desde el registro de comunidades.
-- Solo se incluyen datos públicos de comunidad; no se importan representantes,
-- correos de contacto, número de miembros ni metadatos de sincronización.

insert into public.communities (id, slug, name, description, website_url, status, approved_at)
values (
  '11111111-1111-1111-1111-111111111111',
  'igda-peru',
  'IGDA Perú',
  $$Capítulo oficial de IGDA en Perú. Un grupo de desarrolladores que buscan impulsar la industria de videojuegos local.$$,
  'https://linktr.ee/igdape',
  'approved',
  now()
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  website_url = excluded.website_url,
  status = 'approved',
  approved_at = coalesce(public.communities.approved_at, excluded.approved_at);

insert into public.communities (slug, name, description, website_url, status)
values
  (
    'volcan-game-lab',
    'Volcán Game Lab',
    $$Grupo de creadores de juegos y entusiastas fomentando la integración y crecimiento de la comunidad en Arequipa$$,
    null,
    'pending'
  ),
  (
    'divgames',
    'DIVGames',
    $$Somos un circulo de estudios conformado por estudiantes de la Escuela Profesional de Ingeniería Informática y de Sistemas de la Universidad Nacional San Antonio Abad del Cusco, nuestro proposito es aprender, diseñar y difundir el desarrollo de videojuegos, impulsando esta industria tanto en la comunidad universitaria cómo en la región.$$,
    'https://divgames02.taplink.site',
    'pending'
  ),
  (
    'game-dev-friends',
    'Game Dev Friends',
    $$Somos Game Dev Friends, una comunidad estudiantil no oficial de la Universidad Privada del Norte (UPN) enfocada en impulsar el desarrollo de videojuegos entre estudiantes. Empezamos construyendo nuestra propia identidad, y en este tiempo hemos trabajado con el apoyo de docentes y estudiantes, hechos exposiciones dentro de la universidad y presentado nuestra propuesta a comunidades de otras universidades.$$,
    'https://linktr.ee/gamedevfriendsupn',
    'pending'
  ),
  (
    'sanda',
    'Sound, Art, Narrative, and Development Association (S.A.N.D.A)',
    $$SANDA es una comunidad y agrupación juvenil latinoamericana dedicada a impulsar y conectar a los creadores emergentes de videojuegos con la industria global.$$,
    'https://beacons.ai/sanda.oficial',
    'pending'
  ),
  (
    'game-devs-utp',
    'Game Devs UTP',
    $$Comunidad estudiantil de la UTP que impulsa el desarrollo de videojuegos y los e-sports, fomentando la creatividad y la colaboración interdisciplinaria.

La comunidad reúne a estudiantes de distintas carreras y sedes con el objetivo de fomentar el desarrollo de videojuegos y los e-sports. Impulsamos la creatividad, el aprendizaje práctico y el trabajo colaborativo a través de talleres y ponencias, generando espacios donde los estudiantes pueden desarrollar habilidades técnicas, creativas y de trabajo en equipo aplicables a entornos reales de desarrollo.$$,
    'https://linktr.ee/GameDevsUTP',
    'pending'
  ),
  (
    'game-devs-pucp',
    'Game Devs PUCP',
    $$Comunidad estudiantil de la PUCP que busca promover el desarrollo de videojuegos en el peru en comunidades universitarias$$,
    'https://linktr.ee/GameDevsPUCP',
    'pending'
  ),
  (
    'game-devs-uni',
    'Game Devs UNI',
    $$Asociación estudiantil centrada en la difusión del desarrollo de videojuegos en la Universidad Nacional de Ingeniería$$,
    'https://linktr.ee/gamedevuni',
    'pending'
  ),
  (
    'takernal-community',
    'Takernal Community',
    $$Una asociación que promueve la accesibilidad y el desarrollo de videojuegos, además de ser la comunidad oficial de Unity en Perú$$,
    'https://www.takernalcommunity.org/',
    'pending'
  ),
  (
    'club-de-software-libre-utec',
    'Club de Software Libre UTEC',
    $$Somos una comunidad estudiantil en la UTEC apasionada por la tecnología y la filosofía FOSS (Free and Open Source Software). Promovemos el desarrollo de videojuegos, aplicaciones web, Linux y hardware mediante talleres prácticos, charlas y proyectos colaborativos. ¡Un espacio abierto para desarrolladores y entusiastas de la tecnología libre!$$,
    'https://beacons.ai/csl.club',
    'pending'
  ),
  (
    'femdevs-peru',
    'FemDevs Perú',
    $$Somos una asociación sin fines de lucro que busca apoyar, promover y motivar a las mujeres de Perú y LATAM que son parte o quieran entrar a la industria de los videojuegos.$$,
    'https://beacons.ai/femdevsperu',
    'pending'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  website_url = excluded.website_url;

-- El primer administrador de plataforma debe agregarse después de crear su usuario:
-- insert into public.memberships (user_id, role, status) values ('USER_UUID', 'platform_admin', 'active');
