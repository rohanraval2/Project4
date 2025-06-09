let chart;
let data;
let selectedAge = null;

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

function getFilteredData() {
  const genderFilter = document.getElementById("gender").value;
  const groupFilter = document.getElementById("group").value;
  const minSpeed = parseFloat(document.getElementById("speedSlider").value);
  const minLeg = parseFloat(document.getElementById("legSlider").value);

  return data.filter(d =>
    (genderFilter === "All" || d.gender === genderFilter) &&
    (groupFilter === "All" || d.group === groupFilter) &&
    d.speed >= minSpeed &&
    d.legLength >= minLeg
  );
}

function updateChart() {
  const filtered = getFilteredData();

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
        tension: 0.2,
        pointBackgroundColor: labels.map(age => age === selectedAge ? "red" : "#007bff"),
        pointRadius: labels.map(age => age === selectedAge ? 6 : 3),
        pointHoverRadius: labels.map(age => age === selectedAge ? 7 : 4)
      }]
    },
    options: {
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          selectedAge = labels[index];
          document.getElementById("ageSlider").value = selectedAge;
          updateStatsFromAge(selectedAge);
          updateChart(); // refresh to highlight selected dot
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

function updateStatsFromAge(ageValue) {
  const filtered = getFilteredData();
  let stats = filtered.filter(d => d.age === ageValue);

  const ageStat = document.getElementById("ageStat");
  const speedStat = document.getElementById("speedStat");
  const legStat = document.getElementById("legLengthStat");

  // If no data at this age, try closest
  if (stats.length === 0) {
    const availableAges = [...new Set(filtered.map(d => d.age))].sort((a, b) => Math.abs(a - ageValue) - Math.abs(b - ageValue));
    if (availableAges.length === 0) {
      ageStat.textContent = `${ageValue} months`;
      speedStat.textContent = "—";
      legStat.textContent = "—";
      return;
    }
    const closestAge = availableAges[0];
    document.getElementById("ageSlider").value = closestAge;
    stats = filtered.filter(d => d.age === closestAge);
    ageValue = closestAge;
  }

  selectedAge = ageValue;

  const avgSpeed = stats.reduce((sum, d) => sum + d.speed, 0) / stats.length;
  const avgLeg = stats.reduce((sum, d) => sum + d.legLength, 0) / stats.length;

  ageStat.textContent = ageValue + " months";
  speedStat.textContent = avgSpeed.toFixed(2) + " m/s";
  legStat.textContent = avgLeg.toFixed(1) + " in";

  const walker = document.getElementById("walker");
  if (walker) {
    // Adjust animation speed based on the walker's speed
    // Faster speed = shorter animation duration
    const limbAnimationDuration = (1 / avgSpeed) * 0.3; // Faster limb movement
    const walkDuration = (5 / avgSpeed).toFixed(2); // Faster horizontal movement
    
    // Apply animation duration to all animated parts
    const leftArm = walker.querySelector(".left-arm");
    const rightArm = walker.querySelector(".right-arm");
    const leftLeg = walker.querySelector(".left-leg");
    const rightLeg = walker.querySelector(".right-leg");
    
    if (leftArm) leftArm.style.animationDuration = limbAnimationDuration.toFixed(2) + "s";
    if (rightArm) rightArm.style.animationDuration = limbAnimationDuration.toFixed(2) + "s";
    if (leftLeg) leftLeg.style.animationDuration = limbAnimationDuration.toFixed(2) + "s";
    if (rightLeg) rightLeg.style.animationDuration = limbAnimationDuration.toFixed(2) + "s";
    
    // Apply horizontal movement animation
    walker.style.animationDuration = walkDuration + "s";
    
    // Also apply the bounce animation by combining animations
    walker.style.animation = `walk-across ${walkDuration}s linear infinite, walk-loop ${limbAnimationDuration.toFixed(2)}s infinite`;
    
    // Adjust grid animation speed based on walker's speed
    const gridBackground = document.querySelector(".grid-background");
    if (gridBackground) {
      const gridAnimationDuration = (5 / avgSpeed).toFixed(2);
      gridBackground.style.animationDuration = gridAnimationDuration + "s";
    }
  }
}

// Event bindings
document.getElementById("gender").addEventListener("change", () => {
  updateChart();
  updateStatsFromAge(selectedAge);
});
document.getElementById("group").addEventListener("change", () => {
  updateChart();
  updateStatsFromAge(selectedAge);
});
document.getElementById("speedSlider").addEventListener("input", () => {
  updateChart();
  updateStatsFromAge(selectedAge);
});
document.getElementById("legSlider").addEventListener("input", () => {
  updateChart();
  updateStatsFromAge(selectedAge);
});
document.getElementById("ageSlider").addEventListener("input", function () {
  selectedAge = parseInt(this.value);
  updateStatsFromAge(selectedAge);
  updateChart();
});

// Initialize
loadData().then(() => {
  selectedAge = parseInt(document.getElementById("ageSlider").value);
  updateChart();
  updateStatsFromAge(selectedAge);
});

// Navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                const navElement = document.querySelector('.nav');
                const navHeight = navElement ? navElement.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Update active navigation link based on scroll position
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');
        const navElement = document.querySelector('.nav');
        const navHeight = navElement ? navElement.offsetHeight : 0;
        
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= sectionTop - navHeight - 20) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === current) {
                link.classList.add('active');
            }
        });
    });
});
