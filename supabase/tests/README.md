# Matriz de pruebas de seguridad y aceptación

Estas comprobaciones se ejecutan contra un proyecto Supabase local o de staging, nunca contra producción con datos reales.

| Área | Comprobación |
| --- | --- |
| RLS | Un lector anónimo solo lee comunidades aprobadas y eventos `published/public`. |
| RLS | Un usuario autenticado puede leer eventos `published/public` y `published/network`, pero no borradores. |
| Aislamiento | Un editor de la comunidad A no puede leer, insertar ni modificar eventos de la comunidad B. |
| Roles | Un `community_admin` gestiona su comunidad; solo `platform_admin` cambia estados de comunidad. |
| Invitaciones | Token válido, vencido, usado otra vez, email distinto y comunidad suspendida. |
| Fechas | `timestamptz` se muestra correctamente en `America/Lima`. |
| Embed | `/embed` nunca devuelve eventos `network`, aun con parámetros manipulados. |
| Frontend | `pnpm lint`, `pnpm test`, `pnpm build`, responsive desktop/móvil y consola sin errores. |
| Secrets | La service role key no aparece en el bundle generado. |
| Deploy | Preview de Pull Request, deploy de `main`, HTTPS y dominio personalizado funcional. |

Para probar RLS, crea usuarios de prueba con membresías en dos comunidades y ejecuta consultas usando sus sesiones, no la service role key.
