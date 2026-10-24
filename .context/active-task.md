# Tarea Activa (`.context/active-task.md`)

_No hay ninguna tarea en curso._

## Última tarea cerrada

**`<Can>` en peticiones y órdenes de compra:** los botones de la ficha y la tarjeta de la petición y los de recepcionar/anular una orden preguntan al motor CASL con la ficha delante, en lugar de recibir un booleano de permisos. El estado sigue en las máquinas (`requestFlow`, `purchaseFlow`); el traspaso está en [`.context/sessions/2026-10-24-can-peticiones-compras.md`](sessions/2026-10-24-can-peticiones-compras.md).

**Tercer bloque de la migración a `secureMutation`:** roles y permisos, manuales, modelos de equipo y repuestos, con la puerta distinguiendo el motivo de la identidad (sin sesión, cuenta de baja, invitado). El vaciado del taller se queda fuera por ser una action. Después, `identityNotice` devolvió el aviso de cuenta dada de baja a los módulos de los bloques anteriores. El traspaso está en [`.context/sessions/2026-10-23-secure-mutation-roles-manuales-repuestos.md`](sessions/2026-10-23-secure-mutation-roles-manuales-repuestos.md).

Los bloques anteriores — incidencias, peticiones, compras y después usuarios, mensajería y catálogos — están en [`sessions/2026-10-23-migracion-secure-mutation.md`](sessions/2026-10-23-migracion-secure-mutation.md) y [`sessions/2026-10-23-secure-mutation-usuarios-catalogos.md`](sessions/2026-10-23-secure-mutation-usuarios-catalogos.md).

Antes de tocar código, rellenar de nuevo este archivo con la tarea nueva (ver `AGENTS.md`, sección 4).
