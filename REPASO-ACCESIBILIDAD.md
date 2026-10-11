# Repaso de contraste, foco y estados vacíos

Lo que se ha mirado, en el navegador y sobre la aplicación en marcha
(`http://localhost:5173`, backend local en `127.0.0.1:3210`), con los datos de
ejemplo que ya trae el taller. **No se ha cambiado ni una línea de la
aplicación**: esto es solo la constancia del repaso.

- **Contraste**: se midieron los colores reales de cada texto visible —color
  efectivo del texto compuesto sobre su fondo, resolviendo las capas con alfa
  hasta el primer fondo opaco— y se calcularon los ratios WCAG. Se pide 4,5:1
  para el texto normal y 3:1 para el grande (≥ 24 px, o ≥ 18,66 px con peso 700 o
  más). Los tokens del tema están en `oklch`, así que los colores se convirtieron
  a sRGB con un lienzo antes de calcular la luminancia.
- **Foco**: orden de tabulación real del documento, si cada parada se ve al
  enfocarla, y el contraste del propio indicador de foco (lo que pide WCAG 1.4.11
  para elementos gráficos: 3:1 frente a lo que tiene al lado).
- **Estados vacíos**: se llegó a ellos filtrando con una búsqueda que no
  encuentra nada (la vía honesta sin vaciar la base de datos), y se miró qué
  dice cada uno y si ofrece salida.

Cobertura: unas 1.700 piezas de texto medidas entre todas las vistas, y el
recorrido con teclado de la presentación, el panel, sus diez módulos, los
paneles flotantes y los formularios.

## 1. Contraste

### Lo que no llega

| Dónde                                             | Qué                                                                                                   | Ratio           | Tamaño   | Mínimo |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------- | -------- | ------ |
| Panel, pie de la barra lateral (todas las vistas) | `v1.0.0 (b7)` — `muted-foreground` al 60 %                                                            | **2,43:1**      | 11 px    | 4,5:1  |
| Presentación, Incidencias, Peticiones, Repuestos  | Distintivos destructivos: `Urgente`, `Agotado`, `Nueva` (`--destructive` sobre el fondo rojizo claro) | **3,87–3,97:1** | 10–12 px | 4,5:1  |
| Ficha de incidencia                               | `En taller` — ámbar sobre ámbar claro                                                                 | **4,43:1**      | 12 px    | 4,5:1  |
| Ajustes del taller                                | La dirección del archivo que ya no responde, en monoespaciada al 70 %                                 | **3,51:1**      | 10 px    | 4,5:1  |

Son **cuatro causas** repartidas por casi todas las vistas, no decenas de
problemas distintos:

1. El sello de versión del pie (`text-[11px]` con el color apagado al 60 %) falla
   en las once pantallas del panel a la vez. Subirle opacidad o tamaño lo
   resuelve de una.
2. El color `--destructive` (`oklch(0.577 0.245 27.325)`) no da 4,5:1 sobre los
   fondos rojizos que usa para los distintivos. Es el mismo token en los tres
   distintivos y en las dos pantallas (panel y presentación), así que se arregla
   en un sitio: oscurecerlo para que pase sobre su propio fondo claro, o pintar
   el distintivo con relleno sólido.
3. El ámbar de `En taller` está a un pelo (4,43:1): basta con bajarlo un punto de
   luminosidad.
4. El tamaño de 10 px no ayuda a nadie: es donde más fallan los ratios.

### Lo que sí pasa

Todo lo demás: en cada vista se midieron entre 63 y 145 textos y **solo salieron
los de arriba**. En particular pasan el texto principal y el secundario, los
títulos, los botones en sus tres variantes, las pestañas, las tablas, los
formularios, los paneles flotantes, la presentación entera (excepto los dos
distintivos) y las dos pantallas públicas: `/auth` (13 textos, 0 fallos, incluido
el mensaje de error de credenciales, que da 4,77:1) y `/reportar` (15 textos, 0
fallos).

### Tema oscuro

En la aplicación **no hay ninguna forma de activarlo**: la paleta `.dark` está
escrita en `src/index.css` pero nada le pone la clase al documento (el único
`useTheme` es el del aviso flotante, que no pinta el resto). Forzándola a mano
desde la consola, los tokens cambian (el fondo pasa a `oklch(0.155 0.015 250)`),
pero la pantalla se rompe: **58 de 102 textos quedan por debajo del mínimo**,
con casos de 1,1:1 (fondo claro con texto claro). Queda apuntado como lo que es:
una paleta sin estrenar y sin repasar, a medio camino.

## 2. Foco y navegación con teclado

