import { LandingFooter } from "./landing/components/LandingFooter";
import { LandingHeader } from "./landing/components/LandingHeader";
import { LandingHero } from "./landing/components/LandingHero";
import { LandingStatsSection } from "./landing/components/LandingStatsSection";
import { WorkshopDoorsSection } from "./landing/components/WorkshopDoorsSection";

/**
 * Portada pública de Pulso Taller.
 * Orquestador principal con un sistema visual unificado de ritmo vertical,
 * adaptado para acceso rápido en dispositivos móviles y visión global en escritorio.
 */
export default function Landing() {
  return (
    <div
      id="inicio"
      className="min-h-screen bg-background bg-tech-grid text-foreground antialiased selection:bg-signal/20 selection:text-signal"
    >
      <LandingHeader />
      <LandingHero />
      <LandingStatsSection />
      <WorkshopDoorsSection />
      <LandingFooter />
    </div>
  );
}
