import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { isUpdateReady, subscribeUpdateReady } from "@/lib/pwaUpdate"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // El aviso de versión nueva ocupa el ancho de abajo en móvil: mientras está
  // visible, los avisos de sonner suben para no quedar debajo (ver
  // `components/PwaUpdateBanner.tsx`). En escritorio no hace falta —el aviso va
  // abajo a la izquierda y los avisos a la derecha—, así que solo se mueve el
  // desplazamiento móvil.
  const updateReady = useSyncExternalStore(
    subscribeUpdateReady,
    isUpdateReady,
    () => false,
  )

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      mobileOffset={updateReady ? { bottom: 92 } : undefined}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Radix deja el cuerpo con `pointer-events: none` mientras hay un
          // diálogo abierto. Sin esto, los avisos que salen con la ficha abierta
          // —los de notas y documentos, con su «Deshacer»— no se pueden pulsar.
          pointerEvents: "auto",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
