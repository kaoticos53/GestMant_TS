import { describe, expect, it } from "vitest";
import { computeIncidentActionStates } from "@/pages/dashboard/incidents/components/detail/actions/helpers";

describe("incidentActionButtons visibility helpers", () => {
  it("calcula visibilidades para una incidencia en estado reported", () => {
    const states = computeIncidentActionStates({
      status: "reported",
      canWork: true,
      canCoordinate: true,
      inWorkshop: false,
    });

    expect(states.showSelfAssign).toBe(true);
    expect(states.showVerify).toBe(false);
    expect(states.showPartRequests).toBe(false);
    expect(states.showArchive).toBe(false);
    expect(states.showSendExternal).toBe(false);
    expect(states.showReturnExternal).toBe(false);
    expect(states.showCloseResolved).toBe(false);
  });

  it("calcula visibilidades para una incidencia assigned lista para verificar y derivar", () => {
    const states = computeIncidentActionStates({
      status: "assigned",
      canWork: true,
      canCoordinate: false,
      inWorkshop: false,
    });

    expect(states.showSelfAssign).toBe(false);
    expect(states.showVerify).toBe(true);
    expect(states.showSendExternal).toBe(true);
    expect(states.showCloseResolved).toBe(false);
  });

  it("calcula visibilidades para una incidencia en reparación admitiendo peticiones de repuesto", () => {
    const states = computeIncidentActionStates({
      status: "repairing",
      canWork: true,
      canCoordinate: false,
      inWorkshop: true,
    });

    expect(states.showPartRequests).toBe(true);
    expect(states.showSelfAssign).toBe(false);
    expect(states.showVerify).toBe(false);
  });

  it("calcula visibilidades para una incidencia en reparación externa", () => {
    const states = computeIncidentActionStates({
      status: "externalRepair",
      canWork: true,
      canCoordinate: false,
      inWorkshop: false,
    });

    expect(states.showSendExternal).toBe(false);
    expect(states.showReturnExternal).toBe(true);
  });

  it("calcula visibilidades para una incidencia resuelta lista para archivar", () => {
    const states = computeIncidentActionStates({
      status: "resolved",
      canWork: false,
      canCoordinate: true,
      inWorkshop: false,
    });

    expect(states.showArchive).toBe(true);
    expect(states.showPartRequests).toBe(false);
  });
});
