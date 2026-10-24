import { describe, expect, it } from "vitest";
import {
  computeRequestActionFlags,
  sanitizeWithdrawReason,
} from "../src/pages/dashboard/requests/components/detail/actions/helpers";

describe("computeRequestActionFlags", () => {
  it("no ofrece ningún paso si la ficha se consulta en solo lectura", () => {
    const flags = computeRequestActionFlags("pending", false, true);
    expect(flags.canReject).toBe(false);
    expect(flags.canApprove).toBe(false);
    expect(flags.needsAssociation).toBe(false);
    expect(flags.canIssue).toBe(false);
    expect(flags.canHold).toBe(false);
    expect(flags.canResume).toBe(false);
    expect(flags.canReturnMaterial).toBe(false);
    expect(flags.canCancel).toBe(false);
    expect(flags.canArchive).toBe(false);
    expect(flags.canWithdraw).toBe(false);
  });

  it("permite aprobar o rechazar en estado pending con referencia", () => {
    const flags = computeRequestActionFlags("pending", false);
    expect(flags.canReject).toBe(true);
    expect(flags.canApprove).toBe(true);
    expect(flags.needsAssociation).toBe(false);
    expect(flags.canWithdraw).toBe(true);
  });

  it("marca needsAssociation si está en pending pero noReference es true", () => {
    const flags = computeRequestActionFlags("pending", true);
    expect(flags.canApprove).toBe(true);
    expect(flags.needsAssociation).toBe(true);
    expect(flags.canReject).toBe(true);
  });

  it("permite entregar material en estado approved", () => {
    const flags = computeRequestActionFlags("approved", false);
    expect(flags.canIssue).toBe(true);
  });

  it("permite devolver material en estado issued", () => {
    const flags = computeRequestActionFlags("issued", false);
    expect(flags.canReturnMaterial).toBe(true);
  });

  it("permite archivar peticiones cerradas o no activas", () => {
    const rejectedFlags = computeRequestActionFlags("rejected", false);
    expect(rejectedFlags.canArchive).toBe(true);

    const cancelledFlags = computeRequestActionFlags("cancelled", false);
    expect(cancelledFlags.canArchive).toBe(true);
  });

  it("permite suspender en pending o approved y reanudar en onHold", () => {
    const pendingFlags = computeRequestActionFlags("pending", false);
    expect(pendingFlags.canHold).toBe(true);
    expect(pendingFlags.canResume).toBe(false);

    const onHoldFlags = computeRequestActionFlags("onHold", false);
    expect(onHoldFlags.canHold).toBe(false);
    expect(onHoldFlags.canResume).toBe(true);
  });
});

describe("sanitizeWithdrawReason", () => {
  it("recorta espacios en blanco al inicio y al final", () => {
    expect(sanitizeWithdrawReason("  Duplicada por error   ")).toBe(
      "Duplicada por error",
    );
  });

  it("mantiene cadenas vacías intactas", () => {
    expect(sanitizeWithdrawReason("")).toBe("");
    expect(sanitizeWithdrawReason("   ")).toBe("");
  });
});
