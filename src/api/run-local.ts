import "dotenv/config";
import http from "node:http";
import { handler, type LambdaFunctionUrlEvent } from "./handler.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || "/", `http://localhost:${PORT}`);
    const rawPath = parsedUrl.pathname;

    const queryParams: Record<string, string> = {};
    parsedUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") {
        headers[key] = val;
      } else if (Array.isArray(val)) {
        headers[key] = val.join(", ");
      }
    }

    const event: LambdaFunctionUrlEvent = {
      rawPath,
      requestContext: {
        http: {
          method: req.method || "GET",
          path: rawPath,
        },
      },
      queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      headers,
    };

    const result = await handler(event);

    for (const [headerName, headerValue] of Object.entries(result.headers)) {
      res.setHeader(headerName, headerValue);
    }

    res.writeHead(result.statusCode);
    res.end(result.body);

    console.info(`[${req.method}] ${req.url} -> ${result.statusCode}`);
  } catch (err: unknown) {
    console.error("Error no controlado en servidor local:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en servidor local", timestamp: new Date().toISOString() }));
  }
});

server.listen(PORT, () => {
  console.info(`\n🚀 Servidor API Serverless corriendo en http://localhost:${PORT}`);
  console.info(`   - Analítica TEA: http://localhost:${PORT}/api/tea?days=30`);
  console.info(`   - Health check:  http://localhost:${PORT}/health\n`);
});
