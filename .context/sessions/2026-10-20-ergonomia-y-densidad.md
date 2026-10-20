# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-10-20 20:05
- **Agente / Modelo:** Buffy (Freebuff Desktop)
- **Rama / Commit:** main (sin commit; cambios en el árbol de trabajo)

---

## 1. Objetivo Principal de la Sesión

Revisar la interfaz como experto en ergonomía y aplicar el plan aprobado: cabecera
de módulo compacta, tira de cifras ligera, más fichas por pantalla, fichas con
cabecera y pie fijos, filtros accesibles, microcopy, foco/contraste y atajo de
búsqueda.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/pages/dashboard/components/PageHeader.tsx` | Nuevo | Cabecera de módulo en una franja: título real, contador, una línea de contexto y menú «⋯». |
| `src/pages/Dashboard.tsx` | Refactorización | Sustituye el bloque de 300 px (rol + titular + párrafo + 4 botones) por `PageHeader`; añade «Saltar al contenido», `document.title` por módulo y renombra «Máquinas del taller» a «Flujos y estados». |
| `src/pages/dashboard/components/DashboardStats.tsx` | Rediseño | Tarjetas de 130 px → tira de 59 px con cifra, nombre y detalle en una línea. |
| `src/lib/density.ts` | Nuevo | Preferencia de densidad (cómoda/compacta) pura y persistida, compartida por las dos colas. |
| `src/hooks/use-rows-that-fit.ts` | Corrección | La media con pocas filas subestimaba y la lista oscilaba hacia abajo; ahora nunca cuenta menos de las que caben. |
| `src/components/ListArea.tsx` | Ajuste | Alto reservado del marco 18 → 25 rem para que la lista quepa con su pie y no haya segunda barra. |
| `src/pages/dashboard/incidents/hooks/useIncidentFilters.ts`, `requests/hooks/useRequestFilters.ts` | Ajuste | La densidad se recuerda entre visitas y abre en compacta. |
| `src/pages/dashboard/QueueToolbar.tsx` | Rediseño | Conmutador de dos vistas con `aria-pressed`, en vez de un botón que cambiaba de nombre. |
| `src/pages/dashboard/requests/components/RequestCard.tsx` | Ajuste | La vista compacta deja de pintar notas, adjuntos, fichas de material y avisos largos. |
| `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx` | Ajuste | Cabecera y pie fijos; las tres descargas pasan a un menú «Descargar». |
| `src/pages/dashboard/requests/components/RequestDetailSheet.tsx` | Ajuste | Cabecera y pie fijos. |
| `src/components/ui/sheet.tsx` | Corrección | El aspa de cerrar se llamaba `Close`; ahora `Cerrar`, por encima de la cabecera. |
| `src/index.css`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx` | Tokens | Anillo de foco a plena opacidad, `--destructive` oscurecido para 4,5:1, sello de versión legible. |
| `src/components/NotificationBell.tsx` | Accesibilidad | El foco entra en el panel al abrirlo y vuelve a la campana al cerrarlo con `Esc`. |
| `src/pages/dashboard/GlobalSearch.tsx` | Mejora | `⌘/Ctrl+K` enfoca el buscador; las consultas se saltan hasta el primer uso y el foco usa `--ring`. |
| `src/pages/dashboard/components/DashboardHeader.tsx` | Ajuste | Móvil: «Salir» solo con icono y tira de módulos con parada por destino. |
| `src/pages/dashboard/IncidentsView.tsx`, `RequestsView.tsx`, `PurchasingView.tsx`, `InventoryView.tsx` | Ajuste | Filtros/secciones con `aria-pressed`, una fila (scroll en móvil) y acciones de 40 px en la tabla de repuestos. |
| `src/lib/incidentJourney.ts` | Nuevo | Recorrido de la incidencia en cuatro etapas y el siguiente paso, leídos de la máquina de estados (sin comparar textos de estado); `blockedJourneySteps` da cada paso bloqueado con su motivo y su etapa. |
| `src/lib/journey.ts` | Nuevo | Tipos que comparten los dos recorridos (etapa, estado de etapa, paso bloqueado): una sola forma de pintar casos. |
| `src/components/JourneySummary.tsx` | Nuevo | El resumen visual común: etapas, «Ahora», «Siguiente» y cada motivo bajo la etapa de su paso. Sustituye al `IncidentJourney` que vivía en la carpeta de incidencias. |
| `src/lib/requestJourney.ts` | Nuevo | Recorrido de la petición (pendiente → aprobada → entregada y cierre), siguiente paso y motivos por etapa, leídos de `lib/requestFlow`. |
| `src/lib/orderJourney.ts` | Nuevo | Recorrido de la orden de compra (enviada → recibiendo → completada/anulada), su siguiente paso y los motivos de los pasos cerrados, leídos de `lib/purchaseFlow`. |
| `src/lib/requestJourney.ts` | Ampliación | El archivo es un tramo más (`archived`): lo entregado y guardado se lee distinto de lo que sigue en la cola. |
| `src/pages/dashboard/PurchasingView.tsx` | Mejora | La ficha de la orden monta `JourneySummary` y estrena pie fijo con «Recepcionar material» y «Anular la orden»; la tarjeta de la lista deja de pintar `BlockedSteps`. |
| `src/components/BlockedSteps.tsx` | Eliminado | Ya no lo usaba nadie: los tres módulos explican sus motivos dentro de su recorrido. |
| `src/convex/purchasing.ts` | Ampliación | Mutación `requestPurchases` para apartar varias peticiones de repuesto de una vez; la apartada por línea pasa a un ayudante que comparten la de una y la de varias. |
| `src/pages/dashboard/PurchasingView.tsx` | Mejora | «Sin material en el almacén» con casillas, «Marcar todas» y «Apartar N peticiones» en una sola llamada; el resultado dice qué quedó fuera y por qué. |
| `tests/compras.test.ts` | Tests | Tres pruebas del lote (aparta lo que falta, no repite lo que está en camino, permisos y lista vacía); `pedir` busca por referencia y no por posición. |
| `tests/purchasingView.test.tsx` | Tests | La tarjeta marca dos peticiones y llama al lote con las dos: «Apartar 2 peticiones». |
| `src/lib/requestFlow.ts` | Ampliación | `isRequestSettled` y `requestStepExcuse`: la ficha sabe si ya no queda nada que decidir y distingue el motivo concreto del «aquí ya no toca». |
| `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx` | Mejora | Monta `JourneySummary` como primer bloque, calcula el siguiente paso con las mismas reglas que sus botones y ya no pinta `BlockedSteps` al pie: los motivos viven en el recorrido. |
| `src/pages/dashboard/requests/components/RequestDetailSheet.tsx` | Mejora | Monta el mismo recorrido en la ficha de petición, con la etapa actual, el siguiente paso y los motivos junto a su etapa; retira `BlockedSteps` del pie. |
| `tests/listArea.test.tsx`, `tests/density.test.ts`, `tests/incidentJourney.test.ts`, `tests/requestJourney.test.ts` | Tests | Nuevo tope medido de la lista, preferencia de densidad, recorrido de la incidencia y recorrido de la petición. |