### Lo que va bien

- **Orden de tabulación**: el del documento, sin sorpresas ni saltos raros —
  barra lateral (avisos, mensajes, búsqueda, los diez módulos, perfil, plegar,
  salir) → separador del ancho → contenido → paginación. Los botones
  deshabilitados se saltan solos, como debe ser.
- **Todo se opera con el teclado**: se entró al módulo de Peticiones con `Mayús`
  - `Tab` hasta él y `Enter`, y cambió de vista con el foco puesto donde estaba.
    Los botones se activan con `Enter` y con espacio.
- **Los diálogos y la ficha de incidencia atrapan el foco**: al abrirlos el foco
  entra en el contenido (en el formulario de perfil cae en el primer campo, que
  es lo suyo) y el tabulador ya no se escapa al fondo; `Esc` los cierra.
- **La búsqueda global tiene teclado de verdad**: `↓` y `↑` mueven la selección,
  `Enter` abre el resultado y `Esc` cierra el panel.
- **El separador de la barra lateral** (para el ancho) es la única pieza que
  dibuja su propio indicador de foco —una raya que se ensancha y pasa al color de
  señal—, y es también la única con contraste suficiente: **5,9:1**.
- Los formularios usan `<label for>` de verdad: los campos de `/auth` y de
  `/reportar` tienen su etiqueta asociada, y los de acceso llevan además
  `autocomplete` correcto (`email`, `current-password`).

### Lo que no

1. **El indicador de foco se ve poco en todas partes.** Es el hallazgo de fondo:
   existe (no hay ningún control sin indicador), pero su color es `--ring` —o
   `--signal` en algunos botones— al 20–50 % de opacidad, y eso deja el
   indicador entre **1,35:1 y 1,97:1** frente a lo que tiene al lado. Los
   importes, medidos parada por parada:
   - Presentación: las 13 paradas entre 1,93:1 y 1,94:1 (enlaces con el contorno
     del navegador a 0,8 px, y los botones con el anillo de 3 px).
   - Panel: las 46 paradas entre 1,35:1 (anillo `signal/20` sobre tarjeta) y
     1,97:1. La que peor sale es la caja de búsqueda global, con 1,35:1.
   - El contorno del navegador hereda su color de la regla global
     `* { outline-ring/50 }` de `index.css`, así que también va al 50 %.
     Con el anillo a opacidad plena pasaría de sobra; tal como está, hay que
     mirarlo dos veces para saber dónde estás, sobre todo en la barra lateral.
2. **El panel de notificaciones no es modal, aunque se anuncia como diálogo.**
   Tiene `role="dialog"` y `aria-label="Notificaciones"`, 18 paradas dentro… pero
   al abrirlo el foco **no entra** (se queda donde estaba) y el fondo **no queda
   inerte**: el tabulador sigue recorriendo la barra lateral por detrás. Con
   ratón no se nota; con teclado, hay que recorrer la página entera para llegar a
   lo que se acaba de abrir. `Esc` sí lo cierra.
3. **Al cerrar, el foco no vuelve a donde estaba.** Medido con teclado de verdad
   (enfocar la tarjeta, `Enter`, `Esc`): el foco se queda en `<body>`, y lo mismo
   al cerrar «Editar perfil». La siguiente pulsación de `Tab` empieza otra vez
   por el principio del documento. Los diálogos de Radix permiten devolverlo al
   disparador; aquí no lo está haciendo.
4. **Falta un enlace «saltar al contenido».** En el panel, el contenido empieza
   en la parada **18** (contando los diez módulos, el perfil y el separador):
   quien navega con teclado recorre toda la barra lateral cada vez, también en
   cada cambio de pantalla. En la presentación son 13 paradas hasta el final, sin
   atajos.
5. **El botón de cerrar de la ficha de incidencia se llama `Close`**, en inglés,
   dentro de una aplicación en español. Aparece junto a un `Cerrar` propio: son
   dos cierres, uno sin traducir.
6. **El mensaje de error del acceso no se anuncia.** Cuando las credenciales
   fallan, el texto aparece (y su contraste pasa), pero el campo no queda
   marcado (`aria-invalid` vacío), no hay `aria-describedby` que lo apunte y el
   párrafo no tiene `role="alert"` ni `aria-live`: quien use lector de pantalla
   no se entera de nada.
