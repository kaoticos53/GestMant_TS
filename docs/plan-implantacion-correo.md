# Plan de implantación del correo

**Base:** [`SPEC-0017`](specs/0017-buzon-de-correo-zimbra.md) y [`SPEC-0018`](specs/0018-copias-compartidas-de-correo.md).

**Estado:** plan en ejecución; 0017 aprobada (F1/F2 cerradas y F3/F4 implementadas con cabeceras, vista, cuerpo, visor, adjuntos y caché; queda la validación real contra Hermes) y **0018 en Propuesta: su aprobación formal no consta, así que F5 no se abre**. El primer incremento de F5 (tabla `mailShares`, capacidad `createIncidentFromMail` y políticas puras) se adelantó sin esa aprobación y queda en código; compartición y vista no empiezan hasta que se registre la aprobación.

**Objetivo:** implantar el buzón personal de solo lectura y, después, las copias de correo compartidas con el expediente, sin duplicar la caché del buzón ni abrir accesos laterales a terceros.

---

## 1. Resumen ejecutivo

La implantación se divide en dos entregas funcionales:

1. **Buzón de correo (0017):** cuenta Zimbra propia, carpetas, cabeceras, sincronización, visor, adjuntos y caché con LRU.
2. **Copias compartidas (0018):** compartir un mensaje con una incidencia, petición, equipo, manual o compra; visibilidad derivada del destino, retención por destino y papelera administrativa de huérfanas.

La segunda entrega **no empieza a producir valor hasta que la primera tiene visor y descarga de cuerpo**. El orden es deliberado: no se construye el expediente de correo sobre una caché que todavía no existe.

### Cifras de planificación

| Fase                                | Sesiones orientativas |
| ----------------------------------- | --------------------- |
| F0. Aprobación y preparación        | 0,5–1                 |
| F1. 0017 base pura                  | 1–2                   |
| F2. 0017 cuenta y carpetas          | 2–3                   |
| F3. 0017 cabeceras y sincronización | 3–4                   |
| F4. 0017 cuerpo, visor y caché      | 3–4                   |
| F5. 0018 esquema y compartición     | 2–3                   |
| F6. 0018 retención y huérfanas      | 1–2                   |
| F7. 0018 backup, docs y hardening   | 2–3                   |
| F8. Pilotaje y producción           | 1–2                   |
| **Total**                           | **16–24 sesiones**    |

Las estimaciones son de trabajo efectivo, no de calendario. Cada fase termina con un entregable usable y verificable; no se abre la siguiente sin pasar su puerta de salida.

---

## 2. Alcance y límites del plan

### Dentro

- Implementar las fases de 0017 y 0018 en el orden de §4.
- Añadir las tablas, capacidades, acciones, consultas, UI y crons que las specs autorizan.
- Probar aislamiento por usuario, permisos, retención, backup y limpieza de almacenamiento.
- Desplegar primero en local/pilotaje y después en producción con activación gradual por capacidades.
- Actualizar la documentación afectada y dejar un runbook de operación.

### Fuera

- Enviar, responder, reenviar, mover o marcar correo en Zimbra. El buzón es de solo lectura.
- Compartir con invitados, páginas públicas, mantenimiento o notas de manual.
- Legal hold, firmas criptográficas, S/MIME, calendario, contactos o tareas.
- Una segunda cuenta por usuario o buzones delegados.
- Cambiar el proveedor de correo saliente de 0010.

---

## 3. Supuestos y dependencias

1. **Aprobación previa:** 0017 está aprobada; 0018 debe aprobarse antes de F5. Sus decisiones de producto no cambian durante la fase.
2. **Servidor:** `hermes.rtva.es` es accesible desde el entorno Convex con TLS y SOAP en 443. La referencia canónica es [`docs/referencia-servidor-hermes.md`](referencia-servidor-hermes.md).
3. **Credenciales:** cada usuario que pruebe el buzón dispone de contraseña de aplicación; no se usan credenciales maestras ni se guardan en el repositorio.
4. **Cifrado:** `PULSO_SETTINGS_ENCRYPTION_KEY` está configurada en el entorno y se ha probado el ciclo guardar/leer/borrar de `secretCrypto`.
5. **Backup:** existe un backup reciente del taller y se ha probado una restauración en un entorno no productivo.
6. **Dependencias:** se autorizan solo `fast-xml-parser`, `postal-mime` y `dompurify` (más tipos si hacen falta), según 0017.
7. **Equipo:** hay al menos una persona de backend/Convex, una de frontend y una de validación funcional; pueden ser la misma persona en distintas sesiones.
8. **Piloto:** hay un administrador y dos técnicos disponibles para probar con buzones reales antes de abrir a todo el taller.

