import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selectActiveSerie,
  filterActiveFunds,
  normalizeQuotas,
  toFundMetadata,
} from "../../src/scrapers/erni/parser.js";
import {
  fetchFondosActivos,
  fetchFondoInvertir,
} from "../../src/scrapers/erni/client.js";
import { pMap, toUtcMidnight } from "../../src/shared/utils.js";
import type { FondosActivosItem } from "../../src/scrapers/erni/types.js";

describe("ERNI Scraper - Parser y Normalización", () => {
  const mockFondoDigital: FondosActivosItem = {
    idFondo: "16",
    nombreFondo: "IF Oportunidad Soles FMIV",
    moneda: { idMoneda: "00", nombreMoneda: "Soles" },
    riesgo: { idRiesgo: 1, riesgo: "Bajo" },
    valorCuota: 159.208,
    valorCuotaFecha: "2026-10-07T00:00:00",
    tarifarios: [
      {
        comisionUnificada: 0.95,
        isDigital: false,
        serie: { serie: "A", isDigital: false },
      },
      {
        comisionUnificada: 0.9,
        isDigital: true,
        serie: { serie: "C", isDigital: true },
      },
    ],
  };

  const mockFondoPresencial: FondosActivosItem = {
    idFondo: "56",
    nombreFondo: "IF Portafolio Dinámico Soles FMIV",
    moneda: { idMoneda: "00", nombreMoneda: "Soles" },
    riesgo: { idRiesgo: 1, riesgo: "Bajo" },
    valorCuota: 146.956,
    valorCuotaFecha: "2026-10-07T00:00:00",
    tarifarios: [
      {
        comisionUnificada: 0.7,
        isDigital: false,
        serie: { serie: "A", isDigital: false },
      },
    ],
  };

  const mockFondoEstandar: FondosActivosItem = {
    idFondo: "04",
    nombreFondo: "IF Mediano Plazo Soles FMIV",
    moneda: { idMoneda: "00", nombreMoneda: "Soles" },
    riesgo: { idRiesgo: 2, riesgo: "Medio" },
    valorCuota: 233.937,
    valorCuotaFecha: "2026-10-07T00:00:00",
    tarifarios: [
      {
        comisionUnificada: 1.35,
        isDigital: false,
        serie: { serie: "-", isDigital: false },
      },
    ],
  };

  const mockFondoInactivo: FondosActivosItem = {
    idFondo: "41",
    nombreFondo: "FDF IF Real Estate Student Accommodation FMIV",
    moneda: { idMoneda: "10", nombreMoneda: "Dolares" },
    riesgo: { idRiesgo: 2, riesgo: "Medio" },
    valorCuota: 0,
    valorCuotaFecha: null,
    tarifarios: [],
  };

  it("selectActiveSerie prioriza la Serie C digital sobre la Serie A presencial", () => {
    const selected = selectActiveSerie(mockFondoDigital);
    expect(selected).not.toBeNull();
    expect(selected?.serie).toBe("C");
    expect(selected?.fee).toBe(0.9);
    expect(selected?.isDigital).toBe(true);
  });

  it("selectActiveSerie usa fallback a Serie A cuando no existe serie digital", () => {
    const selected = selectActiveSerie(mockFondoPresencial);
    expect(selected).not.toBeNull();
    expect(selected?.serie).toBe("A");
    expect(selected?.fee).toBe(0.7);
    expect(selected?.isDigital).toBe(false);
  });

  it("selectActiveSerie adopta Serie '-' en fondos estándar de serie única", () => {
    const selected = selectActiveSerie(mockFondoEstandar);
    expect(selected).not.toBeNull();
    expect(selected?.serie).toBe("-");
    expect(selected?.fee).toBe(1.35);
  });

  it("selectActiveSerie retorna null para fondos sin tarifarios", () => {
    const selected = selectActiveSerie(mockFondoInactivo);
    expect(selected).toBeNull();
  });

  it("filterActiveFunds descarta fondos inactivos o sin tarifarios", () => {
    const list = [mockFondoDigital, mockFondoInactivo, mockFondoEstandar];
    const filtered = filterActiveFunds(list);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((f) => f.idFondo)).toEqual(["16", "04"]);
  });

  it("normalizeQuotas convierte correctamente fechas a UTC medianoche y números", () => {
    const rawCuotas = [
      { fecha: "2026-09-30T15:30:00", numeroValorCuota: 233.6417 },
      { fecha: "2026-09-29T00:00:00", numeroValorCuota: 233.7134 },
    ];
    const normalized = normalizeQuotas("04", "-", rawCuotas);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].idFondo).toBe("04");
    expect(normalized[0].idSerie).toBe("-");
    expect(normalized[0].value).toBe(233.6417);
    expect(normalized[0].date.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("toFundMetadata genera metadatos válidos con moneda correcta", () => {
    const serieInfo = { serie: "C", fee: 0.9, isDigital: true };
    const meta = toFundMetadata(mockFondoDigital, serieInfo);

    expect(meta.idFondo).toBe("16");
    expect(meta.source).toBe("erni");
    expect(meta.currency).toBe("PEN");
    expect(meta.risk).toBe(1);
    expect(meta.fee).toBe(0.9);
    expect(meta.serie).toBe("C");
  });

  it("toFundMetadata remueve el prefijo 'FDF' dejando directamente 'IF ...'", () => {
    const fondoConFdf: FondosActivosItem = {
      idFondo: "78",
      nombreFondo: "FDF IF 49 Rendimiento Global 360 FMIV",
      moneda: { idMoneda: "10", nombreMoneda: "Dolares" },
      riesgo: { idRiesgo: 3, riesgo: "Medio" },
      tarifarios: [{ comisionUnificada: 1.2, isDigital: false, serie: { serie: "A", isDigital: false } }],
    };
    const meta = toFundMetadata(fondoConFdf, { serie: "A", fee: 1.2, isDigital: false });
    expect(meta.name).toBe("IF 49 Rendimiento Global 360 FMIV");
  });
});

