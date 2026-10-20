import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

/**
 * El área de una lista larga: el alto se ajusta a la pantalla y lo que no cabe se
 * desplaza dentro, con lo que hay que tener a la vista —la cabecera de una tabla,
 * el rótulo del día— pegado arriba.
 *
 * Existe porque una lista larga —aunque esté paginada— empuja sus barras de
 * desplazamiento y su pie hasta el final de la página: para llegar al botón de
 * «página siguiente» o para arrastrar la barra horizontal de una tabla ancha hay
 * que bajar hasta abajo del todo, perdiendo de vista la cabecera y sin saber por
 * qué columna se estaba mirando. Acotando el área a lo que mide la ventana, las
 * barras quedan al borde de la propia lista —a la vista— y la cabecera se queda
 * fija mientras se baja. El pie con la paginación va fuera del área, así que
 * tampoco se pierde.
 *
 * El alto se descuenta de la ventana (`100dvh` menos el marco de la ficha: la
 * barra de filtros, la de orden y el pie), así que se ajusta sola a la pantalla
 * que haya, y nunca baja de un mínimo legible. De ese tope sale, además, cuántas
 * filas caben: quien lo cuenta —`useRowsThatFit`— necesita la caja del área, y
 * por eso el área deja pasar su referencia.
 *
 * Al cambiar de tanda se vuelve arriba: quien acaba de pulsar «Página
 * siguiente» espera ver el principio de la siguiente, no el mismo trozo de
 * antes. Por eso el área sabe qué se está mirando —`resetKey`—: la página de una
 * tabla o de una cola de fichas, junto con lo que se busca y cómo se ordena.
 */
export function ListArea({
  resetKey,
  children,
  ref,
  maxHeightClass = "max-h-[calc(100dvh_-_25rem)]",
}: {
  /**
   * La tanda que se está viendo —la página, con lo que se busca y cómo se
   * ordena—: cuando cambia, el área vuelve arriba.
   */
  resetKey: number | string | null;
  children: ReactNode;
  /**
   * La caja del área, para quien tenga que medirla: de aquí sale el alto del que
   * se cuentan las filas.
   */
  ref?: Ref<HTMLDivElement>;
  /**
   * El tope de alto del área. Por defecto descuenta el marco de una ficha de
   * módulo; una lista que vive más abajo —dentro de una pestaña de ajustes—
   * necesita descontar más para que su pie quede a la vista.
   */
  maxHeightClass?: string;
}) {
  const area = useRef<HTMLDivElement | null>(null);

  // La caja es una para dos usos: por dentro, volver arriba al cambiar de tanda;
  // por fuera, dejar que se mida. Se juntan aquí porque el nodo es el mismo.
  const keepArea = useCallback(
    (node: HTMLDivElement | null) => {
      area.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    // Volver al principio del área, sin arrastrar el desplazamiento de la tanda
    // anterior. Con `scrollTop` basta y no depende de `scrollTo`, que los
    // navegadores simulados de las pruebas no tienen.
    if (area.current) area.current.scrollTop = 0;
  }, [resetKey]);

  return (
    <div
      ref={keepArea}
      // En `calc()` el signo lleva espacios a los lados, y en Tailwind se
      // escriben con guiones bajos: con `calc(100dvh-18rem)` la medida no se
      // entiende y el alto se queda sin acotar, que es justo lo que se viene a
      // arreglar aquí.
      //
      // El contenedor que trae la tabla de la biblioteca se desplaza en los dos
      // ejes (`overflow-x-auto` arrastra al otro eje), y un desplazamiento
      // anidado se queda con la cabecera pegada: se le quita para que el único
      // que desplaza sea esta área, que es quien acota el alto. La cabecera de
      // la tabla lleva su `sticky top-0` y se queda a la vista al recorrer las
      // filas; en las colas de fichas, lo que va dentro no se desplaza por su
      // cuenta y el cambio no se nota.
      className={`${maxHeightClass} min-h-[12rem] overflow-auto [scrollbar-gutter:stable] [&>div]:overflow-visible`}
    >
      {children}
    </div>
  );
}