Si falla cualquiera de los puntos 2–4, la fase 0 no se cierra y no se empieza a sincronizar.

---

## 4. Fases

### Método de ejecución

- **TDD:** cada incremento empieza por un test de contrato. En F1 se escriben primero `tests/mailClient.test.ts` y `tests/mailCache.test.ts` contra fixtures; después se implementa y se refactoriza con los tests en verde.
- **Clean:** `src/lib/mailClient/` no conoce React, Convex, `fetch` ni la base de datos. Construye y parsea SOAP, normaliza DTOs y decide la política de caché; las acciones de Convex orquestan I/O y la UI consume datos ya normalizados.
- **DDD:** el vocabulario del dominio es `MailFolder`, `MailHeader`, `SyncCursor`, `MessageDownload` y `CacheBudget`. Los tipos de Convex no entran en el núcleo.
- **Cierre:** tests del incremento, `npx tsc --noEmit` y `tests/arquitectura.test.ts`; seguridad cuando se toque backend o UI.

### Fase 0 — Aprobación, preparación y fixtures

**Objetivo:** convertir las specs en un arranque seguro, sin tocar producción ni credenciales reales.

**Tareas**

1. Aprobar formalmente 0017 (hecho) y 0018 antes de F5, registrando la fecha de aprobación.
2. Confirmar el alcance del piloto: usuarios, buzones, permisos iniciales y ventana de prueba.
3. Verificar conectividad a `hermes.rtva.es` desde el entorno de ejecución de Convex: TLS, SOAP, tiempos y límites por IP.
4. Probar el ciclo de `secretCrypto` con una clave de entorno no productiva.
5. Crear fixtures XML anonimizados a partir de la referencia: `Auth`, `GetFolder`, `Search`, `Sync`, `GetMsg`, fault, `more="1"`, ids anidados y `view` ausente.
6. Revisar las dependencias y su licencia; confirmar que no se añade ninguna otra.
7. Probar backup y restauración en local/staging; confirmar que `securityAuditLog` no se toca.
8. Crear una rama de trabajo y una lista de comprobación de fase; no se implementa nada en `main` sin pasar las puertas.

**Entregables**

- Acta de aprobación y alcance del piloto.
- Fixtures en `tests/fixtures/mail/` (o la carpeta de fixtures existente).
- Informe breve de conectividad, cifrado y backup.
- Lista de usuarios del piloto y capacidades que se les activarán.

**Puerta de salida**

- 0017 y 0018 aprobadas.
- Conectividad y cifrado verificados.
- Backup restaurado en un entorno controlado.
- Ninguna credencial real en el repositorio.
- Fixtures suficientes para empezar la fase 1 sin red.

---

### Fase 1 — 0017: base pura y política de caché

**Objetivo:** construir el núcleo testeable sin React ni Convex.

**Tareas**

1. Instalar `fast-xml-parser`, fijar la versión y pasar `npm audit`.
2. Escribir primero `tests/mailClient.test.ts` y `tests/mailCache.test.ts` contra fixtures; deben fallar antes de implementar.
3. Crear `src/lib/mailClient/` con:
   - envoltorio SOAP 1.2 y contexto de autenticación;
   - parseo de `GetFolder`, `Search`, `Sync` y `GetMsg`;
   - paginación por página y `more`, nunca por `total`;
   - clasificación de errores y reintentos;
   - normalización de cabeceras;
   - cálculo de presupuesto y caducidad de caché.
4. Verificar que `src/lib/mailClient/` no importa `react`, `react-dom`, `convex` ni `convex/*`.
5. Documentar las decisiones de protocolo que no cubre la referencia.

**Entregables**

- `src/lib/mailClient/` completo y puro.
- Tests de parsers, paginación, errores y política de caché.

**Puerta de salida**

- `tests/mailClient.test.ts` y `tests/mailCache.test.ts` en verde.
- `npx tsc --noEmit` sin errores.
- `tests/arquitectura.test.ts` en verde.
- Cero llamadas a red en los tests.

---

### Fase 2 — 0017: cuenta, carpetas y capacidad `viewMailbox`

