# Supabase

Este directorio contiene las migraciones, el seed y las Edge Functions del servicio.

## Desarrollo local

La CLI está instalada como dependencia de desarrollo del proyecto. Ejecuta:

```sh
pnpm exec supabase start
pnpm exec supabase db reset
```

Después copia `.env.example` a `.env.local` y usa las credenciales locales que entrega `supabase status`.

## Producción

1. Crea un proyecto en Supabase.
2. Aplica las migraciones con `pnpm exec supabase link --project-ref <PROJECT_REF>` y `pnpm exec supabase db push`.
3. Ejecuta el seed desde el SQL Editor.
4. Crea el primer usuario de IGDA y asígnale `platform_admin` con el UUID real.
5. Despliega las funciones con `pnpm exec supabase functions deploy create-invitation` y `pnpm exec supabase functions deploy accept-invitation`.

Las claves administrativas solo se usan dentro de Edge Functions y nunca deben entrar en las variables `VITE_*`.

## Unicidad de cuentas con Games of Peru

Las cuentas compartidas de estudios/equipos se crean en el proyecto Supabase de Games; las personas y membresías de comunidades permanecen en Eventos. Para reservar los correos antes de crear invitaciones comunitarias, configura estos secretos en Edge Functions de Eventos:

- `GAMES_SUPABASE_URL`: URL del proyecto Games of Peru Showcase.
- `GAMES_ACCOUNT_SYNC_SECRET`: secreto aleatorio compartido únicamente con la función `sync-event-account` del proyecto Games.

`create-invitation` reserva el correo en Games antes de insertar la invitación o crear una identidad de Eventos. Si ya pertenece a una cuenta Games, la invitación se bloquea. Al aceptar, `accept-invitation` completa la ruta para el ID Auth verificado por Eventos. Si la sincronización posterior a la aceptación falla, la membresía no se revierte; el login de Games puede reparar una reserva sin vincular.

No uses claves de service role o secretas de Games en el navegador ni en el proyecto Eventos. La URL es pública; el secreto solo viaja entre funciones de servidor.
