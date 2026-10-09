import { describe, it, expect } from "vitest";
import { parseTeaQueryParams, TeaChartDataSchema, HealthResponseSchema, ApiErrorResponseSchema } from "../../src/api/types.js";
import { capitalize, colorFromKey } from "../../src/shared/utils.js";
import { Value } from "@sinclair/typebox/value";

describe("API Types y Query Params Validation", () => {
  it("debe aceptar parámetros vacíos o undefined aplicando defaults vacíos", () => {
    const result = parseTeaQueryParams(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});

    const resultNull = parseTeaQueryParams(null);
    expect(resultNull.success).toBe(true);
    expect(resultNull.data).toEqual({});

    const resultEmpty = parseTeaQueryParams({});
    expect(resultEmpty.success).toBe(true);
    expect(resultEmpty.data).toEqual({});
  });

  it("debe parsear y sanear parámetros válidos", () => {
    const result = parseTeaQueryParams({
      days: "45",
      currency: "pen",
      risk: "3",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      days: 45,
      currency: "PEN",
      risk: 3,
    });
  });

  it("debe rechazar days no entero o menor a 1", () => {
    const resNegative = parseTeaQueryParams({ days: "-5" });
    expect(resNegative.success).toBe(false);

    const resZero = parseTeaQueryParams({ days: "0" });
    expect(resZero.success).toBe(false);

    const resNonNumber = parseTeaQueryParams({ days: "treinta" });
    expect(resNonNumber.success).toBe(false);
    expect(resNonNumber.errors?.[0]).toContain("número entero válido");

    const resFloat = parseTeaQueryParams({ days: "30.5" });
    expect(resFloat.success).toBe(false);
  });

  it("debe rechazar currency inválida", () => {
    const resEur = parseTeaQueryParams({ currency: "EUR" });
    expect(resEur.success).toBe(false);
    expect(resEur.errors?.[0]).toContain("currency");
  });

  it("debe rechazar risk fuera de rango (1 a 7)", () => {
    const resHigh = parseTeaQueryParams({ risk: "8" });
    expect(resHigh.success).toBe(false);

    const resLow = parseTeaQueryParams({ risk: "0" });
    expect(resLow.success).toBe(false);
  });

  it("debe validar esquemas de respuesta operacional Health y Error", () => {
    const healthOk = { status: "OK", timestamp: new Date().toISOString() };
    expect(Value.Check(HealthResponseSchema, healthOk)).toBe(true);

    const healthDown = { status: "Mongo unavailable", timestamp: new Date().toISOString() };
    expect(Value.Check(HealthResponseSchema, healthDown)).toBe(true);

    const err = { error: "Parámetro inválido", timestamp: new Date().toISOString(), details: ["días < 1"] };
    expect(Value.Check(ApiErrorResponseSchema, err)).toBe(true);
  });
});

describe("Utilidades visuales (shared/utils)", () => {
  it("debe capitalizar cadenas de texto", () => {
    expect(capitalize("fondo mutuo acciones")).toBe("Fondo Mutuo Acciones");
    expect(capitalize("BBVA PERU CASH")).toBe("Bbva Peru Cash");
    expect(capitalize("")).toBe("");
  });

  it("debe generar colores determinísticos consistentes a partir de la clave", () => {
    const c1 = colorFromKey("bbva:Fondo_Cash");
    const c2 = colorFromKey("bbva:Fondo_Cash");
    expect(c1).toEqual(c2);
    expect(c1.backgroundColor).toMatch(/^hsla\(\d+, 70%, 50%, 0.2\)$/);
    expect(c1.borderColor).toMatch(/^hsla\(\d+, 70%, 40%, 1\)$/);

    const c3 = colorFromKey("tyba:Parker_Acciones");
    expect(c3).not.toEqual(c1);
  });
});