**Objetivo:** que un usuario pueda dar de alta su cuenta, probar la conexión y ver sus carpetas.

**Tareas**

1. Añadir al esquema `mailAccounts` y `mailFolders`, con índices y tipos generados.
2. Implementar `mailAccounts`:
   - alta y edición de la cuenta propia;
   - cifrado de contraseña y token;
   - `Probar conexión` con `AuthRequest` + `GetFolder`;
   - estado `disconnected` / `connected` / `reauthRequired` / `error`.
3. Añadir `viewMailbox` a `src/lib/permissions.ts`, `DEFAULT_GRANTS` y la matriz de roles.
4. Añadir el sujeto `Mailbox` a `src/lib/abilities.ts` con `view`/`manage`, condicionado a `viewMailbox` y `{ userId }`.
5. Fijar `serverUrl` y TLS: no se acepta un host del cliente (evita SSRF).
6. Implementar desconexión (borra credenciales y token; conserva o borra la caché según elección) y borrado de cuenta (credenciales, token, carpetas, cabeceras, cuerpos y adjuntos); las copias compartidas no se tocan.
7. Comprobar que el administrador no puede leer ni configurar el buzón de otra persona.
8. Emitir eventos de auditoría de alta, cambio de credenciales y desconexión, sin contenido.
9. Dejar la pestaña «Mi buzón» en Ajustes y la entrada de Ajustes para `viewMailbox`; el módulo «Correo» (`NavId`, `MODULE_META`, `TAB_ACCESS_POLICY` y `DashboardTabRenderer`) se creó en F3 junto con la lista.
10. Resolver el árbol de carpetas y excluir tipos que no son correo (`Calendar`, `Contacts`, `Tasks`, RSS).
11. Probar aislamiento entre dos técnicos: cada uno ve solo su cuenta y sus carpetas.
12. Verificar que ninguna consulta devuelve contraseña, token ni pista completa.

**Entregables**

- Tablas `mailAccounts` y `mailFolders`.
- Ajustes «Mi buzón» y prueba de conexión.
- Capacidad `viewMailbox` y su entrada en la matriz.
- `tests/mailAccounts.test.ts` y pruebas de UI de ajustes.

**Puerta de salida**

- Alta y prueba contra el servidor real en local, o con fixtures si F0 no ha podido validar conectividad; en ese caso la prueba real es la puerta de F3 y no se simula.
- Dos usuarios aislados; el segundo no puede leer credenciales ni carpetas del primero.
- `CA-001` y `CA-012` de 0017 verificados.
- `npx tsc --noEmit` y tests de cuenta en verde.

---

### Fase 3 — 0017: cabeceras, sincronización inicial e incremental

**Objetivo:** listar el buzón sin descargar cuerpos y mantenerlo actualizado sin duplicados.

**Estado:** backend implementado y probado con `fetch` simulado (`mailHeaders`, `mailSync`, tumbas, token, lease y cron). La vista del módulo «Correo» está implementada con carpetas, búsqueda local, lista virtualizada, estados, modo móvil y paginación por offset. Solo falta la validación real contra Hermes.

**Tareas**

1. Añadir `mailHeaders` con índices de listado, identidad, caché y última apertura.
2. Implementar `mailHeaders` para listado paginado, búsqueda local por asunto/remitente y contadores.
3. Implementar `mailSync`:
   - `Search` paginado con `dateAsc` en el recorrido completo;
   - upsert por `accountId + messageId`;
   - `Sync` para token y borrados;
   - `deletedRemoteAt` y reaparición;
   - reanudación y reconciliación manual;
   - `account.AUTH_FAILED` deja la cuenta en `reauthRequired`, sin reintento en bucle.
4. Añadir el cron horario en el minuto 20:
   - solo cuentas `enabled` de usuarios activos; la sincronización bajo demanda comprueba `users.active` antes de tocar `mailAccounts`;
   - lease por cuenta;
   - máximo 2 peticiones simultáneas;
   - espera de 2 s entre cuentas.
5. Crear el módulo «Correo» (`NavId`, `MODULE_META`, `TAB_ACCESS_POLICY` y `DashboardTabRenderer`) y la vista de lista virtualizada, con el estado de sincronización, los vacíos/errores explicados, el modo móvil de un panel a la vez y paginación por offset.
6. Medir la primera sincronización con el buzón de referencia.

**Entregables**

