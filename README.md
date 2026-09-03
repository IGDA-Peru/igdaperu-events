# Agenda IGDA Perú

Servicio independiente para descubrir y administrar eventos de múltiples comunidades en `eventos.igda.pe`, con IGDA Perú como primera organización.

## Desarrollo local

Requisitos: Node.js 22+ y pnpm.

```sh
pnpm install
pnpm dev
```

Sin variables de Supabase, la aplicación funciona con datos de demostración para revisar el flujo visual. Para conectar un proyecto real, copia `.env.example` como `.env.local` y completa `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_APP_URL`.

## Validación

```sh
pnpm lint
pnpm test
pnpm build
pnpm preview
```

El build genera `dist/`, que es el directorio de salida de Cloudflare Pages.

## Cloudflare Pages: configuración manual

Esta configuración debe hacerse en la cuenta de Cloudflare que administra la zona `igda.pe`:

1. En **Workers & Pages**, crea un proyecto Pages mediante **Connect to Git**.
2. Selecciona GitHub y el repositorio `IGDA-Peru/igdaperu-events`.
3. Usa `main` como rama de producción.
4. Configura Node.js `22`, comando `pnpm build` y directorio de salida `dist`.
5. En **Custom domains**, agrega `eventos.igda.pe` desde el propio proyecto Pages.
6. Agrega las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_APP_URL=https://eventos.igda.pe` en producción.

El dominio se asocia primero al proyecto Pages; no basta con crear un CNAME manual. Los previews de ramas y los despliegues de `main` quedarán vinculados a GitHub.

## Supabase

El contrato de base de datos está en `supabase/migrations/20260903000000_initial_schema.sql` y el seed inicial en `supabase/seed.sql`.

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref <PROJECT_REF>
pnpm exec supabase db push
pnpm exec supabase functions deploy create-invitation
pnpm exec supabase functions deploy accept-invitation
```

En el dashboard de Supabase:

- Site URL: `https://eventos.igda.pe`.
- Redirect URLs: `https://eventos.igda.pe/auth/callback`, `https://eventos.igda.pe/restablecer`, `http://localhost:5173/auth/callback` y `http://localhost:5173/restablecer`.
- Confirmación de email activada.
- SMTP propio configurado antes de abrir el registro al público.
- Secret `APP_URL=https://eventos.igda.pe` para las Edge Functions.

Después de crear el primer usuario de IGDA, asígnale `platform_admin` con su UUID; el ejemplo está comentado en `supabase/seed.sql`.

La `service_role` key solo se usa como secret de Edge Functions. Nunca se coloca en variables `VITE_*` ni en el navegador.

## Alcance del MVP

- Agenda pública, detalle, comunidades y filtros.
- Registro, login, confirmación y recuperación de contraseña.
- Roles `reader`, `community_editor`, `community_admin` y `platform_admin`.
- Invitaciones de un solo uso con token almacenado como hash.
- CRUD de eventos, moderación IGDA, reportes y auditoría.
- Embed público en `/embed?community=igda-peru`.
- Feeds iCal/RSS e integración dentro de `igdaperu-site` como siguiente iteración.