---

## 3. Decisiones Técnicas y de Diseño Tomadas

- **Una sola franja de cabecera:** la acción propia del módulo («Nueva petición») se
  queda en la barra de su lista, junto a búsqueda y orden; la cabecera solo lleva lo
  global, dentro de «⋯». Así no se duplica.
- **Densidad compacta por defecto y persistida:** es una cola de trabajo; el detalle
  completo sigue a un clic y la preferencia se recuerda en el navegador.
- **Sin librerías nuevas:** Radix, `Kbd` y los componentes existentes.
- **Sin tocar dominio:** ninguna transición ni mutación de Convex. En `lib/` solo se
  añadieron predicados de lectura (`isRequestSettled`, `requestStepExcuse`) que
  consultan la misma tabla de `requestFlow`.
- **Los motivos, junto a su paso:** el bloque «Por qué no se puede» al pie de la ficha
  se fundió en el recorrido. `blockedJourneySteps` reparte cada paso bloqueado a la
  etapa en la que se da —asignar en «Nueva», verificar en «Asignada», el trabajo de
  taller en «En taller»— y el porqué es literalmente el de `incidentStepBlocker`, sin
  una segunda redacción. Solo Compras sigue usando `BlockedSteps`.
- **Un solo componente para los dos recorridos:** la incidencia y la petición se
  pintan con `JourneySummary`; si una ficha explicara su recorrido de una manera y la
  otra de otra, la comparación se perdería. Cada dominio conserva su máquina en su
  módulo (`incidentJourney`, `requestJourney`) y `lib/journey` solo lleva la forma.