- `mailHeaders`, `mailSync` y cron.
- Lista de correo con carpetas, búsqueda local y estados.
- Tests de paginación por offset, token, borrados, reaparición y baja de usuario.

**Puerta de salida**

- `CA-002`, `CA-003`, `CA-004`, `CA-010`, `CA-014` y `CA-015` de 0017.
- 1 554 cabeceras en menos de 30 s y **0 cuerpos descargados**.
- Paginación por offset verificada con offset fuera de rango, última página parcial y total filtrado por búsqueda.
- Segunda pasada sin duplicados.
- Cron saltando cuentas de usuarios `active === false`, sin tocar `mailAccounts`.
- Conexión real validada si F2 se cerró con fixtures; token inválido reinicia sin perder datos.
- `npx tsc --noEmit` y tests de sincronización en verde.

---

### Fase 4 — 0017: cuerpo, visor, adjuntos y caché

**Objetivo:** abrir un mensaje, verlo con seguridad y cachearlo con presupuesto y caducidad.

**Tareas**

1. Instalar `postal-mime` y `dompurify` para el parseo MIME y el saneado del visor.
2. Añadir `mailBodies` y `mailAttachments`.
3. Implementar `mailBody`:
   - `GetMsg` + content servlet;
   - verificación de bytes contra `s`;
   - límite de 50 MB;
   - parseo MIME;
   - una sola copia: cuerpo en `mailBodies`, adjuntos en `_storage`;
   - descarte del RFC822 en la caché.
4. Implementar el visor:
   - texto plano y HTML saneado;
   - iframe con `sandbox` y CSP;
   - imágenes `cid:` resueltas contra el adjunto, sin persistir `data:`;
   - imágenes remotas bloqueadas;
   - descarga de adjuntos con comprobación de propiedad.
5. Implementar la caché:
   - `cacheBytes` = cuerpo + adjuntos;
   - LRU al 90 %, conservando cabeceras;
   - caducidad de 30 días;
   - «Vaciar caché»;
   - barrido diario;
   - reconciliación de contadores;
   - si se pierde `viewMailbox`, la caché queda inaccesible y el barrido la purga; las copias compartidas no se tocan.
6. Añadir la pestaña de ajustes de caché (límite, retención, consumo y vaciado).
7. Emitir el evento de auditoría del vaciado de caché, sin datos del correo.
8. Probar que abrir un mensaje no cambia leído, carpeta ni flags en el webmail.

**Entregables**

- `mailBodies`, `mailAttachments`, `mailBody`, `mailAttachments`, `mailCache`.
- Visor y descarga.
- Tests de bytes, MIME, HTML, `cid:`, LRU, caducidad y vaciado.

**Puerta de salida**

- `CA-005` a `CA-009`, `CA-011` y `CA-013` de 0017.
- Bytes exactos contra `s`; si no coinciden, no se cachea.
- Ningún objeto con el RFC822 completo en `_storage`.
- Abrir un mensaje no modifica el estado remoto.
- `storageCleanup` no borra adjuntos citados.
- Tests de visor y caché en verde.

**Fin de F4:** el buzón de solo lectura está completo. A partir de aquí puede empezar 0018.

**Estado:** implementada en código con `postal-mime`, `dompurify`, descarga verificada, visor de tres paneles, adjuntos, LRU, caducidad, «Vaciar caché» y barrido que purga la caché si el dueño pierde `viewMailbox`. Queda la validación real contra Hermes (apertura, adjuntos, `cid:` y comprobación de que no cambia el flag de leído).

---

### Fase 5 — 0018: esquema, permisos y compartición

**Objetivo:** compartir un mensaje con el expediente sin acoplarlo a la caché.

**Tareas**

1. Añadir `mailShares` con índices:
   - `by_destination`;
   - `by_orphan_purge`;
   - `by_client_share`;
   - `by_source_message`.
2. Añadir `createIncidentFromMail` a `CAPABILITIES` y `DEFAULT_GRANTS`:
   - `admin`, `manager`, `technician`: `true`;
   - `guest`: `false`;
   - roles personalizados: `false`.
3. Implementar el helper de audiencia por destino:
   - incidencias/peticiones: miembro activo;
   - equipos: `viewEquipment` / `manageEquipment`;
   - manuales: `viewManuals` / `manageManuals`;
   - compras: `viewPurchasing` / `managePurchasing`;
   - papelera: coordinación;
   - huérfanas: administrador.