7. Menores, para tenerlos apuntados: la barra del editor de texto enriquecido
   suma **nueve paradas seguidas** en el tabulador de `/reportar` (que tiene 19 en
   total) y no usa `role="toolbar"` con flechas, que es lo que se espera de una
   barra así —sus botones, eso sí, llevan `aria-label` y `aria-pressed`—; los
   dos botones que cambian entre «Contraseña» y «Código por email» son botones
   sueltos, sin `role="tablist"`; y `src/components/ui/sidebar.tsx` —con su atajo
   `Ctrl/Cmd+B`— no se importa desde ninguna parte: es código muerto que puede
   confundir a quien busque por qué ese atajo no hace nada.

## 3. Estados vacíos

Todos los módulos los tienen, y están bien hechos: **icono, qué pasa y qué
puedes hacer**, y siempre con una salida a mano.

| Módulo                           | Cómo se llegó          | Qué dice                                                                       | Salida                  |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------ | ----------------------- |
| Incidencias                      | Buscar `zzzz-qq-9`     | «Ninguna incidencia coincide con «…»»                                          | `Limpiar la búsqueda`   |
| Peticiones                       | Buscar `zzzz-qq-9`     | «Ninguna petición coincide con «…»»                                            | `Limpiar la búsqueda`   |
| Repuestos                        | Buscar `zzzz-qq-9`     | «Sin resultados» + «No hay repuestos que coincidan con «…»»                    | `Limpiar filtros`       |
| Equipos                          | Buscar `zzzz-qq-9`     | «Sin resultados» + «Ningún equipo coincide con «…»»                            | `Limpiar búsqueda`      |
| Manuales                         | Buscar `zzzz-qq-9`     | «Sin resultados» + «Ningún manual coincide con los filtros»                    | `Limpiar filtros`       |
| Archivo                          | Buscar `zzzz-qq-9`     | «Nada en el archivo coincide con «…»» + «Prueba con otra referencia…»          | `Limpiar la búsqueda`   |
| Auditoría                        | Buscar `zzzz-qq-9`     | «Ningún movimiento con estos filtros» + «Hay 147 movimientos en el historial…» | `Ver todo el historial` |
| Ajustes, imágenes del formulario | Estado real del taller | «No hay nada pendiente: la limpieza de esta noche no tiene nada que barrer…»   | —                       |
| Búsqueda global                  | Buscar `zzzz-qq-9`     | «Sin resultados para «zzzz-qq-9»»                                              | —                       |

Detalles que merecen decirse a favor:

- **Distinguen «no hay datos» de «no hay coincidencias».** El código tiene los
  dos mensajes para cada lista («El catálogo está vacío» frente a «Sin
  resultados»; «Todavía no hay manuales» frente a «Ningún manual coincide»), que
  es exactamente lo que se echa de menos en otras aplicaciones.
- La de Auditoría es la mejor del repaso: además de decir que no hay nada, dice
  **cuántos movimientos hay** en total y ofrece verlos todos.
- La de Ajustes no inventa: si no hay nada que purgar, lo dice y explica cuándo
  aparecería algo.

No se pudieron ver en el navegador (haría falta vaciar datos, y no se ha
tocado): el taller recién instalado —«El taller todavía no tiene datos», el
estado de la tarjeta de arranque—, el archivo sin nada, la lista de usuarios sin
usuarios y las conversaciones o los avisos sin nada. Los mensajes existen en el
código y siguen el mismo patrón que los de arriba.

## 4. Lo que conviene hacer primero

Por orden de lo que más se nota al usar el teclado:

1. **Subir el contraste del indicador de foco** a `--ring` pleno (y quitar el
   `outline-ring/50` de la regla global), que es un cambio de una línea en los
   tokens y arregla las 59 paradas de golpe.
2. **Añadir «saltar al contenido»** al panel: un enlace que aparece al recibir el
   foco y lleva al `main`.
3. **Devolver el foco al disparador** al cerrar fichas y diálogos.
4. **Hacer modal el panel de notificaciones** o, si no lo es a propósito,
   quitarle el `role="dialog"` y abrirlo con el foco dentro.
5. **Los cuatro contrastes de texto** de la tabla: el sello de versión, el color
   destructivo y los dos tamaños de 10–11 px.

## 5. Lo que este repaso no cubre

- El **tema oscuro** no se puede usar, así que la medición de arriba es un
  forzado a mano, no una pantalla real.
- Los fondos con **degradado** (la rejilla del hero y el brillo de señal) se
  aproximan con el primer fondo opaco: hay dos o tres avisos del medidor sobre
  esas zonas que habría que confirmar a ojo si se tocan.
- Falta el repaso con **lector de pantalla** de verdad (aquí se han mirado los
  roles y atributos del DOM, no cómo suena).
- Falta el repaso de **zoom al 200 %** y en pantallas estrechas.
