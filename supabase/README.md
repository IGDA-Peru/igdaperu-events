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
