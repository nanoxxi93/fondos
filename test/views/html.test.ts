import { describe, it, expect } from "vitest";
import { renderHtml } from "../../src/views/html.js";
import type { TeaChartData } from "../../src/domain/tea.js";

describe("HTML View Renderer (src/views/html.ts)", () => {
  const sampleChartData: TeaChartData = {
    labels: ["2026-10-01", "2026-10-02"],
    datasets: [
      {
        label: "BBVA Balanceado",
        data: [0, 2.5],
        backgroundColor: "hsla(120, 70%, 50%, 0.2)",
        borderColor: "hsla(120, 70%, 40%, 1)",
        borderWidth: 1,
        pointRadius: 1,
        hidden: true,
        meta: {
          index: 0,
          idFondo: "BBVA-BAL",
          source: "bbva",
          value: 2.5,
          firstValue: 100,
          lastValue: 102.5,
          fee: 1.2,
          currency: "PEN",
          risk: 3,
        },
      },
      {
        label: "ERNI Crecimiento",
        data: [0, 5.0],
        backgroundColor: "hsla(200, 70%, 50%, 0.2)",
        borderColor: "hsla(200, 70%, 40%, 1)",
        borderWidth: 1,
        pointRadius: 1,
        hidden: true,
        meta: {
          index: 1,
          idFondo: "ERNI-CREC",
          source: "erni",
          value: 5.0,
          firstValue: 50,
          lastValue: 52.5,
          fee: 1.0,
          currency: "USD",
          risk: 4,
        },
      },
    ],
  };

  it("debe renderizar el HTML completo con doctype, canvas, tabla y script", () => {
    const html = renderHtml({
      days: 30,
      currency: "PEN",
      risk: 4,
      chartData: sampleChartData,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Fondos Mutuos</title>");
    expect(html).toContain("Fondos Mutuos - últimos 30 días");
    expect(html).toContain('<canvas id="myChart"');
    expect(html).toContain("https://cdn.jsdelivr.net/npm/chart.js");
  });

  it("debe agrupar columnas de checkboxes por fuente de fondo", () => {
    const html = renderHtml({
      days: 30,
      chartData: sampleChartData,
    });

    expect(html).toContain("<h3>Fuente bbva</h3>");
    expect(html).toContain("<h3>Fuente erni</h3>");
    expect(html).toContain('id="dataset-0"');
    expect(html).toContain('id="dataset-1"');
    expect(html).toContain("BBVA Balanceado");
    expect(html).toContain("ERNI Crecimiento");
  });

  it("debe ordenar las filas de la tabla de rendimiento de mayor a menor valor", () => {
    const html = renderHtml({
      days: 30,
      chartData: sampleChartData,
    });

    const tableHtml = html.slice(html.indexOf("<table>"));
    const erniIndex = tableHtml.indexOf("ERNI Crecimiento");
    const bbvaIndex = tableHtml.indexOf("BBVA Balanceado");
    expect(erniIndex).toBeGreaterThan(-1);
    expect(bbvaIndex).toBeGreaterThan(-1);
    expect(erniIndex).toBeLessThan(bbvaIndex);

    expect(html).toContain("5 %");
    expect(html).toContain("2.5 %");
  });

  it("debe mantener los valores seleccionados en el formulario de filtros", () => {
    const html = renderHtml({
      days: 90,
      currency: "USD",
      risk: 2,
      chartData: { labels: [], datasets: [] },
    });

    expect(html).toContain('value="90"');
    expect(html).toContain('<option value="USD" selected>USD</option>');
    expect(html).toContain('value="2"');
  });

  it("debe prevenir inyecciones XSS escapando valores maliciosos en etiquetas y textos", () => {
    const maliciousChartData: TeaChartData = {
      labels: ["2026-10-01"],
      datasets: [
        {
          label: '<script>alert("xss")</script>',
          data: [0],
          backgroundColor: "hsla(0, 70%, 50%, 0.2)",
          borderColor: 'red" onmouseover="alert(1)',
          borderWidth: 1,
          pointRadius: 1,
          hidden: true,
          meta: {
            index: 0,
            idFondo: "XSS",
            source: "erni",
            value: 10,
            firstValue: 100,
            lastValue: 110,
            fee: 0,
            currency: "PEN",
            risk: 1,
          },
        },
      ],
    };

    const html = renderHtml({
      days: 30,
      chartData: maliciousChartData,
    });

    expect(html).not.toContain("<script>alert(\"xss\")</script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("debe serializar de forma segura el objeto JSON incrustado para Chart.js", () => {
    const html = renderHtml({
      days: 30,
      chartData: sampleChartData,
    });

    expect(html).toContain("const chartData = {");
    expect(html).toContain('"labels":["2026-10-01","2026-10-02"]');
    expect(html).toContain("new Chart(ctx,");
  });
});
