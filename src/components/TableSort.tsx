/**
 * Las dos piezas que comparten las tablas del taller para poder ordenarse por
 * columna: la barra de orden —con su selector— y la cabecera que se pulsa.
 *
 * El ciclo vive en `lib/tableSort`; aquí solo se pinta y se le da voz: la
 * cabecera lleva su `aria-sort` —como manda la tabla— y el botón dice qué hará
 * la próxima pulsación, así que se puede ordenar también sin ver la flecha.
 *
 * La barra lleva un selector con **todas** las columnas. Hace falta porque la
 * tabla esconde columnas en pantallas estrechas (`hidden md:table-cell`): una
 * cabecera que no se ve no se puede pulsar, y esas columnas —el precio, la
 * ubicación, la marca— se quedaban sin forma de ordenar. El selector no mira lo
 * que se ve sino las columnas de la vista, así que llega a las ocultas. Y como
 * no todo el mundo adivina la flecha, también sirve para ordenar en pantalla
 * ancha.
 *
 * El selector elige la columna y el botón de al lado mueve el sentido: dos
 * controles, dos cosas. Es más honesto que hacer que volver a elegir la misma
 * columna invierta el sentido —la lista no diría nada, porque volver a elegir lo
 * ya elegido no cambia el valor que enseña— y funciona igual.
 */
export {
  TableSortBar,
  SortableTableHead,
  type TableSortBarProps,
  type SortableTableHeadProps,
} from "./tableSort/index";