describe("Utilidades - pMap y concurrencia", () => {
  it("pMap ejecuta funciones en paralelo respetando la concurrencia y preserva el orden", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const items = [10, 20, 30, 40, 50, 60];
    const result = await pMap(
      items,
      async (item) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return item * 2;
      },
      3
    );

    expect(result).toEqual([20, 40, 60, 80, 100, 120]);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("toUtcMidnight arroja error con entradas inválidas", () => {
    expect(() => toUtcMidnight("fecha-invalida")).toThrow("Fecha inválida");
  });
});

describe("Cliente HTTP ERNI - TypeBox Validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchFondosActivos valida correctamente respuestas conformes con TypeBox", async () => {
    const mockApiResponse = {
      code: "SUCCESS",
      data: [
        {
          idFondo: "01",
          nombreFondo: "IF Mixto Balanceado FMIV",
          moneda: { idMoneda: "10", nombreMoneda: "Dolares" },
          riesgo: { idRiesgo: 3, riesgo: "Alto" },
          valorCuota: 91.44,
          tarifarios: [{ comisionUnificada: 2, serie: { serie: "-" } }],
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      })
    );

    const result = await fetchFondosActivos("fake-key");
    expect(result.code).toBe("SUCCESS");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].idFondo).toBe("01");
  });

  it("fetchFondosActivos arroja error descriptivo ante un esquema no conforme", async () => {
    const corruptApiResponse = {
      code: "SUCCESS",
      // Falta 'data' requerido por el esquema
      fondos: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => corruptApiResponse,
      })
    );

    await expect(fetchFondosActivos("fake-key")).rejects.toThrow(
      "La respuesta de fondos-activos no coincide con el esquema esperado"
    );
  });

  it("fetchFondoInvertir valida respuesta de valores cuota con TypeBox", async () => {
    const mockInvertirResponse = {
      code: "SUCCESS",
      data: {
        listaValorCuota: [
          { fecha: "2026-09-30T00:00:00", numeroValorCuota: 233.64 },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockInvertirResponse,
      })
    );

    const result = await fetchFondoInvertir("fake-key", {
      idFondo: "04",
      serieCodigo: "-",
      tiempoMeses: 1,
    });

    expect(result.code).toBe("SUCCESS");
    expect(result.data.listaValorCuota).toHaveLength(1);
    expect(result.data.listaValorCuota[0].numeroValorCuota).toBe(233.64);
  });

  it("fetchFondoInvertir arroja error ante HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
    );

    await expect(
      fetchFondoInvertir("fake-key", { idFondo: "04", serieCodigo: "-" })
    ).rejects.toThrow("HTTP 500");
  });
});