- **La petición tiene tres etapas y un cierre:** pendiente → aprobada → entregada, y
  una cuarta solo cuando terminó sin entregarse (rechazada, cancelada, devuelta). La
  suspensión no es etapa: se lee de `heldFrom`, igual que al reanudar.
- **La orden de compra tiene tres tramos y un final:** enviada → recibiendo →
  completada, y ese último se llama «Anulada» cuando la orden se anuló. Una anulada
  con material dentro no finge no haber recibido; la que se anuló sin recepciones deja
  «Recibiendo» en punteado, porque `received` se sabe por las cantidades.
- **El archivo es un tramo, no un aviso:** una petición archivada suma la etapa
  «Archivada» al final —la de antes pasa a hecha— y la línea de «Ahora» dice «Entregada
  · en el archivo». Una rechazada y archivada encadena «Rechazada ✓ · Archivada ●».
- **Apartar en lote es una sola mutación:** si alguna petición ya no se puede —está
  resuelta, archivada o su compra ya está en marcha— no tumba el resto: vuelve en
  `skipped` con su motivo, y la pantalla lo cuenta. Así la cola de «Sin material» no
  deja al responsable con un error y sin saber cuáles entraron.
- **El bloque `BlockedSteps` desaparece:** los tres módulos (incidencia, petición y
  orden) explican sus motivos dentro de su recorrido. El de la orden sigue existiendo
  solo para la pantalla «Flujos y estados» (`lib/machineSheet`), que no es una ficha.
- **De las etapas ya pasadas solo se explica lo que hay que hacer:** en una entregada
  no se repite «se aprueba lo que espera decisión», pero sí «para cancelarla, primero
  devuélvela». La distinción vive en `requestFlow` (`requestStepExcuse`), no en la UI.
- **Resuelta = una frase, no siete motivos:** con la petición rechazada, cancelada o
  devuelta no se enumeran los pasos; lo dice el resumen del recorrido en «Siguiente».

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores
- **Suite de Tests (`npx vitest run`):** ✅ 120 archivos, 1781 tests (69 saltados, 1 archivo `funciones` saltado); 18 de `tests/incidentJourney.test.ts`, 24 de `tests/requestJourney.test.ts` y 11 de `tests/orderJourney.test.ts`, más dos de `tests/purchasingView.test.tsx` que pintan la ficha y leen el recorrido
- **Lint (`npm run lint`):** ✅ 0 errores (29 avisos, todos previos y en archivos no tocados)
- **Test de Arquitectura (`npx vitest run tests/arquitectura.test.ts`):** ✅ 9 tests
- **Test de Seguridad (`npx vitest run tests/seguridad.test.ts`):** ✅ 6 tests
- **Pruebas Manuales / UI (1440×900 y 390×844):** cabecera 330 → 90 px; primera ficha a 685 → 375 px; documento 1394 → 900 px (sin scroll de página ni barras anidadas); incidencias 3 → 4 por página; peticiones 2 → 3 (32 → 22 páginas); acciones de la ficha de incidencia visibles con el pie fijo (antes a 1341 px); recorrido de estados verificado en tres casos reales (nueva, en reparación y resuelta en el sitio, esta última con la etapa de taller en «no se pasó»); `Ctrl+K` enfoca el buscador; el panel de avisos recibe y devuelve el foco. Recorrido de la petición comprobado en la app: pendiente (PET-0001, «Siguiente: Aprobar la petición»), aprobada (paso 2 de 3, «Siguiente: Entregar el material al técnico», con los motivos de cancelar y devolver), entregada (solo los dos motivos que sirven) y rechazada (paso 4 de 4, «Ya está cerrada», con aprobada y entregada en punteado y sin lista de motivos), a 1440×900 y 390×844. Capturas: `screenshots/peticion-recorrido-1440.png`, `peticion-aprobada-390.png`, `peticion-rechazada-1440.png`.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes para el Siguiente Agente

