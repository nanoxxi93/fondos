import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, override: true });

import express from "express";
import { mongoInit } from "./db.js";
import { run as runErni } from "./erni.js";
import { run as runBbva } from "./bbva.js";
import { run as runTyba } from "./tyba.js";
import { tea } from "./tea.js";

const { PORT = 3000 } = process.env;

mongoInit().then(() => {
  const app = express();
  app.get("/api/erni", async (req, res) => {
    try {
      await runErni(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/bbva", async (req, res) => {
    try {
      await runBbva(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/tyba", async (req, res) => {
    try {
      await runTyba(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/", async (req, res) => {
    const { period = 30, currency, risk } = req.query;
    const chartData = await tea({
      PERIOD: +period,
      CURRENCY: currency,
      RISK: risk ? +risk : undefined,
    });

    let html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Fondos Mutuos</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .container {
            display: flex;
            width: 576px;
            margin: auto;
          }
          table {
            width: 576px;
            margin: 20px auto;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: center;
          }
          th {
            background-color: #f2f2f2;
          }
          button {
            margin-bottom: 10px;
          }
          .checkbox-group {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            margin-bottom: 20px;
            max-width: 1280px;
            margin: auto;
          }
        </style>
      </head>
      <body>
        <h1>Fondos Mutuos - últimos ${period} días</h1>

        <!-- Checkboxes agrupados por source -->
        <div class="checkbox-group">
          <div class="checkbox-column">
            <h3>Fuente ERNI</h3>
            ${chartData.datasets
              .filter((dataset) => dataset.meta.source === "ERNI")
              .map(
                ({ label, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}">${label}</label>
                    <br />
                `
              )
              .join("")}
          </div>
          <div class="checkbox-column">
            <h3>Fuente BBVA</h3>
            ${chartData.datasets
              .filter((dataset) => dataset.meta.source === "BBVA")
              .map(
                ({ label, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}">${label}</label>
                    <br />
                `
              )
              .join("")}
          </div>
          <div class="checkbox-column">
            <h3>Fuente TYBA</h3>
            ${chartData.datasets
              .filter((dataset) => dataset.meta.source === "TYBA")
              .map(
                ({ label, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}">${label}</label>
                    <br />
                `
              )
              .join("")}
          </div>
        </div>

        <div class="container">
          <canvas id="myChart" width="1366" height="768"></canvas>
        </div>

        <!-- Tabla resumen centrada -->
        <table>
          <tr>
            <th>Nombre</th>
            <th>Moneda</th>
            <th>Riesgo</th>
            <th>Valor</th>
          </tr>
    `;

    // Agregar filas a la tabla
    Object.values(chartData.datasets)
      .sort((a, b) => (b.meta.value > a.meta.value ? 1 : -1))
      .forEach(({ label, meta: { value, currency, risk } }) => {
        html += `
                <tr>
                  <td>${label}</td>
                  <td>${currency}</td>
                  <td>${risk}</td>
                  <td>${value}</td>
                </tr>
            `;
      });

    html += `
        </table>
        
        <script>
          // Datos transformados
          const chartData = {
              labels: ${JSON.stringify(chartData.labels)},
              datasets: ${JSON.stringify(chartData.datasets)},
          };
    
          // Configurar y renderizar el gráfico
          const ctx = document.getElementById('myChart').getContext('2d');
          const myChart = new Chart(ctx, {
              type: 'line', // Tipo de gráfico (line, bar, etc.)
              data: chartData,
              options: {
                  plugins: {
                      legend: {
                          display: false, // Ocultar la leyenda superior
                      },
                  },
                  scales: {
                      y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Cambio Relativo (%)',
                        },
                      },
                  },
              },
          });

          // Función para mostrar/ocultar datasets
          const toggle = (index) => {
              const checkbox = document.getElementById('dataset-' + index);
              myChart.getDatasetMeta(index).hidden = !checkbox.checked;
              myChart.update();
          };
        </script>
      </body>
    </html>
    `;

    res.status(200).send(html);
  });

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
});
