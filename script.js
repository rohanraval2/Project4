let chart;
let data;

async function loadData() {
  const response = await fetch("table.csv");
  const text = await response.text();
  const rows = text.trim().split("\n").slice(1);

  data = rows.map(row => {
    const [id, age, gender, height, weight, legLength, speed, group] = row.split(",");
    return {
      id: +id,
      age: +age,
      gender,
      height: +height,
      weight: +weight,
      legLength: +legLength,
      speed: +speed,
      group
    };
  });
}

function updateChart() {
  const genderFilter = document.getElementById("gender").value;
  const groupFilter = document.getElementById("group").value;

  const filtered = data.filter(d =>
    (genderFilter === "All" || d.gender === genderFilter) &&
    (groupFilter === "All" || d.group === groupFilter)
  );

  const ageMap = {};
  filtered.forEach(d => {
    if (!ageMap[d.age]) ageMap[d.age] = [];
    ageMap[d.age].push(d);
  });

  const labels = Object.keys(ageMap).map(a => +a).sort((a, b) => a - b);
  const speeds = labels.map(a => {
    const entries = ageMap[a];
    return entries.reduce((sum, e) => sum + e.speed, 0) / entries.length;
  });

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("speedChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Avg Speed (m/s)",
        data: speeds,
        borderColor: "#007bff",
        fill: false,
        tension: 0.2
      }]
    },
    options: {
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const selectedAge = labels[index];
          const stats = ageMap[selectedAge];
          const avgLeg = stats.reduce((sum, e) => sum + e.legLength, 0) / stats.length;
          const avgSpeed = speeds[index];
          document.getElementById("ageStat").textContent = selectedAge + " months";
          document.getElementById("speedStat").textContent = avgSpeed.toFixed(2);
          document.getElementById("legLengthStat").textContent = avgLeg.toFixed(1);
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Age (months)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Speed (m/s)"
          }
        }
      }
    }
  });
}

document.getElementById("gender").addEventListener("change", updateChart);
document.getElementById("group").addEventListener("change", updateChart);

loadData().then(updateChart);