4. Implementar `mailShares.share`:
   - comprobar `viewMailbox`, cuenta propia y mensaje propio;
   - comprobar que el destino existe y no está en papelera;
   - descargar/parsear si el cuerpo no está cacheado;
   - no escribir en `mailBodies` / `mailAttachments` ni en `cacheBytes`;
   - guardar snapshot y objetos propios;
   - limpiar a medias si falla;
   - respetar `clientShareId` para no duplicar en reintentos.
5. Implementar `mailShares.createIncidentFromMail`:
   - comprobar `viewMailbox` y `createIncidentFromMail`;
   - incidencia en `reported`, sin asignar, referencia nueva y descripción con asunto/extracto;
   - remitente como notificante;
   - técnico como autor en `mailShares.sharedBy` y en `history`;
   - copia atómica con la incidencia.
6. Implementar `share` con las capacidades exactas: incidencia existente (`manageIncidents`), petición (`decideRequests`), equipo (`manageEquipment`), manual (`manageManuals`, solo resumen) y compra (`managePurchasing`).
7. Crear el diálogo «Compartir con el expediente», la sección «Correos compartidos» con visor de la copia, la acción de purga para administrador y las descargas de adjuntos/`.eml` tras comprobar la visibilidad del destino.
8. Probar `summary` y `original`, `.eml` opcional, límite de 50 MB y rechazo de `original` en manuales.
9. Emitir `mail_share_create` en `securityAuditLog`, sin contenido.
10. Probar que un autor dado de baja no altera la copia ni su audiencia.

**Entregables**

- Tabla `mailShares`.
- Capacidad `createIncidentFromMail`.
- Acciones de compartición y creación de incidencia.
- UI de compartición y sección en fichas.
- Tests de permisos, aislamiento y contenido.

**Puerta de salida**

- `CA-001` a `CA-005`, `CA-008` y `CA-009` de 0018.
- `viewMailbox` no se exige para ver; sí para compartir.
- Invitados, anónimos, público y `lookupEquipment` / `lookupCatalog` no ven copias.
- La copia sobrevive a «Vaciar caché» y a la desconexión de la cuenta.
- Manuales solo aceptan resumen.
- `tests/mailShares.test.ts` y `tests/mailSharesView.test.tsx` en verde.

---

### Fase 6 — 0018: retención, huérfanas, auditoría y lápida

**Objetivo:** cerrar el ciclo de vida de la copia sin dejarla huérfana ni para siempre ni sin control.

**Tareas**

1. Enganchar la purga en `_incidents/trash` y `_partRequests/trash`:
   - restaurar antes de `purgeAt` conserva la copia;
   - purgar el destino purga la copia en la misma operación.
2. Enganchar `equipment.remove` y `manuals.remove`:
   - marcar `destinationDeletedAt`;
   - fijar `orphanPurgeAt = ahora + 7 días`;
   - no permitir reattach.
3. Añadir el barrido diario de huérfanas.
4. Añadir la tarjeta «Copias de correo huérfanas» en Ajustes → Almacenamiento, solo administrador:
   - listar, descargar y purgar con motivo (`purgeReason`);
   - sin restaurar ni reattach.
5. Implementar la purga de contenido:
   - borrar `.eml` y adjuntos;
   - vaciar cuerpo y metadatos personales;
   - conservar lápida sin asunto ni remitente.
6. Registrar en `securityAuditLog`:
   - `mail_share_purge`;
   - `mail_share_orphan`;
   - `mail_share_restore_skip`.
7. Probar que el administrador puede purgar una copia viva y que la ficha muestra la lápida.

**Entregables**

- Enganches de retención y borrado.
- Cron de huérfanas.
- Papelera administrativa.
- Auditoría y lápidas.
- Tests de restauración, purga, plazo y aislamiento.

**Puerta de salida**

- `CA-006`, `CA-007`, `CA-011` y `CA-012` de 0018.
- Una incidencia restaurada conserva su copia.
- Una incidencia purgada purga su copia.
- Un equipo o manual borrado deja la copia 7 días en la papelera administrativa y no se puede reattach.
- `securityAuditLog` solo lo lee el administrador.
- `storageCleanup` respeta los objetos citados y los barre tras la purga.

---

### Fase 7 — 0018: backup, reset, documentación y hardening

**Objetivo:** dejar la funcionalidad operable, reversible y documentada.

**Tareas**

