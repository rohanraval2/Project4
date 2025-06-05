let data;
let strideData = {};
let isPlaying = false;
let walkerStates = {};

async function loadData() {
    // Load summary data (still needed for some functionality)
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

    // Hardcode the fixed subjects
    const olderSubject = { id: 50, age: 163, gender: 'M', height: 170, weight: 70, legLength: 85, speed: 1.2, group: 'Old' };
    const youngerSubject = { id: 15, age: 79, gender: 'F', height: 165, weight: 65, legLength: 80, speed: 1.4, group: 'Young' };

    // Load stride data for fixed subjects
    await Promise.all([
        loadStrideData('older', 50, 163),
        loadStrideData('younger', 15, 79)
    ]);

    // Update walker info with hardcoded subjects
    updateWalkerInfo("older", olderSubject);
    updateWalkerInfo("younger", youngerSubject);

    // Set up restart button
    document.getElementById("restartButton").addEventListener("click", toggleWalking);

    // Initialize walkers with hardcoded subjects
    initializeWalkers();
}

async function loadStrideData(type, id, age) {
    try {
        const response = await fetch(`data/${id}_${age}.str`);
        const text = await response.text();
        
        // Parse stride data (time and stride interval)
        const strideIntervals = text.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [time, interval] = line.split(/\s+/).map(Number);
                return { time, interval: interval * 1000 }; // Convert to milliseconds
            })
            .filter(data => !isNaN(data.interval));

        // Calculate average stride interval and its standard deviation
        const intervals = strideIntervals.map(d => d.interval);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdDev = Math.sqrt(
            intervals.reduce((sq, n) => sq + Math.pow(n - avgInterval, 2), 0) / intervals.length
        );

        strideData[type] = {
            intervals,
            avgInterval,
            stdDev,
            rawData: strideIntervals
        };

        // Initialize chart for this walker
        initializeStrideChart(type);
    } catch (error) {
        console.error(`Error loading stride data for ${type}:`, error);
    }
}

function updateWalkerInfo(type, data) {
    if (!data) return;

    const info = document.getElementById(`${type}Info`);
    const spans = info.getElementsByClassName("stat-value");
    spans[0].textContent = data.age;
    spans[1].textContent = data.speed.toFixed(2);
    spans[2].textContent = data.legLength.toFixed(1);
}

function toggleWalking() {
    isPlaying = !isPlaying;
    const button = document.getElementById("restartButton");
    if (isPlaying) {
        button.textContent = "Pause ⏸️";
        ['older', 'younger'].forEach(type => {
            // Use hardcoded subjects
            const subjectData = type === 'older' 
                ? { id: 50, age: 163, speed: 1.2 }
                : { id: 15, age: 79, speed: 1.4 };

            // Calculate maxSpeed based on hardcoded values
            const maxSpeed = Math.max(1.2, 1.4); // Hardcoded speeds

            const baseDuration = 20;
            animateWalker(type, subjectData, baseDuration, maxSpeed, true);
        });
    } else {
        button.textContent = "Play ▶️";
        // Cancel animation frames for all walkers
        Object.values(walkerStates).forEach(state => {
            if (state && state.frameId) {
                cancelAnimationFrame(state.frameId);
                state.frameId = null;
            }
        });
    }

    // --- Pause/resume CSS animation ---
    document.querySelectorAll('.kid-svg').forEach(walker => {
        walker.style.animationPlayState = isPlaying ? 'running' : 'paused';
    });
}

function initializeWalkers() {
    // Initialize SVGs for both walkers
    ['older', 'younger'].forEach(type => {
        const svg = document.querySelector(`.kid-svg.${type}`);
        svg.innerHTML = getWalkerSVG(type);
        
        // Set initial position
        svg.style.left = '-120px';
        
        // Update walker card with hardcoded subject data
        const subjectData = type === 'older' 
            ? { id: 50, age: 163, gender: 'M', speed: 1.2, legLength: 85 }
            : { id: 15, age: 79, gender: 'F', speed: 1.4, legLength: 80 };
        updateWalkerCard(type, subjectData);
    });
}

// ... rest of the animation functions (animateWalker, getWalkerSVG) remain unchanged ...

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", loadData); 