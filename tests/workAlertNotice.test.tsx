import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Id } from "@/convex/_generated/dataModel";
import {
  WorkAlertNotice,
  type StaleWorkEntry,
} from "@/pages/dashboard/WorkAlertNotice";
import type { RoleKey } from "@/lib/roles";
import type { IncidentStatus } from "@/lib/workshop";

/**
 * Pruebas de render del aviso de trabajo sin constancia: lo que importa aquí es
 * que el aviso se pinte —o no— según la audiencia configurada. El componente se
 * pinta con el renderizador de React (markup), así que se comprueba el HTML
 * real y no una copia de la regla.
 */

/** Incidencia parada de mentira: solo lo que el aviso llega a enseñar. */
function staleEntry(
  reference: string,
  {
    status = "assigned",
    assigneeName = "Nuria Cano",
    days = 5,
  }: {
    status?: IncidentStatus;
    assigneeName?: string;
    days?: number;
  } = {},
): StaleWorkEntry {
  return {
    incident: {
      _id: reference.toLowerCase() as Id<"incidents">,
      reference,
      status,
      assigneeName,
    },
    days,
  };
}

/** Cuántas fichas paradas se le pasan al aviso, de la más parada a la menos. */
function staleWork(count = 1): StaleWorkEntry[] {
  return Array.from({ length: count }, (_, index) =>
    staleEntry(`INC-000${index + 1}`, { days: 9 - index }),
  );
}

/** Pinta el aviso con la audiencia y el rol que se quieran probar. */
function renderNotice({
  role,
  audience,
  days = 3,
  work = staleWork(),
  dismissed = false,
  canOpenSettings = false,
}: {
  role: RoleKey | null | undefined;
  audience: readonly RoleKey[];
  days?: number;
  work?: StaleWorkEntry[];
  dismissed?: boolean;
  canOpenSettings?: boolean;
}): string {
  return renderToStaticMarkup(
    <WorkAlertNotice
      role={role}
      audience={audience}
      days={days}
      staleWork={work}
      dismissed={dismissed}
      canOpenSettings={canOpenSettings}
      onOpenIncident={() => {}}
      onOpenSettings={() => {}}
      onDismiss={() => {}}
    />,
  );
}

/** Texto que confirma que el aviso está pintado (vale en singular y plural). */
const VISIBLE = "días en curso sin que su técnico anote nada";

describe("aviso de trabajo sin constancia: a quién se le pinta", () => {
  it("se pinta para un rol que está en la audiencia", () => {
    const html = renderNotice({
      role: "manager",
      audience: ["admin", "manager"],
    });

    expect(html).toContain(VISIBLE);
    expect(html).toContain("INC-0001");
  });

  it("no se pinta para un rol que se queda fuera de la audiencia", () => {
    // Coordina incidencias, pero quien coordina decidió avisar solo a otro rol.
    const html = renderNotice({ role: "admin", audience: ["manager"] });

    expect(html).toBe("");
  });

  it("con la audiencia vacía no lo ve nadie", () => {
    for (const role of ["admin", "manager", "technician"]) {
      expect(renderNotice({ role, audience: [] })).toBe("");
    }
  });

  it("un rol que no coordina sí lo ve si quien coordina lo añade", () => {
    const html = renderNotice({ role: "technician", audience: ["technician"] });

    expect(html).toContain(VISIBLE);
  });

  it("los roles personalizados reparten igual que los de serie", () => {
    expect(
      renderNotice({ role: "taller-av", audience: ["taller-av"] }),
    ).toContain(VISIBLE);
    expect(renderNotice({ role: "taller-av", audience: ["manager"] })).toBe("");
  });

  it("sin rol conocido no se arriesga a enseñarlo", () => {
    expect(renderNotice({ role: undefined, audience: ["admin"] })).toBe("");
    expect(renderNotice({ role: null, audience: ["admin"] })).toBe("");
  });
});

describe("aviso de trabajo sin constancia: cuándo se pinta", () => {
  it("sin trabajo parado no hay nada que avisar", () => {
    const html = renderNotice({
      role: "admin",
      audience: ["admin"],
      work: [],
    });

    expect(html).toBe("");
  });

  it("un aviso ya cerrado no se repite", () => {
    const html = renderNotice({
      role: "admin",
      audience: ["admin"],
      dismissed: true,
    });

    expect(html).toBe("");
  });
});

describe("aviso de trabajo sin constancia: qué enseña", () => {
  it("cuenta las fichas paradas y usa el margen configurado", () => {
    const html = renderNotice({
      role: "admin",
      audience: ["admin"],
      days: 7,
      work: staleWork(2),
    });

    expect(html).toContain("2 incidencias llevan días en curso");
    expect(html).toContain("Llevan 7 días o más en curso");
  });

  it("con una sola ficha lo dice en singular y con su margen de un día", () => {
    const html = renderNotice({
      role: "admin",
      audience: ["admin"],
      days: 1,
      work: [staleEntry("INC-0009", { days: 1 })],
    });

    expect(html).toContain("Una incidencia lleva días en curso");
    expect(html).toContain("Llevan 1 día o más en curso");
  });

  it("enseña tres referencias y cuenta las que no caben", () => {
    const html = renderNotice({
      role: "admin",
      audience: ["admin"],
      work: staleWork(5),
    });

    expect(html).toContain("INC-0001");
    expect(html).toContain("INC-0003");
    expect(html).not.toContain("INC-0004");
    expect(html).toContain("Y 2 más esperando en la cola.");
    expect(html).toContain("Asignada · Nuria Cano · 9 días en curso");
  });

  it("el ajuste del margen y la audiencia solo se ofrece a quien puede", () => {
    const withoutPermission = renderNotice({
      role: "admin",
      audience: ["admin"],
      canOpenSettings: false,
    });
    const withPermission = renderNotice({
      role: "admin",
      audience: ["admin"],
      canOpenSettings: true,
    });

    expect(withoutPermission).not.toContain("Ajustar el margen");
    expect(withPermission).toContain("Ajustar el margen y a quién le avisa");
  });
});
