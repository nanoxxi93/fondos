import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/server.js";
import { isMongoReady } from "../src/shared/db.js";
import { calculateTea } from "../src/domain/tea.js";
import { handler as erniHandler } from "../src/scrapers/erni/handler.js";
import { handler as bbvaHandler } from "../src/scrapers/bbva/handler.js";
import { handler as tybaHandler } from "../src/scrapers/tyba/handler.js";

vi.mock("../src/shared/db.js", () => ({
  isMongoReady: vi.fn(),
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/domain/tea.js", () => ({
  calculateTea: vi.fn(),
}));

vi.mock("../src/scrapers/erni/handler.js", () => ({
  handler: vi.fn(),
}));

vi.mock("../src/scrapers/bbva/handler.js", () => ({
  handler: vi.fn(),
}));

vi.mock("../src/scrapers/tyba/handler.js", () => ({
  handler: vi.fn(),
}));

describe("Express Server (src/server.ts)", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.SCRAPE_TOKEN;

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("debe responder 200 OK en GET /health cuando Mongo está listo", async () => {
    vi.mocked(isMongoReady).mockReturnValue(true);

    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("OK");
  });

  it("debe responder 503 en GET /health cuando Mongo no está listo", async () => {
    vi.mocked(isMongoReady).mockReturnValue(false);

    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toBe("Mongo unavailable");
  });

  it("debe servir la página HTML completa en GET /", async () => {
    vi.mocked(calculateTea).mockResolvedValue({
      labels: ["2026-10-01"],
      datasets: [
        {
          label: "BBVA Soles",
          data: [0],
          backgroundColor: "rgba(0,0,0,0.1)",
          borderColor: "rgba(0,0,0,1)",
          borderWidth: 1,
          pointRadius: 1,
          hidden: true,
          meta: {
            index: 0,
            idFondo: "BBVA-1",
            source: "bbva",
            value: 3.5,
            firstValue: 10,
            lastValue: 10.35,
            fee: 1,
            currency: "PEN",
            risk: 2,
          },
        },
      ],
    });

    const res = await fetch(`${baseUrl}/?days=60&currency=PEN&risk=3`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Fondos Mutuos - últimos 60 días");
    expect(html).toContain("BBVA Soles");
    expect(calculateTea).toHaveBeenCalledWith({
      days: 60,
      currency: "PEN",
      risk: 3,
    });
  });

  it("debe responder con JSON de series y cabecera de caché en GET /api/tea", async () => {
    const mockChartData = {
      labels: ["2026-10-01", "2026-10-02"],
      datasets: [],
    };
    vi.mocked(calculateTea).mockResolvedValue(mockChartData);

    const res = await fetch(`${baseUrl}/api/tea?days=15`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toContain("public, max-age=3600");

    const data = (await res.json()) as { labels: string[] };
    expect(data.labels).toEqual(["2026-10-01", "2026-10-02"]);
    expect(calculateTea).toHaveBeenCalledWith({
      days: 15,
      currency: undefined,
      risk: undefined,
    });
  });

  it("debe exigir SCRAPE_TOKEN si está configurado en variables de entorno", async () => {
    process.env.SCRAPE_TOKEN = "secreto-123";

    // Petición sin token -> 401
    const resNoToken = await fetch(`${baseUrl}/api/erni`);
    expect(resNoToken.status).toBe(401);

    // Petición con token incorrecto -> 401
    const resWrong = await fetch(`${baseUrl}/api/erni?token=invalido`);
    expect(resWrong.status).toBe(401);

    // Petición con token correcto en query param -> 200
    vi.mocked(erniHandler).mockResolvedValue({
      statusCode: 200,
      source: "erni",
      timestamp: new Date().toISOString(),
      summary: {
        totalFondos: 10,
        procesados: 10,
        omitidos: 0,
        fallidos: 0,
        cuotasSincronizadas: 100,
      },
    });

    const resValid = await fetch(`${baseUrl}/api/erni?token=secreto-123&days=7`);
    expect(resValid.status).toBe(200);
    expect(erniHandler).toHaveBeenCalledWith({ months: 1 });
  });

  it("debe invocar handler de BBVA en GET /api/bbva", async () => {
    vi.mocked(bbvaHandler).mockResolvedValue({
      statusCode: 200,
      source: "bbva",
      timestamp: new Date().toISOString(),
      summary: {
        totalFondos: 21,
        procesados: 21,
        fallidos: 0,
        cuotasSincronizadas: 150,
      },
    });

    const res = await fetch(`${baseUrl}/api/bbva?days=45`);
    expect(res.status).toBe(200);
    expect(bbvaHandler).toHaveBeenCalledWith({ days: 45 });
  });

  it("debe invocar handler de Tyba en GET /api/tyba pasando cabeceras y parámetros", async () => {
    vi.mocked(tybaHandler).mockResolvedValue({
      statusCode: 200,
      source: "tyba",
      timestamp: new Date().toISOString(),
      summary: {
        totalFondos: 30,
        procesados: 30,
        fallidos: 0,
        cuotasSincronizadas: 300,
      },
    });

    const res = await fetch(`${baseUrl}/api/tyba?days=30&all=true`, {
      headers: {
        authorization: "Bearer mi-jwt-token",
        "x-app-proof": "mi-proof",
        "x-refresh-token": "mi-refresh",
      },
    });

    expect(res.status).toBe(200);
    expect(tybaHandler).toHaveBeenCalledWith({
      authorization: "Bearer mi-jwt-token",
      xAppProof: "mi-proof",
      refreshToken: "mi-refresh",
      days: 30,
      all: true,
    });
  });

  it("debe manejar errores de cálculo respondiendo con HTTP 500", async () => {
    vi.mocked(calculateTea).mockRejectedValue(new Error("Fallo de base de datos"));

    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("Error interno");
  });
});
