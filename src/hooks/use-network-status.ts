import { useEffect, useState } from "react";

/**
 * Si este dispositivo tiene red ahora mismo.
 *
 * `navigator.onLine` es lo único que el navegador sabe de verdad: dice si hay una
 * interfaz conectada, no si el servidor del taller responde. Sirve para lo que se
 * usa aquí —decidir si un aviso se manda ya o se guarda hasta que vuelva la
 * cobertura— y no para dar por hecho que una petición va a llegar.
 *
 * Se escuchan `online` y `offline` porque el dato cambia sin que nadie pregunte:
 * el técnico baja al sótano, el móvil pierde la Wi-Fi y la vuelve a coger.
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
