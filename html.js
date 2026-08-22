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
            justify-content: center;
            align-items: flex-end;
            gap: 16px;
            flex-wrap: wrap;
            max-width: 720px;
            margin: 0 auto 28px;
            padding: 16px 20px;
            background: #f7f7f7;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-sizing: border-box;
          }
          .filter-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .filter-field label {
            font-size: 12px;
            font-weight: 600;
            color: #555;
          }
          .filters input,
          .filters select,
          .filters button {
            height: 36px;
            font-family: inherit;
            font-size: 14px;
            border-radius: 6px;
            box-sizing: border-box;
          }
          .filters input,
          .filters select {
            min-width: 128px;
            padding: 0 10px;
            border: 1px solid #ccc;
            background: #fff;
          }
          .filters button {
            padding: 0 18px;
            border: none;
            background: #222;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
          }
          .filters button:hover {
            background: #444;
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
            margin: 0;
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
          <div class="filter-field">
            <label for="filter-days">Días</label>
            <input id="filter-days" type="number" name="days" min="1" max="3650" value="${escapeHtml(days)}" />
          </div>
          <div class="filter-field">
            <label for="filter-currency">Moneda</label>
            <select id="filter-currency" name="currency">
              <option value="" ${currency ? "" : "selected"}>Todas</option>
              <option value="PEN" ${currency === "PEN" ? "selected" : ""}>PEN</option>
              <option value="USD" ${currency === "USD" ? "selected" : ""}>USD</option>
            </select>
          </div>
          <div class="filter-field">
            <label for="filter-risk">Riesgo máximo</label>
            <input id="filter-risk" type="number" name="risk" min="1" max="7" value="${escapeHtml(risk ?? "")}" />
          </div>
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
