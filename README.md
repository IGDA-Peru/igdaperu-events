# Eventos IGDA Perú

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
pnpm exec supabase functions deploy sync-communities
pnpm exec supabase functions deploy sync-google-calendar
```

En el dashboard de Supabase:

- Site URL: `https://eventos.igda.pe`.
- Redirect URLs: `https://eventos.igda.pe/auth/callback`, `https://eventos.igda.pe/restablecer`, `http://localhost:5173/auth/callback` y `http://localhost:5173/restablecer`.
- Confirmación de email activada.
- **Registro público desactivado** en Authentication → Settings/General Configuration → **Allow new users to sign up**.
- Email provider activo. Las cuentas se crean únicamente desde invitaciones de administrador; la persona invitada confirma su correo y define su contraseña desde `/invitaciones/:token`.
- SMTP propio configurado antes de enviar invitaciones en producción.
- Secret `APP_URL=https://eventos.igda.pe` para las Edge Functions.

### Sincronización manual de comunidades

La fuente de comunidades es la pestaña privada `TO NOTION` del spreadsheet de registro. La aplicación no lee Google Sheets desde el navegador: la Edge Function `sync-communities` usa una cuenta de servicio de Google con permiso de lector y solo se ejecuta cuando un `platform_admin` pulsa **Actualizar comunidades** en `/app/admin`.

Configura en Google Cloud un proyecto con **Google Sheets API** habilitada, crea una cuenta de servicio y comparte el spreadsheet con el correo `client_email` de esa cuenta como lector. No compartas la hoja públicamente.

Guarda estos valores como secrets de las Edge Functions de Supabase —nunca en `.env.local`, `VITE_*` ni el repositorio—:

```text
GOOGLE_SHEET_ID=1NFQu-Ipeihep-YO1oqWOoq6Ul-6IoWosjaR2SG62qGc
GOOGLE_SHEET_NAME=TO NOTION
GOOGLE_SHEET_RANGE=A1:V1000
GOOGLE_SERVICE_ACCOUNT_JSON=<contenido completo del JSON de la cuenta de servicio>
GOOGLE_CALENDAR_ID=c_39e00d3f9d676c015640ba3dabd1527a8ee3b0a0603e8368c92366ed37f74bd5@group.calendar.google.com
```

Desde PowerShell, después de guardar temporalmente el JSON fuera del repositorio, puedes cargar los secrets así:

```powershell
$googleServiceAccount = Get-Content .\google-service-account.json -Raw
pnpm exec supabase secrets set `
  GOOGLE_SHEET_ID=1NFQu-Ipeihep-YO1oqWOoq6Ul-6IoWosjaR2SG62qGc `
  GOOGLE_SHEET_NAME="TO NOTION" `
  GOOGLE_SHEET_RANGE="A1:V1000" `
  GOOGLE_CALENDAR_ID="c_39e00d3f9d676c015640ba3dabd1527a8ee3b0a0603e8368c92366ed37f74bd5@group.calendar.google.com" `
  "GOOGLE_SERVICE_ACCOUNT_JSON=$googleServiceAccount"
pnpm exec supabase functions deploy sync-communities
pnpm exec supabase functions deploy sync-google-calendar
```

Después borra el archivo temporal de credenciales de tu equipo y verifica que no haya quedado dentro del repositorio. La sincronización:

- importa solo filas con `VALIDACIÓN` activa;
- usa `ID de sincronización` como identidad estable;
- vincula por nombre una sola vez las comunidades creadas previamente, evitando duplicar IGDA Perú;
- crea comunidades nuevas como `approved`;
- actualiza los datos de comunidades existentes sin cambiar `pending`, `approved` o `suspended`;
- guarda representantes, correo y miembros en `community_contacts`, una tabla protegida por RLS;
- omite filas no válidas y muestra el motivo en el panel;
- no elimina comunidades si una fila deja de estar validada.

La columna `VALIDACIÓN` y los estados internos de la agenda cumplen funciones distintas: la primera decide qué filas son elegibles para importar; `communities.status` controla la publicación y moderación dentro de esta aplicación.

Después de crear el primer usuario de IGDA, asígnale `platform_admin` con su UUID; el ejemplo está comentado en `supabase/seed.sql`.

La `service_role` key solo se usa como secret de Edge Functions. Nunca se coloca en variables `VITE_*` ni en el navegador.

### Sincronización manual con Google Calendar

El botón **Sincronizar calendario** de `/app/admin` ejecuta `sync-google-calendar`. Solo publica eventos
`published` y `public` de comunidades `approved`. Cada evento usa un identificador determinista y una
propiedad privada para que las actualizaciones sean idempotentes; los eventos que dejan de cumplir esos
criterios se retiran del calendario oficial. La cuenta de servicio debe tener permiso **Realizar cambios en
los eventos** sobre el calendario y el proyecto de Google debe tener habilitada la Google Calendar API.

## Alcance del MVP

- Eventos públicos, detalle, comunidades y filtros.
- Eventos públicos sin cuentas abiertas; acceso de comunidades mediante invitación, login, confirmación y recuperación de contraseña.
- Roles `reader`, `community_editor`, `community_admin` y `platform_admin`.
- Invitaciones de un solo uso con token almacenado como hash.
- CRUD de eventos, moderación IGDA, reportes y auditoría.
- Embed público en `/embed?community=igda-peru`.
- Feeds iCal/RSS e integración dentro de `igdaperu-site` como siguiente iteración.
