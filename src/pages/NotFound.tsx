import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center"
    >
      <div className="mx-auto max-w-md space-y-4">
        <p className="font-mono text-sm font-semibold tracking-wider text-signal">
          404
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Página no encontrada
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          La dirección que buscas no existe o ha cambiado.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button asChild variant="outline">
            <Link to="/">Volver al inicio</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">Ir al panel</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/reportar">Notificar incidencia</Link>
          </Button>
        </div>
      </div>
    </motion.main>
  );
}
