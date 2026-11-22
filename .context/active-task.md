# Tarea Activa

Sin tarea activa.

`SPEC-0018` aprobada (2026-11-21). F5, F6 y **F7 cerradas**. F7 dejó el backup,
la restauración como metadatos, el reset y la papelera de huérfanas documentados
en los tres manuales; corrigió las descargas, el desbordamiento móvil de la
tarjeta de huérfanas y el cierre de los diálogos; y pasó el hardening completo.
Handovers en `.context/sessions/2026-11-21-correo-purga-por-destino.md` y
`.context/sessions/2026-11-21-correo-f7-backup-reset.md`.

Después se endureció la descarga de esos adjuntos (`src/lib/downloadFile.ts`):
entrega binaria, nombre saneado y revocación diferida, para que WebKit no abra
el `.eml` en la pestaña. Handover en
`.context/sessions/2026-11-21-descargas-correo.md`.

También se acotó la tarjeta de huérfanas en móvil (`min-w-0` en la fila y el
nombre del archivo): ya no ensancha la página. Handover en
`.context/sessions/2026-11-21-huerfanas-desbordamiento-movil.md`.

Los cierres de diálogos y fichas pasaron a 44×44 con «Cerrar» como nombre
accesible, sin mover la cruz. Handover en
`.context/sessions/2026-11-21-cierre-dialogos-44.md`.

Después se revisaron los dos primitivos: un solo comentario en el cierre de la
ficha, el icono declara su `size-4` en vez de heredarlo de un selector `[&_svg]`
y nada cambió de medida. Handover en
`.context/sessions/2026-11-22-limpieza-primitivos-dialogo.md`.

La cabecera de los diálogos reserva 32 px por lado en móvil, para que un título
largo parta antes de la cruz de 44 px y no quede bajo su zona de pulsación; en
escritorio y en las cabeceras con relleno propio no cambia nada. Handover en
`.context/sessions/2026-11-22-cabecera-dialogo-cruz-44.md`.

El visor del buzón también descarga sus adjuntos con `downloadFileFromUrl`: ya
no monta un ancla `download` contra la URL cross-origin de `_storage`, que era
lo que abría el `.eml` en la pestaña. Handover en
`.context/sessions/2026-11-22-descarga-adjuntos-buzon.md`.

La PWA ya no se recarga sola: con `registerType: "prompt"` la compilación nueva
espera y el aviso dice qué build sirve la pestaña, para no depurar una interfaz
vieja. Handover en `.context/sessions/2026-11-22-aviso-version-nueva.md`.

La restauración de copias ya no vacía el taller antes de saber si la copia vale:
recorre la copia entera en seco —cada lote se inserta y se revierte— y solo
después borra e inserta. Una copia que el esquema rechaza a mitad se detiene con
el taller intacto (medido contra el backend de Docker: rechazo en 155 ms, 880
filas antes y después, `CON-ALCO2` en 12). Handover en
`.context/sessions/2026-11-22-f8-piloto-hermes-rollback.md` (§8.3).

La escala con volumen también está medida (§8.5 del mismo handover): con 7 806
filas (8 tandas de `seedMoreDemoData`) exportar tarda 1,0 s y restaurar 15,4 s;
con 3 465 filas, 0,35 s y 4,5 s. El aviso de la pantalla tiene sentido a partir
de ~2,5–3 MB (unas 3 000 filas), no antes. Ya está en la pantalla: el diálogo de
confirmación muestra tamaño y tiempo estimado (`estimateRestoreSeconds`), con
aviso desde 3 000 filas y aviso reforzado desde 6 000, sin tocar la palabra
`RESTAURAR` ni los nombres accesibles. Mientras restaura, el diálogo lo dice
(«Restaurando la copia…»), deshabilita botón y campo, y un pestillo evita lanzar
una segunda restauración desde otra pulsación.

Si la inserción falla a mitad, la restauración ya no deja el taller a medias:
antes de vaciar guarda el estado actual (copias de correo incluidas, sin
proyectar) y lo reescribe al fallar, con el error explicando lo ocurrido. Lo
prueba `tests/rollbackRehearsal.test.ts` inyectando un fallo en la inserción
real (`backupFaults`), y contra Docker la restauración de 880 filas pasa de
~1,51 s a 1,66 s por la lectura extra. Handover §8.3/§8.4.

La foto previa ya no se queda en memoria: se guarda en
`workshopRestoreSnapshots` —en trozos, antes de vaciar— y se recupera aunque la
acción muera. Mientras restaura, la acción late cada cinco segundos; la pasada
(`recoverInterruptedRestore`, cada minuto) o la siguiente restauración solo
actúan si el latido lleva más de treinta segundos parado, así que una foto
antigua que sigue latiendo no se pisa. La foto se sella al escribir el último
trozo: una foto sin sellar se descarta sin tocar el taller.
`tests/rollbackRehearsal.test.ts` simula la muerte del backend
(`backupFaults.simulateCrash`) y comprueba las dos vías. El corte ensayado en
Docker justo después del último lote dejó 3 trozos con `appliedAt`; la pasada
devolvió `recovered: false`, la auditoría quedó con `snapshotApplied: true` y el
taller con la copia. Handover §8.3/§8.4.

**Reserva de mantenimiento (2026-11-22):** restaurar, recuperar y vaciar toman
una fila singleton `workshopMaintenance` con caducidad de 30 s y testigo; las
escrituras del taller pasan por `secureMutation` y se rechazan mientras dura.
`tests/rollbackRehearsal.test.ts` sube a 14 pruebas (solape, bloqueo, caducidad
y liberación). Handover §8.3/§8.4.