- [ ] **Compras: varias órdenes, una por proveedor, en una sola acción.** Apartar en lote ya existe (`requestPurchases`). Lo que sigue faltando es montar de golpe las órdenes de todos los proveedores de la cola: `createOrder` acepta varias líneas pero de **un** proveedor, así que hoy se crean de una en una.
  *Ojo:* al empezar la revisión los datos de demostración no tenían ninguna petición de compra sin tratar, así que la sección enseñaba solo esa tarjeta y el estado vacío «No hay nada pendiente de comprar»; los grupos no se veían aunque el código estuviera ahí. Es lo que llevó a apuntar aquí que faltaba `groupBySupplier`: no faltaba. A mitad de la sesión la base pasó a tener 11 peticiones de compra (PC-0001…), de modo que la tarjeta de «Sin material» se quedó vacía y la nueva selección múltiple no se pudo ver en el navegador.
- [ ] **«Nueva» → «Notificada»:** no se renombró el estado porque viaja en informes, PDFs, correos y fixtures de tests; hacerlo es un cambio transversal con su propia tanda.
- [ ] **Selector de fichas por página (10/25/50):** no se añadió; el tamaño sigue saliendo de la medida de la pantalla, ahora con densidad compacta por defecto.
- [ ] **Foco al disparador en las fichas laterales:** Radix no lo devuelve porque se abren sin `Trigger`; el cierre está garantizado por el botón «Cerrar» del pie fijo.
- ⚠️ **Riesgo conocido:** el alto de la lista se calcula con un presupuesto fijo (`100dvh - 25rem`). Si se añade otra franja a la cabecera de un módulo, hay que revisar ese número o volverá el scroll anidado.
- [ ] **La orden de compra no se pudo ver con datos reales:** la base de demostración no tiene ninguna orden, así que la ficha se verificó con `tests/purchasingView.test.tsx` (que pinta la pantalla y lee el recorrido completo), no en el navegador. Con una orden creada desde «Sin tratar» se vería en vivo.
- [ ] **La ficha de una petición archivada no se puede abrir desde la app:** el módulo Archivo lista lo archivado con un botón «Recuperar» y nada más, así que el tramo «Archivada» del recorrido solo se ve donde la ficha se abra (hoy, en las pruebas de componente). Abrirla en solo lectura desde la fila del archivo es el paso que falta para que se vea en pantalla; necesita pasarle `parts` y los adjuntos ya resueltos.
- [ ] **`blockedJourneySteps` de la petición depende de `heldFrom`:** quien la llame sin ese dato (por ejemplo desde una fila ligera) verá una suspendida situada en «pendiente».

---

## 6. Segunda tanda: muestra de compras para revisar la sección con datos

- **Fecha:** 2026-10-20 (cierre)
- **Objetivo:** que Compras se pueda revisar con contenido real —peticiones sin
  tratar de varios proveedores, una orden a medio recibir y otra cerrada, con sus
  albaranes— sin inventar filas a mano en la base.

### Archivos

| Archivo | Tipo | Qué hace |
|---|---|---|
| `src/lib/samplePurchasing.ts` | Nuevo (puro) | La muestra: grupos por proveedor (sin tratar, en orden, sin apartar) y el plan que los deja cuadrados contra el almacén (`planPurchasingSample`), más el PDF de cada albarán. |
| `src/convex/seedPurchasing.ts` | Nuevo | Acción `seedPurchasingDemoData` (guarda los albaranes) + consulta y mutación internas que escriben peticiones, compras, órdenes y recepciones. Exige `managePurchasing`. |
| `src/convex/_purchasing/helpers.ts` | Ampliación | `applyReception`: toda la recepción (stock, estados, peticiones entregables) en un solo sitio. |
| `src/convex/purchasing.ts` | Refactorización | `receive` pasa a ser permisos + avisos + `applyReception`; 150 líneas menos y sin reglas duplicadas. |
| `src/pages/dashboard/settings/WorkshopDataCard.tsx` | Mejora | Botón «Compras de ejemplo» y el párrafo que lo explica. |
| `tests/purchasingSample.test.ts` | Nuevo | 10 pruebas: cuentas del plan y la carga real en el backend. |
| `tests/arquitectura.test.ts` | Ajuste | `MAQUINAS` apunta la recepción al submódulo donde vive ahora (las reglas no cambian). |