1. Añadir `mailShares` a `BACKUP_TABLES`.
2. Exportar solo metadatos:
   - sin `summary`, cuerpo, adjuntos, `.eml`, `sourceMessageId` ni `sourceEmail`;
   - `mode: "summary"`, `backupRestored: true` y marca «Copia restaurada: solo metadatos» al restaurar;
   - si el destino no se puede remapear, omitir la copia y registrar `mail_share_restore_skip`.
3. Añadir `mailShares` a `RESET_TABLES`; comprobar que `securityAuditLog` no se toca.
4. Verificar que `mailAccounts`, `mailFolders`, `mailHeaders`, `mailBodies` y `mailAttachments` no entran en backup, reset ni volcados de depuración; solo `mailShares` entra en backup como metadatos y en reset como trabajo del taller.
5. Extender las pruebas de `storageCleanup` con `mailShares`.
6. Actualizar la documentación:
   - 0010 (correo saliente y avisos, si corresponde);
   - 0013 (auditoría);
   - 0015 (UI);
   - 0016 (esquema);
   - manual de uso;
   - README de specs.
7. Revisar el diálogo, la sección y la papelera administrativa con teclado, foco visible y móvil; `tests/mailSharesView.test.tsx` pasa.
8. Ejecutar la revisión de seguridad:
   - sin `any`;
   - sin React/Convex en `src/lib/`;
   - sin `dangerouslySetInnerHTML` no autorizado;
   - mutaciones con identidad y capacidad;
   - sin credenciales en logs.
9. Ejecutar la suite completa, `tsc`, lint y build.
10. Ensayar el rollback funcional: desactivar `viewMailbox` y `createIncidentFromMail`; las copias existentes se conservan.

**Entregables**

- Backup/restauración con copias restauradas como metadatos.
- Reset seguro.
- Documentación actualizada.
- Informe de seguridad y build.
- Runbook de rollback.

**Puerta de salida**

- `CA-010` de 0018.
- Backup restaurado en local: una copia `original` vuelve como `summary`.
- `securityAuditLog` intacto tras reset.
- `npm run security:check`, `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- Suite completa en verde.
- Sin secretos ni datos reales en fixtures.

---

### Fase 8 — Pilotaje y producción

**Objetivo:** activar el correo con riesgo controlado y capacidad de marcha atrás.

**Tareas**

1. Desplegar primero en local/staging con un backup previo.
2. Acotar el piloto: revocar `viewMailbox` a manager/technician (nace activa para ellos según 0017) y dar a los dos técnicos un rol temporal de piloto con la capacidad; la matriz es por rol, no por persona. El default de código de 0017 no cambia; solo se usan overrides temporales de rol.
3. Configurar un buzón de prueba y validar:
   - conexión;
   - sincronización;
   - apertura;
   - adjuntos;
   - «Vaciar caché».
4. Activar el piloto con dos técnicos:
   - un buzón real por persona;
   - una incidencia compartida;
   - una petición compartida;
   - una copia en equipo;
   - una copia en manual (solo resumen);
   - una copia en compra;
   - purga de una copia por administrador.
5. Revisar con el piloto:
   - tiempos de sincronización;
   - errores de credenciales;
   - consumo de almacenamiento;
   - comprensión de la diferencia entre caché y copia.
6. Corregir solo defectos bloqueantes o de privacidad; no abrir alcance nuevo.
7. Reasignar a los técnicos a su rol normal, retirar el rol temporal, restaurar el default de `viewMailbox` y abrir por roles: primero manager y después technician.
8. Revisar `createIncidentFromMail` en el rol temporal y en los roles que se abran; si el piloto debe limitar el alta, revocarlo en ese rol, no cambiar el default de 0018.
9. Programar el cron y verificar la primera pasada en producción.
10. Comunicar limitaciones: solo lectura, sin envío, sin delegación, sin legal hold.

**Entregables**

- Entorno de producción con las tablas y crons activos.
- Piloto documentado con incidencias y decisiones.
- Capacidades activadas por rol.
- Manual breve de uso y soporte.

**Puerta de salida**

- Piloto sin fugas de datos entre usuarios.
- Sin errores de sincronización repetidos ni cuentas bloqueadas.
- Copias visibles para el público correcto y no para invitados.
- Backup y rollback probados.
- Aprobación explícita para abrir al taller.

**Rollback**

- Desactivar `viewMailbox` y `createIncidentFromMail` en la matriz de permisos.
- Desactivar la sincronización de las cuentas afectadas (`mailAccounts.enabled = false`).
- No borrar tablas ni caché para “volver atrás”: los datos quedan y las copias siguen su ciclo.
- Si el problema es de credenciales, dejar la cuenta en `reauthRequired` y pedir contraseña de aplicación.
- Si el problema es de espacio, reducir límites de caché o vaciar caché, nunca copias compartidas.

---

## 5. Dependencias y camino crítico

```
F0 Aprobación
  └─► F1 Base pura
        └─► F2 Cuenta y carpetas
              └─► F3 Cabeceras y sincronización
                    └─► F4 Cuerpo, visor y caché
                          └─► F5 0018 Esquema y compartición
                                └─► F6 Retención y huérfanas
                                      └─► F7 Backup, reset y hardening
                                            └─► F8 Piloto y producción
