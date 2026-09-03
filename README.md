# Agenda IGDA Perú

Primera base de la agenda de eventos del ecosistema peruano de videojuegos. La aplicación se prepara como un servicio independiente para desplegarse en `agenda.igda.pe` y recibir a IGDA Perú como su primera comunidad.

## Desarrollo local

Requisitos: Node.js 22+ y pnpm.

```sh
pnpm install
pnpm dev
```

## Validación y build

```sh
pnpm lint
pnpm build
pnpm preview
```

El build genera `dist/`, listo para Cloudflare Pages.

## Despliegue inicial en Cloudflare Pages

```sh
npx wrangler@latest pages project create igdaperu-events --production-branch main
pnpm build
npx wrangler@latest pages deploy dist --project-name igdaperu-events --branch main
```

Luego, en el proyecto de Cloudflare Pages, agregar el dominio personalizado `agenda.igda.pe`. Cloudflare pedirá asociarlo y configurará el CNAME correspondiente.

## MVP previsto

- Agenda pública con filtros.
- Comunidades y organizaciones.
- Registro de eventos mediante invitación.
- Roles por comunidad.
- Moderación central de IGDA Perú.
- Feeds iCal/RSS y embed para `igdaperu.org`.