### Decisiones

- **La muestra se calcula, no se copia:** lo que se compra es «lo que pide el
  técnico menos lo que hay» y las recepciones reparten **tanto por uno** de lo
  comprado, así que volver a cargarla no cruza las cuentas (una orden parcial
  sigue parcial, la completada sigue completa).
- **Las recepciones pasan por el mismo código que el botón:** la muestra no
  escribe stock ni estados por su cuenta.
- **El albarán se guarda como PDF de verdad** (maquetador `lib/pdf`), porque la
  recepción exige un archivo real y la ficha lo abre.

### Verificación

- `npx tsc --noEmit` → sin errores; `npx convex codegen` (con su `tsc`) → limpio.
- `npx vitest run` → **122 archivos, 1860 tests** (1789 pasando, 69 saltados, 1
  archivo saltado), exit 0 sin filtrar.
- `npm run lint` → 0 errores (29 avisos previos).
- En la app (1440×900, sesión de administrador): botón nuevo → aviso «11
  peticiones de compra en 3 órdenes · 3 recepciones»; Compras pasó de 11 a 18.
  Sin tratar: grupos de Mean Well, ARRI, ebm-papst, Ross Video, Neutrik, Klotz y
  Panduit (algunos se juntan con compras que ya había). Órdenes: OC-0003
  pendiente (Sennheiser 0/4), OC-0001 parcial (Belden 5/8, con «Recibiendo» y las
  dos líneas 1/4 y 4/4) y OC-0002 completada (Canare 60/60). Recepciones: tres,
  con sus albaranes; el PDF responde 200 `application/pdf`. «Sin material» deja
  PET-0118 (Sony) y PET-0119 (Blackmagic) sin apartar.
- Capturas: `screenshots/compras-ordenes.png`, `compras-orden-parcial.png`,
  `compras-recepciones.png`.

### Pendiente

- [ ] La muestra **no se carga sola** con «Cargar datos de ejemplo»: es un botón
  aparte, a propósito, para no meter compras en un taller que solo quería el
  catálogo.
- [ ] Los grupos de la cola se mezclan con las compras que ya hubiera de la misma
  referencia (ARRI, Neutrik, Ross Video, Panduit salen con 2–3 líneas): es lo
  correcto —se agrupa por proveedor— pero la muestra no controla lo que había
  antes.

---

## 7. Tercera tanda: la ficha del archivo, en solo lectura

- **Fecha:** 2026-10-20 (cierre)
- **Objetivo:** abrir desde el módulo Archivo la ficha de una petición o de una
  incidencia archivada, en solo lectura, para que el tramo «Archivada» del
  recorrido se vea en pantalla. Era la deuda apuntada al final de la sección 5.

### Archivos

| Archivo | Tipo | Qué hace |
|---|---|---|
| `src/lib/incidentJourney.ts` | Ampliación | `incidentJourney(status, { inWorkshop, archived })` añade el tramo «Archivada», igual que `requestJourney`: lo que estaba en su etapa de ahora pasa a hecho y el archivo es la etapa actual. |
| `src/pages/dashboard/ArchiveView.tsx` | Mejora | Botón «Ver ficha» en cada fila y las dos fichas abiertas en solo lectura; pide catálogo e inventario solo si se pueden leer. |
| `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx` | Corrección | Lo archivado se consulta, no se trabaja: `archived` desactiva el trabajo (`canWork`) y la coordinación con cambios (`canCoordinate`), enseña «Resuelta · en el archivo», el aviso de solo lectura y el motivo en «Siguiente». |
| `src/pages/dashboard/requests/components/RequestDetailSheet.tsx` | Ajuste | Los pasos del pie pasan a ser opcionales (la ficha del archivo no los pinta) y `showStock` deja fuera el stock cuando quien mira no puede leer el almacén. |
| `src/pages/dashboard/components/DashboardContent.tsx` | Ajuste | Pasa a `ArchiveView` los permisos de catálogo e inventario, el usuario y el salto a una petición. |
| `tests/incidentJourney.test.ts` | Tests | El recorrido de una incidencia archivada: cinco etapas, «Archivada» en curso y el cierre conservando su nombre. |

### Decisiones