```

- **No se solapa F5 con F4:** compartir necesita el visor y la descarga de cuerpo.
- **F0 y F1 pueden solaparse** solo en la preparación de fixtures y dependencias.
- **F7 no puede empezar** hasta que F6 tenga una purga estable; el backup debe saber qué se exporta y qué se purga.
- **F8 no puede empezar** sin backup restaurado y rollback probado.

---

## 6. Matriz de verificación

| Fase | Pruebas automatizadas                                                                                    | Verificación manual                                        |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| F1   | `tests/mailClient.test.ts`, `tests/mailCache.test.ts`, `tests/arquitectura.test.ts`                      | Ninguna; solo fixtures.                                    |
| F2   | `tests/mailAccounts.test.ts`, tests de ajustes                                                           | Alta, prueba de conexión y aislamiento entre dos usuarios. |
| F3   | `tests/mailSync.test.ts`, `tests/mailHeaders.test.ts`, `tests/mailboxView.test.tsx`, tests de navegación | Sincronización real, 1 554 cabeceras, sin cuerpos.         |
| F4   | `tests/mailBody.test.ts`, `tests/mailHtml.test.tsx`, `tests/mailboxView.test.tsx`                        | Abrir mensaje, adjuntos, HTML, `cid:`, no marcar leído.    |
| F5   | `tests/mailShares.test.ts`, `tests/mailSharesView.test.tsx`                                              | Compartir en cada destino, permisos y modos.               |
| F6   | `tests/mailShares.test.ts`, `tests/trash.test.ts`, `tests/storageCleanup.test.ts`                        | Restaurar, purgar, borrar equipo/manual, lápida.           |
| F7   | `tests/workshopBackup.test.ts`, `tests/workshopReset.test.ts`, `tests/audit.test.ts`                     | Backup/restore y reset en local.                           |
| F8   | Suite completa, `npm run security:check`                                                                 | Piloto con buzones reales y revisión de permisos.          |

### Comandos de cierre

```bash
npx tsc --noEmit
npx vitest run <tests de la fase>
npm run lint
npm run build
npm run security:check
```

En cada fase se ejecutan los tres primeros; el build y la suite completa se reservan para F7/F8, salvo que la fase toque UI o esquema.

---

## 7. Despliegue

### Orden

1. Backup previo del taller.
2. Desplegar el esquema aditivo (`mailAccounts`, `mailFolders`, `mailHeaders`, `mailBodies`, `mailAttachments`, `mailShares`).
3. Desplegar acciones, consultas y crons.
4. Desplegar la UI.
5. Verificar que el cron no arranca cuentas sin usuario activo.
6. Confirmar el acceso del administrador; su rol siempre tiene todas las capacidades.
7. Configurar un buzón y validar lectura.
8. Activar el piloto con el rol temporal.
9. Abrir por roles: primero manager y después technician.

### Compatibilidad

- Las tablas son nuevas; no hay migración de datos existentes.
- `mailShares` es aditivo hasta que 0018 se activa; si no se usa, no afecta a las fichas.
- `BACKUP_TABLES` y `RESET_TABLES` deben actualizarse en el mismo despliegue que el esquema, no después.
- `storageCleanup` no necesita una lista nueva de tablas: recorre el esquema; sí necesita el test de citas de `mailShares`.

### Ventana y duración

- El despliegue de esquema y backend no requiere parada del taller.
- La primera sincronización de un buzón de referencia puede tardar decenas de segundos; se hace fuera de la ventana de mayor uso.
- El cron horario se activa cuando el piloto ya ha probado la sincronización manual.

---

## 8. Operación y soporte

### Rutina

- Revisar `mailAccounts.lastSyncAt`, `lastSyncOkAt` y `lastSyncError`.
- Revisar cuentas en `reauthRequired` y pedir contraseña de aplicación.
- Revisar el consumo de caché y el resultado del barrido diario.
- Revisar `mailShares` huérfanas y su fecha de purga.
- Revisar `securityAuditLog` para altas, purgas y saltos de restauración.

### Incidencias típicas

| Síntoma               | Causa probable                                          | Actuación                                                  |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `account.AUTH_FAILED` | Contraseña caducada o falta de contraseña de aplicación | Estado `reauthRequired`; no reintentar en bucle.           |
| Sincronización lenta  | Servidor compartido o límite por IP                     | Mantener 2 peticiones, cuentas en serie y lease.           |
| Caché llena           | Límite por usuario                                      | LRU y ajuste de límite; no tocar copias.                   |
| Copia no visible      | Destino en papelera o capacidad revocada                | Revisar audiencia del destino; no crear un permiso ad hoc. |
| Copia huérfana        | Equipo o manual borrado                                 | Papelera administrativa; descargar o purgar.               |
| Backup sin cuerpo     | Comportamiento esperado                                 | La copia restaurada es resumen; no prometer contenido.     |

### Prohibiciones operativas

- No borrar `mailShares` a mano para “limpiar” una ficha.
- No reutilizar `storageId` de la caché para una copia.
- No ejecutar `security:check` contra producción con credenciales reales.
- No activar `viewMailbox` a invitados ni a roles personalizados sin revisión.
- No usar `mailShares` como sustituto de la caché para ahorrar descargas.

---

## 9. Riesgos del plan

| Riesgo                                                               | Probabilidad | Impacto  | Mitigación                                                 |
| -------------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------- |
| El servidor exige contraseñas de aplicación y el piloto no las tiene | Media        | Alto     | Fase 0; no sincronizar sin credenciales.                   |
| Límite por IP o 429                                                  | Media        | Medio    | 2 peticiones, cuentas en serie, reintentos con espera.     |
| Caché y copia se confunden en soporte                                | Media        | Alto     | UI con aviso; runbook; tests de presupuesto.               |
| Copia visible para quien no debe                                     | Baja         | Muy alto | Audiencia derivada del destino; tests de invitado/público. |
| Copia huérfana sin purga                                             | Baja         | Alto     | `orphanPurgeAt` fijo y cron diario.                        |
| `.eml` malicioso                                                     | Media        | Medio    | Descarga explícita, aviso y límite; no renderizar.         |
| Backup restaura contenido                                            | Baja         | Alto     | Exportación solo de metadatos; test de restauración.       |
| Alcance creep hacia envío o delegación                               | Media        | Alto     | Fuera de alcance; cualquier cambio requiere spec nueva.    |

---

## 10. Definición de terminado

La implantación se considera terminada cuando:

1. 0017 cumple `CA-001` a `CA-015` y 0018 cumple `CA-001` a `CA-012`.
2. `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run security:check` y la suite completa pasan.
3. Dos usuarios reales están aislados; el administrador no puede leer ni configurar el buzón de otra persona.
4. Se ha probado con un buzón real la sincronización, apertura, adjuntos, «Vaciar caché» y compartición con incidencia, petición, equipo, manual y compra.
5. Se ha probado la retención: restaurar conserva la copia, purgar el destino la purga, equipo/manual borrado deja huérfana 7 días y no hay reattach.
6. Se ha probado backup/restore: una copia `original` vuelve como `summary`; `securityAuditLog` sigue siendo inmutable y no entra en reset.
7. La documentación afectada está actualizada y el runbook está en `docs/`.
8. El piloto ha firmado la apertura y existe un rollback probado.
9. No hay secretos, credenciales ni datos personales en fixtures, logs o repositorio.

---

## 11. Próxima acción

0017 está aprobada y F1–F4 están implementadas en código. La siguiente acción es cerrar la validación real contra Hermes: conectividad, contraseñas de aplicación, cifrado, backup y usuarios del piloto, además de 1 554 cabeceras, 0 cuerpos en la sincronización, segunda pasada sin duplicados y apertura de un mensaje con adjuntos y `cid:` sin marcar leído. 0018 sigue en Propuesta y debe aprobarse antes de F5; no se debe abrir el piloto ni empezar F5 sin cerrar esa validación.
