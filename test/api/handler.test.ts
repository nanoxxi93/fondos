import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "../../src/api/handler.js";
import { isMongoReady } from "../../src/shared/db.js";
import { calculateTea } from "../../src/domain/tea.js";

vi.mock("../../src/shared/db.js", () => ({
  isMongoReady: vi.fn(),
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/domain/tea.js", () => ({
  calculateTea: vi.fn(),
}));

describe("Lambda API Handler (src/api/handler.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 204 con cabeceras CORS ante solicitudes OPTIONS", async () => {
    const res = await handler({
      requestContext: { http: { method: "OPTIONS" } },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
    expect(res.body).toBe("");
  });

  it("debe responder 405 Method Not Allowed con cabecera Allow ante métodos no permitidos", async () => {
    const res = await handler({
      rawPath: "/api/tea",
      requestContext: { http: { method: "POST" } },
    });

    expect(res.statusCode).toBe(405);
    expect(res.headers["Allow"]).toBe("GET, OPTIONS");
    expect(res.headers["Cache-Control"]).toContain("no-store");

    const body = JSON.parse(res.body);
    expect(body.error).toContain("POST");
  });

  it("debe responder 200 en GET /health cuando MongoDB está disponible", async () => {
    vi.mocked(isMongoReady).mockReturnValue(true);

    const res = await handler({
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("OK");
    expect(body.timestamp).toBeDefined();
  });

  it("debe intentar conectar a MongoDB en cold start si aún no está conectado y responder 200", async () => {
    vi.mocked(isMongoReady)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const res = await handler({
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("OK");
  });

  it("debe responder 503 en GET /health cuando MongoDB no está disponible", async () => {
    vi.mocked(isMongoReady).mockReturnValue(false);

    const res = await handler({
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(503);
    expect(res.headers["Cache-Control"]).toContain("no-store");
    const body = JSON.parse(res.body);
    expect(body.status).toBe("Mongo unavailable");
  });

  it("debe responder 200 en GET / y GET /api/tea con cabecera de caché de 1 hora", async () => {
    const mockChartData = {
      labels: ["2026-10-01", "2026-10-02"],
      datasets: [
        {
          label: "Fondo Alpha",
          data: [0, 5],
          backgroundColor: "hsla(100, 70%, 50%, 0.2)",
          borderColor: "hsla(100, 70%, 40%, 1)",
          borderWidth: 1,
          pointRadius: 1,
          hidden: true,
          meta: {
            index: 0,
            idFondo: "ALPHA",
            source: "bbva",
            value: 4.8,
            firstValue: 100,
            lastValue: 105,
            fee: 1.0,
            currency: "PEN",
            risk: 2,
          },
        },
      ],
    };

    vi.mocked(calculateTea).mockResolvedValue(mockChartData as any);

    const res = await handler({
      rawPath: "/api/tea",
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { days: "15", currency: "PEN", risk: "3" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe(
      "public, max-age=3600, stale-while-revalidate=86400"
    );
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");

    expect(calculateTea).toHaveBeenCalledWith({
      days: 15,
      currency: "PEN",
      risk: 3,
    });

    const body = JSON.parse(res.body);
    expect(body.labels).toEqual(["2026-10-01", "2026-10-02"]);
    expect(body.datasets).toHaveLength(1);
  });

  it("debe adoptar parámetros por defecto cuando no se pasan query params", async () => {
    vi.mocked(calculateTea).mockResolvedValue({ labels: [], datasets: [] });

    const res = await handler({
      rawPath: "/",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(200);
    expect(calculateTea).toHaveBeenCalledWith({});
  });

  it("debe responder 400 Bad Request con no-store ante parámetros inválidos", async () => {
    const res = await handler({
      rawPath: "/api/tea",
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { days: "-10", currency: "EUR" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers["Cache-Control"]).toContain("no-store");

    const body = JSON.parse(res.body);
    expect(body.error).toContain("Parámetros de consulta inválidos");
    expect(body.details).toBeDefined();
    expect(calculateTea).not.toHaveBeenCalled();
  });

  it("debe responder 404 Not Found ante rutas no soportadas", async () => {
    const res = await handler({
      rawPath: "/ruta-desconocida",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers["Cache-Control"]).toContain("no-store");
  });

  it("debe responder 500 Internal Server Error con no-store si ocurre un error en el cálculo", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(calculateTea).mockRejectedValue(new Error("Fallo de conexión a Mongo"));

    const res = await handler({
      rawPath: "/api/tea",
      requestContext: { http: { method: "GET" } },
    });

    expect(res.statusCode).toBe(500);
    expect(res.headers["Cache-Control"]).toContain("no-store");

    const body = JSON.parse(res.body);
    expect(body.error).toBe("Error interno del servidor");
    expect(body.details).toBeUndefined(); // Sin filtrar stack traces al cliente
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