- **La regla vive en la ficha, no en la vista que la abre:** `IncidentDetailSheet`
  se abre en solo lectura cuando `incident.archivedAt` existe, venga de donde
  venga. Así una archivada no se puede volver a tramitar por olvidarlo en otra
  pantalla, igual que ya pasaba con la petición.
- **Sin handlers no hay botón:** los pasos del pie de la petición son opcionales
  en vez de no-ops, que parecen hacer algo y no hacen nada.
- **Sin catálogo no se inventa el stock:** un técnico puede abrir la ficha del
  archivo aunque no tenga inventario; la línea se enseña sin la cifra en vez de
  decir «no está en catálogo».
- **Una ficha, dos públicos:** el archivo pide `spareParts.list` y
  `equipment.list` con `skip` cuando no hay permiso, para que la vista no rompa
  para quien solo consulta su propio historial.

### Verificación

- `npx tsc --noEmit` → 0 errores; `npx convex codegen` (con su `tsc`) → limpio.
- `npx vitest run` → **121 archivos, 1792 tests** (69 saltados, 1 archivo
  saltado), exit 0 sin filtrar.
- `npm run lint` → 0 errores (29 avisos previos).
- En la app (1440×900, administrador): Archivo → «Ver ficha» de PET-0014 →
  recorrido de 5 tramos con «Archivada ●», «Ahora (paso 5 de 5): Rechazada · en
  el archivo», el aviso de solo lectura y el pie únicamente con «Cerrar»; INC-0016
  → «Resuelta · en el archivo», «Archivada ●» y el pie con «Descargar» y
  «Cerrar». Sin errores en la consola.
- Capturas: `screenshots/archivo-ficha-peticion.png`,
  `screenshots/archivo-ficha-incidencia.png`.

### Pendiente

- [ ] Con un técnico (sin `viewInventory` ni `viewEquipment`) la ficha del
  archivo no se pudo comprobar en el navegador: hay que entrar con esa cuenta y
  mirar que la línea se enseña sin la cifra de stock y que el equipo del caso no
  se enlaza.
- [ ] El informe que se descarga desde la ficha de una incidencia archivada
  sigue firmándose con el nombre de quien lo exporta: es lo correcto, pero no se
  comprobó con una cuenta sin `viewAudit`.

---

## Handover — 20 oct 2026 · el buscador global llega al archivo

### Objetivo

Que lo archivado se encuentre desde la cabecera (Ctrl/⌘+K) y se abra en el
Archivo y en solo lectura, en vez de quedar fuera del buscador y convertir el
archivo en un callejón sin salida.

### Archivos

| Archivo | Tipo | Qué hizo |
| --- | --- | --- |
| `src/pages/dashboard/GlobalSearch.tsx` | Mejora | Pide las listas con `includeArchived: true` (y solo al usarse), marca cada resultado con `archived` y agrupa lo archivado en su propio bloque «Archivo · solo lectura». La referencia de incidencia solo se aplica si lo escrito tiene forma de referencia. |
| `src/pages/Dashboard.tsx` | Mejora | `handleSearchSelect` respeta `hit.archived`: abre la ficha en la pestaña Archivo en vez de en su cola, donde ya no está. |
| `src/pages/dashboard/ArchiveView.tsx` | Ajuste | Acepta una ficha inicial (`initialIncidentId`/`initialRequestId`) para abrirla al llegar desde el buscador. |
| `tests/globalSearch.test.tsx` | Tests | Lo archivado va en su grupo y llega marcado; lo vivo no se cuela en el grupo del archivo; `PET-0004` no saca `INC-0004`. |

### Decisiones

- **El grupo lo dice:** lo archivado no se mezcla con la cola. Elegir una ficha
  archivada desde el grupo de su módulo la abría donde ya no está.
- **Lo decide el panel, no el buscador:** el buscador solo informa
  (`archived: true`); a dónde se navega es cosa de `Dashboard`, que es quien
  conoce las pestañas.
- **La referencia no se adivina por el número:** `INC-0014` y `PET-0014`
  comparten número, así que solo se busca por referencia cuando lo escrito es
  `INC-…` o el número suelto.

### Verificación

- `npx tsc -b` → 0 errores. `npx vitest run` → **121 archivos, 1795 tests**
  (69 saltados), exit 0 sin filtrar. `npm run lint` → 0 errores (29 avisos).
