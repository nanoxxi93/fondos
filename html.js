export const getHTML = ({ days, chartData }) => {
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
        <h1 style="text-align: center">Fondos Mutuos - últimos ${days} días</h1>

        <!-- Checkboxes agrupados por source -->
        <div class="checkbox-group">
          <div class="checkbox-column">
            <h3>Fuente ERNI</h3>
            ${chartData.datasets
              .filter((dataset) => dataset.meta.source === "ERNI")
              .map(
                ({ label, borderColor, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}" style="color: ${borderColor}">${label}</label>
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
                ({ label, borderColor, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}" style="color: ${borderColor}">${label}</label>
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
                ({ label, borderColor, meta: { index } }) => `
                    <input type="checkbox" id="dataset-${index}" value="${index}" onchange="toggle(${index})" />
                    <label for="dataset-${index}" style="color: ${borderColor}">${label}</label>
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
            <th>Rendimiento</th>
          </tr>
    `;

  // Agregar filas a la tabla
  Object.values(chartData.datasets)
    .sort((a, b) => (b.meta.value > a.meta.value ? 1 : -1))
    .forEach(({ label, borderColor, meta: { value, currency, risk } }) => {
      html += `
                <tr>
                  <td style="color: ${borderColor}">${label}</td>
                  <td style="color: ${borderColor}">${currency}</td>
                  <td style="color: ${borderColor}">${risk}</td>
                  <td style="color: ${borderColor}">${value} %</td>
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
                  responsive: true,
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
                  spanGaps: true,
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
  return html;
};
