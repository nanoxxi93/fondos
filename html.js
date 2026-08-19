import { escapeHtml, toSafeJson } from "./utils.js";

const checkboxColumn = (source, datasets) => `
          <div class="checkbox-column">
            <h3>Fuente ${escapeHtml(source)}</h3>
            ${datasets
              .map(
                ({ label, borderColor, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}" style="color: ${escapeHtml(borderColor)}">${escapeHtml(label)}</label>
                    <br />
                `
              )
              .join("")}
          </div>
`;

export const getHTML = ({ days, currency = "", risk = "", chartData }) => {
  const bySource = {};
  for (const dataset of chartData.datasets) {
    (bySource[dataset.meta.source] ??= []).push(dataset);
  }

  const rows = [...chartData.datasets]
    .sort((a, b) => b.meta.value - a.meta.value)
    .map(
      ({ label, borderColor, meta: { value, currency, risk } }) => `
                <tr>
                  <td style="color: ${escapeHtml(borderColor)}">${escapeHtml(label)}</td>
                  <td style="color: ${escapeHtml(borderColor)}">${escapeHtml(currency)}</td>
                  <td style="color: ${escapeHtml(borderColor)}">${escapeHtml(risk)}</td>
                  <td style="color: ${escapeHtml(borderColor)}">${escapeHtml(value)} %</td>
                </tr>
            `
    )
    .join("");

  return `
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
          .filters {
            display: flex;
            gap: 12px;
            justify-content: center;
            align-items: end;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }
          .filters label {
            display: flex;
            flex-direction: column;
            font-size: 14px;
            gap: 4px;
          }
          .container {
            display: flex;
            margin: auto;
          }
          canvas {
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
        <h1 style="text-align: center">Fondos Mutuos - últimos ${escapeHtml(days)} días</h1>

        <form class="filters" method="get" action="/">
          <label>Días
            <input type="number" name="days" min="1" max="3650" value="${escapeHtml(days)}" />
          </label>
          <label>Moneda
            <select name="currency">
              <option value="" ${currency ? "" : "selected"}>Todas</option>
              <option value="PEN" ${currency === "PEN" ? "selected" : ""}>PEN</option>
              <option value="USD" ${currency === "USD" ? "selected" : ""}>USD</option>
            </select>
          </label>
          <label>Riesgo máximo
            <input type="number" name="risk" min="1" max="7" value="${escapeHtml(risk ?? "")}" />
          </label>
          <button type="submit">Filtrar</button>
        </form>

        <div class="checkbox-group">
          ${Object.entries(bySource)
            .map(([source, datasets]) => checkboxColumn(source, datasets))
            .join("")}
        </div>

        <div class="container">
          <canvas id="myChart" width="1366" height="768"></canvas>
        </div>

        <table>
          <tr>
            <th>Nombre</th>
            <th>Moneda</th>
            <th>Riesgo</th>
            <th>Rendimiento</th>
          </tr>
          ${rows}
        </table>
        
        <script>
          const chartData = ${toSafeJson({
            labels: chartData.labels,
            datasets: chartData.datasets,
          })};
    
          const ctx = document.getElementById('myChart').getContext('2d');
          const myChart = new Chart(ctx, {
              type: 'line',
              data: chartData,
              options: {
                  responsive: true,
                  plugins: {
                      legend: {
                          display: false,
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
                  spanGaps: true,
              },
          });

          const toggle = (index) => {
              const checkbox = document.getElementById('dataset-' + index);
              myChart.getDatasetMeta(index).hidden = !checkbox.checked;
              myChart.update();
          };
        </script>
      </body>
    </html>
    `;
};