- La prueba de `PET-0004`/`INC-0004` falla sin la guarda y pasa con ella
  (comprobado revirtiendo el arreglo y restaurándolo).
- En la app (1440×900, administrador): buscar «PET-0014» → grupo «Archivo ·
  solo lectura» → abrir → Archivo del taller con el recorrido de 5 tramos y el
  pie solo con «Cerrar»; «INC-0016» → «Resuelta · en el archivo» con
  «Descargar» y «Cerrar». «INC-0004» sigue abriendo en Incidencias. Sin errores
  en la consola.
- Capturas: `screenshots/buscador-archivo.png`,
  `screenshots/buscador-archivo-incidencia.png`.

### Pendiente

- [ ] Buscar con una cuenta de técnico: el grupo del archivo debería salir igual,
  pero no se comprobó en el navegador.
- [ ] Al elegir un resultado archivado se abre la ficha pero la pestaña Archivo no
  se filtra por esa referencia; queda en la lista general.

---

## Handover — 20 oct 2026 · la ficha de lo retirado, antes de recuperarla o borrarla

### Objetivo

Que lo que espera en la papelera del módulo Archivo se pueda leer entero —en
solo lectura— antes de decidir si vuelve o se borra, en vez de decidirlo con el
resumen de una línea.

### Archivos

| Archivo | Tipo | Qué hizo |
| --- | --- | --- |
| `src/convex/_incidents/trash.ts` | Mejora | Consulta `withdrawn`: la incidencia entera si está en la papelera, `null` si vive. Misma capacidad que `trash`. |
| `src/convex/_partRequests/trash.ts` | Mejora | Consulta `withdrawn`, con los adjuntos resueltos (URL) como la cola: la ficha los enseña. |
| `src/pages/dashboard/ArchiveView.tsx` | Mejora | Botón «Ver ficha» en cada fila de la papelera; pide el documento solo al abrirlo y lo pinta con las dos fichas del archivo. |
| `src/pages/dashboard/requests/components/RequestDetailSheet.tsx` | Corrección | `deletedAt` deja la ficha en solo lectura: sin pasos, con «Retirada · …», el motivo y el aviso de la papelera. |
| `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx` | Corrección | Igual: `deletedAt` apaga trabajo y coordinación, y el recorrido dice «retirada». |
| `tests/requestTrash.test.ts`, `tests/incidents.test.ts` | Tests | La ficha se lee entera solo mientras está en la papelera, y no la ve quien no ve la papelera. |
| `tests/withdrawnSheet.test.tsx` | Tests | Las dos fichas con un documento retirado: sin aprobar, entregar, archivar ni retirar, y con el motivo a la vista. |

### Decisiones

- **La regla vive en la ficha, no en la vista:** `deletedAt` en el documento basta
  para que la ficha se abra en solo lectura, venga de donde venga, igual que
  `archivedAt`.
- **El documento se pide al abrirlo:** la lista de la papelera sigue trayendo el
  resumen; el documento entero —con su expediente y sus repuestos— viaja solo al
  pulsar «Ver ficha».
- **Misma puerta que la papelera:** `withdrawn` pide la misma capacidad que
  `trash`, así que no amplía quién puede ver lo retirado.

### Verificación

- `npx tsc -b` → 0 errores; `npx vitest run` → **122 archivos, 1799 tests**
  (69 saltados), exit 0 sin filtrar; `npm run lint` → 0 errores (29 avisos).
- La prueba de solo lectura falla si se quita la guarda (comprobado revirtiendo
  `canManage` y restaurándolo).
- En la app: retirar PET-0006 con motivo → Archivo → «Ver ficha» en la papelera →
  recorrido «Pendiente · retirada», motivo con quién y cuándo, pie solo con
  «Cerrar». Recuperada después para dejar el taller como estaba. Sin errores en
  la consola.
- Capturas: `screenshots/papelera-archivo.png`,
  `screenshots/papelera-ficha-peticion-retirada.png`.

### Pendiente

- [ ] La ficha de una incidencia retirada no se comprobó en el navegador (se
  habría quedado «Retirada/Recuperada» en su historial): está cubierta por la
  prueba de componente y el camino es el mismo que el de la petición.