**Integridad de la foto (2026-11-22):** la cabecera sella `chunkCount` y
SHA-256; la lectura se acota a 2 000 trozos / 64 MB; una foto sin sellar o
inservible se retira y se audita (`workshop_backup_discard`) en la misma
mutación. `tests/rollbackRehearsal.test.ts` sube a 17 pruebas. Handover
§8.3/§8.4.

**F8 preparada (2026-11-22):** el procedimiento del piloto con buzones reales, la
tabla de validación contra Hermes y el runbook de rollback están en
`.context/sessions/2026-11-22-f8-piloto-hermes-rollback.md`. El ensayo de
restauración se ejecuta con `npx vitest run tests/rollbackRehearsal.test.ts`
(recuentos por tabla comparados contra la copia). Falta lo que no depende del
código: un deployment de banco de pruebas vivo, credenciales de Hermes y los dos
técnicos del piloto.

**Copias protegidas (2026-11-22):** la descarga deja de ser JSON plano. El
archivo se comprime con gzip, se cifra con AES-GCM-256 y se firma con
HMAC-SHA256 usando una frase de paso (PBKDF2, mínimo 10 caracteres) que no se
guarda. La copia interior sube a v2 con manifiesto de recuentos; las copias v1
se siguen leyendo y se migran en memoria. `exportBackup` valida la copia en seco
con el mismo recorrido de la restauración antes de entregarla. La tarjeta pide
la frase al exportar y al abrir un archivo protegido. Handover en
`.context/sessions/2026-11-22-copias-cifradas-v2.md`. No se ha revisado la
interfaz en navegador.

**Progreso y deshacer (2026-11-22):** la foto previa registra fase y avance, y
`getRestoreStatus` alimenta una barra reactiva que sobrevive a la recarga; sin
latido avisa de restauración interrumpida. Tras terminar, la foto se conserva
diez minutos y `undoRestore` devuelve el taller al estado anterior, con traza
`workshop_backup_undo`; otra restauración o un vaciado cierran esa ventana.
Handover en
`.context/sessions/2026-11-22-progreso-deshacer-restauracion.md`. La interfaz
no se ha revisado visualmente.

**Archivos y fotos huérfanas (2026-11-22):** la limpieza de fotos de
restauración ya no depende de la última fila escrita: lee todas las cabeceras
con el índice `by_seq_savedAt`, resuelve la más reciente y retira los lotes
anteriores y los trozos sin cabecera con traza `workshop_backup_prune`. La copia
incluye los bytes de fotos, documentos, albaranes y versiones anteriores que
citan las fichas —hasta 25 MB por archivo y 64 MB en total— y la restauración
los repone con ids nuevos, remapeando también las imágenes incrustadas. Los
adjuntos y el `.eml` de correos compartidos siguen fuera por diseño. Handover
en `.context/sessions/2026-11-22-archivos-fotos-huerfanas.md`.

**Aviso de la pasada (2026-11-22):** `recoverInterruptedRestore` avisa a todos
los administradores activos cuando de verdad interviene: recupera el estado
anterior, descarta una foto inservible, cierra una foto terminada o retira
lotes huérfanos. El recuento del aviso usa lotes/fotos, no los trozos o
documentos que componen cada foto. No genera aviso en las pasadas sin
intervención. Handover en
`.context/sessions/2026-11-22-aviso-pasada-recuperacion.md`.

El aviso se comprobó en la app local con una foto huérfana de tres documentos:
la campana mostró «1 foto huérfana» sin cortes a 1280 y 390 px. Para desplegar
el backend se corrigieron dos errores de tipos que `npx tsc --noEmit` no veía;
la comprobación real es `npx tsc -b --noEmit` y
`npx tsc -p src/convex/tsconfig.json --noEmit`. Capturas y detalle en el mismo
handover.

**Formato de copia v3 (2026-11-22):** el JSON interior sube a v3 para que un
cliente que solo conoce v1/v2 rechace las copias nuevas en vez de restaurarlas
sin sus archivos. La app nueva sigue leyendo y migrando v1 y v2, incluida una v2
con bloque `files`. Handover en
`.context/sessions/2026-11-22-formato-copia-v3.md`.

**Comprobación de tipos real (2026-11-22):** `npx tsc --noEmit` no comprobaba
nada por el `tsconfig.json` de referencias. `npm run typecheck` usa `tsc -b
--noEmit` y el `tsconfig` de Convex; la build y la CI usan ese comando. Se
verificó con errores temporales en la app y en Convex (ambos exit 2, TS2322) y
el árbol quedó limpio. Handover en
`.context/sessions/2026-11-22-typecheck-real.md`.

**Seguimiento de copias y auditoría (2026-11-22):** las copias v1/v2/v3 tienen
fixtures congeladas; la limpieza de fotos huérfanas va por páginas de 100
documentos y devuelve `hasMore`; los metadatos nuevos llevan
`metadataVersion` y la traza de limpieza se lee con `batches`/`rows` o
`photos`/`chunks`; un fallo de la pasada deja
`workshop_backup_recovery_failure` y avisa con enfriamiento; y una prueba de
gobernanza impide volver al typecheck incompleto. Handover en
`.context/sessions/2026-11-22-seguimiento-copias-auditoria.md`.
