import { describe, expect, it } from "vitest";
import {
  BACKGROUND_JOB_STATUSES,
  canCancelJob,
  canTransitionJob,
  isActiveJobStatus,
  jobStatusLabel,
  jobTypeLabel,
} from "../src/lib/backgroundJobs";

describe("backgroundJobs domain", () => {
  it("identifica correctamente estados activos y cancelables", () => {
    expect(isActiveJobStatus("queued")).toBe(true);
    expect(isActiveJobStatus("running")).toBe(true);
    expect(isActiveJobStatus("completed")).toBe(false);
    expect(isActiveJobStatus("failed")).toBe(false);
    expect(isActiveJobStatus("cancelled")).toBe(false);

    expect(canCancelJob("queued")).toBe(true);
    expect(canCancelJob("running")).toBe(true);
    expect(canCancelJob("completed")).toBe(false);
  });

  it("valida transiciones válidas de estado", () => {
    expect(canTransitionJob("queued", "running")).toBe(true);
    expect(canTransitionJob("running", "completed")).toBe(true);
    expect(canTransitionJob("running", "failed")).toBe(true);
    expect(canTransitionJob("completed", "running")).toBe(false);
    expect(canTransitionJob("cancelled", "completed")).toBe(false);
  });

  it("expone etiquetas legibles para todos los estados y tipos principales", () => {
    for (const status of BACKGROUND_JOB_STATUSES) {
      expect(jobStatusLabel(status).length).toBeGreaterThan(0);
    }
    expect(jobTypeLabel("mail_auto_tag")).toBe("Autoetiquetado IA de correo");
    expect(jobTypeLabel("mail_sync")).toBe("Sincronización de correo");
    expect(jobTypeLabel("ai_memory_workshop")).toBe("Indexación de memoria IA");
  });
});
