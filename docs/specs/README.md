# Especificaciones del Sistema — Pulso Taller (`GestMant_TS`)

Índice maestro de especificaciones funcionales, de dominio y técnicas (Spec-Driven Development) que definen completamente la aplicación **Pulso Taller**.

| ID          | Especificación                                                                                                   | Ámbito principal                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `SPEC-0001` | [0001-vision-arquitectura-y-glosario.md](0001-vision-arquitectura-y-glosario.md)                                 | Visión, arquitectura por capas, stack, glosario ubicuo e invariantes                |
| `SPEC-0002` | [0002-autenticacion-roles-y-permisos.md](0002-autenticacion-roles-y-permisos.md)                                 | Autenticación, sesiones, roles, CASL, `secureMutation` y usuarios                   |
| `SPEC-0003` | [0003-notificacion-publica-y-seguimiento.md](0003-notificacion-publica-y-seguimiento.md)                         | `/reportar`, reto humano (Turnstile/PoW), borradores offline y seguimiento público  |
| `SPEC-0004` | [0004-incidencias.md](0004-incidencias.md)                                                                       | Ciclo de incidencias, taller/externo, notas, documentos, partes PDF/ZIP             |
| `SPEC-0005` | [0005-equipos-modelos-y-mantenimiento.md](0005-equipos-modelos-y-mantenimiento.md)                               | Equipos, modelos, preventivos, QR/etiquetas y desplazamientos                       |
| `SPEC-0006` | [0006-inventario-y-movimientos-de-stock.md](0006-inventario-y-movimientos-de-stock.md)                           | Catálogo de repuestos, compatibilidades, CSV y libro mayor `stockMovements`         |
| `SPEC-0007` | [0007-peticiones-de-repuestos.md](0007-peticiones-de-repuestos.md)                                               | Peticiones `PET-XXXX`, aprobación, entregas parciales, devoluciones y archivo       |
| `SPEC-0008` | [0008-compras-y-recepciones.md](0008-compras-y-recepciones.md)                                                   | Solicitudes `PC-XXXX`, órdenes `OC-XXXX`, recepciones con albarán                   |
| `SPEC-0009` | [0009-manuales-y-documentacion.md](0009-manuales-y-documentacion.md)                                             | Manuales PDF y notas técnicas, historial de cambios y autoría                       |
| `SPEC-0010` | [0010-notificaciones-mensajes-correo-y-avisos.md](0010-notificaciones-mensajes-correo-y-avisos.md)               | Avisos in-app, mensajería, correo saliente, resumen semanal y alertas               |
| `SPEC-0011` | [0011-ajustes-del-taller-archivo-y-almacenamiento.md](0011-ajustes-del-taller-archivo-y-almacenamiento.md)       | Catálogos, archivo automático, papelera, limpieza de almacenamiento y reset         |
| `SPEC-0012` | [0012-inteligencia-artificial-deepseek.md](0012-inteligencia-artificial-deepseek.md)                             | Plataforma DeepSeek: visión de etiquetas, chat global con tools, prompts y permisos |
| `SPEC-0013` | [0013-auditoria-y-seguridad-operativa.md](0013-auditoria-y-seguridad-operativa.md)                               | `securityAuditLog`, cifrado AES-GCM, CSP/Nginx, uploads y suite AppSec              |
| `SPEC-0014` | [0014-infraestructura-despliegue-y-operaciones.md](0014-infraestructura-despliegue-y-operaciones.md)             | Docker, Synology NAS, `cloudflared`, scripts `local-dev`/`start.ps1`/NAS y crons    |
| `SPEC-0015` | [0015-interfaz-dashboard-y-componentes-transversales.md](0015-interfaz-dashboard-y-componentes-transversales.md) | Shell del dashboard, búsqueda global, tablas, editor rico, firma y móvil            |
| `SPEC-0016` | [0016-modelo-de-datos-convex.md](0016-modelo-de-datos-convex.md)                                                 | Esquema completo `schema.ts`, índices, contadores y mapa de API Convex              |
| `SPEC-0017` | [0017-buzon-de-correo-zimbra.md](0017-buzon-de-correo-zimbra.md)                                                 | Buzón personal Zimbra de solo lectura: SOAP, cabeceras, caché y visor               |
| `SPEC-0018` | [0018-copias-compartidas-de-correo.md](0018-copias-compartidas-de-correo.md)                                     | Copias de correo compartidas con el expediente: privacidad, visibilidad y retención |
