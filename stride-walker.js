// State variables
// Refactored to hold state for multiple walkers
let walkerStates = {
    older: {
        strideData: [],
        isWalking: false,
        currentStepIndex: 0,
        lastStepTime: 0,
        animationFrameId: null,
        stepCount: 0,
        elements: null, // To cache DOM elements
        subject: null, // To store current subject data
        chart: null, // To hold the Chart.js instance
    },
    younger: {
        strideData: [],
        isWalking: false,
        currentStepIndex: 0,
        lastStepTime: 0,
        animationFrameId: null,
        stepCount: 0,
        elements: null, // To cache DOM elements
        subject: null, // To store current subject data
        chart: null, // To hold the Chart.js instance
    }
};

let allSubjectData = []; // To store data from table.csv
const ageThreshold = 100; // Example threshold in months for older/younger grouping
const speedMultiplier = 0.5; // 0.5 → run at 2x speed

// DOM elements
// Selected by class for the SVG, and by ID for stats/controls
const startButton = document.getElementById('startButton');
const subjectSelectOlder = document.getElementById('subjectSelectOlder');
const subjectSelectYounger = document.getElementById('subjectSelectYounger');

const walkerSvgOlder = document.querySelector('.kid-svg.older');
const currentIntervalElOlder = document.getElementById('currentIntervalOlder');
const avgIntervalElOlder = document.getElementById('avgIntervalOlder');
const stepCountElOlder = document.getElementById('stepCountOlder');
const strideChartCanvasOlder = document.getElementById('strideChartOlder');

const walkerSvgYounger = document.querySelector('.kid-svg.younger');
const currentIntervalElYounger = document.getElementById('currentIntervalYounger');
const avgIntervalElYounger = document.getElementById('avgIntervalYounger');
const stepCountElYounger = document.getElementById('stepCountYounger');
const strideChartCanvasYounger = document.getElementById('strideChartYounger');

// Helper to get elements for a specific walker
function getWalkerElements(walkerId) {
    const state = walkerStates[walkerId];
    if (!state) {
        console.error(`Invalid walkerId: ${walkerId}`);
        return {};
    }
    // Return cached elements if available, otherwise query (and they will be cached at init)
    if (state.elements) {
         return {
            svg: state.elements.svg,
            currentIntervalEl: state.elements.currentIntervalEl,
            avgIntervalEl: state.elements.avgIntervalEl,
            stdDevEl: state.elements.stdDevEl,
            stepCountEl: state.elements.stepCountEl,
            leftLegGroup: state.elements.leftLegGroup,
            rightLegGroup: state.elements.rightLegGroup,
            leftCalf: state.elements.leftCalf,
            rightCalf: state.elements.rightCalf,
            chartCanvas: state.elements.chartCanvas,
        };
    } else {
         // Fallback to querying if elements not cached yet (should only happen during init)
         const svg = document.querySelector(`.kid-svg.${walkerId}`);
         const chartCanvas = document.getElementById(`strideChart${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`);
         return {
            svg: svg,
            currentIntervalEl: document.getElementById(`currentInterval${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
            avgIntervalEl: document.getElementById(`avgInterval${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
            stdDevEl: document.getElementById(`stdDev${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
            stepCountEl: document.getElementById(`stepCount${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
            leftLegGroup: svg ? svg.querySelector('.left-leg') : null,
            rightLegGroup: svg ? svg.querySelector('.right-leg') : null,
            leftCalf: svg ? svg.querySelector('.left-leg .calf') : null,
            rightCalf: svg ? svg.querySelector('.right-leg .calf') : null,
            chartCanvas: chartCanvas,
        };
    }
}

// Debug function
function debug(message) {
    console.log(`[Debug] ${message}`);
}

// Initialize the walker SVG (Side Profile) for a specific walker and cache elements
function initWalkerSVG(walkerId) {
    debug(`Initializing side-profile walker SVG for ${walkerId}`);
    const svg = document.querySelector(`.kid-svg.${walkerId}`);
    const state = walkerStates[walkerId];

    if (!svg || !state) {
        console.error(`Walker SVG element or state not found for ${walkerId}!`);
        return;
    }

    // Updated SVG structure for side profile with articulated legs
    svg.innerHTML = `
        <rect x="40" y="20" width="30" height="30" fill="#FFD700"></rect> <!-- head -->
        <rect x="40" y="50" width="20" height="30" fill="#FF6B6B"></rect> <!-- body -->

        <!-- Left leg -->
        <g class="leg left-leg" transform="translate(40,80)">
            <rect class="thigh" x="0" y="0" width="5" height="15" fill="#4ECDC4"></rect>
            <rect class="calf" x="0" y="15" width="5" height="15" fill="#4ECDC4"></rect>
        </g>

        <!-- Right leg -->
        <g class="leg right-leg" transform="translate(50,80)">
            <rect class="thigh" x="0" y="0" width="5" height="15" fill="#4ECDC4"></rect>
            <rect class="calf" x="0" y="15" width="5" height="15" fill="#4ECDC4"></rect>
        </g>
    `;
    // Center the walker horizontally within its SVG/container (CSS handles positioning of the SVG element itself)
     svg.style.bottom = '0'; // Ensure it's at the bottom

    // Cache the DOM elements for this walker
    const chartCanvas = document.getElementById(`strideChart${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`);
    state.elements = {
        svg: svg,
        currentIntervalEl: document.getElementById(`currentInterval${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
        avgIntervalEl: document.getElementById(`avgInterval${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
        stdDevEl: document.getElementById(`stdDev${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
        stepCountEl: document.getElementById(`stepCount${walkerId.charAt(0).toUpperCase() + walkerId.slice(1)}`),
        leftLegGroup: svg.querySelector('.left-leg'),
        rightLegGroup: svg.querySelector('.right-leg'),
        leftCalf: svg.querySelector('.left-leg .calf'),
        rightCalf: svg.querySelector('.right-leg .calf'),
        chartCanvas: chartCanvas,
    };

    debug(`Side-profile walker SVG initialized and elements cached for ${walkerId}`);
}

// Load stride data for a specific walker and subject
async function loadStrideData(walkerId, subjectId) {
    debug(`Loading stride data for ${walkerId} walker (subject ${subjectId})`);
    const walker = walkerStates[walkerId];
    const { avgIntervalEl, stdDevEl } = getWalkerElements(walkerId);

    if (!walker || !allSubjectData) {
         console.error(`Invalid walkerId or subject data not loaded: ${walkerId}`);
         if (avgIntervalEl) avgIntervalEl.textContent = '-';
         if (stdDevEl) stdDevEl.textContent = '-';
         return false;
    }

    const subject = allSubjectData.find(s => s.id === subjectId);
    if (!subject) {
        console.error(`Subject data not found for ID: ${subjectId}`);
         if (avgIntervalEl) avgIntervalEl.textContent = '-';
        if (stdDevEl) stdDevEl.textContent = '-';
        return false;
    }

    // Store the current subject data in the walker's state
    walker.subject = subject;

    // Reset data before loading new
    walker.strideData = [];

    // For testing, let's create some dummy data if the file doesn't exist
    const dummyData = Array.from({ length: 20 }, (_, i) => ({
        time: i * 1000,
        interval: 500 + Math.random() * 200 // Random intervals between 500-700ms
    }));

    try {
        // Use hyphen in file path: data/${subject.id}-${subject.age}.txt
        const response = await fetch(`data/${subject.id}-${subject.age}.txt`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();

        // Parse stride data (time and stride interval)
        walker.strideData = text.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [time, interval] = line.split(/\s+/).map(Number);
                // Convert interval from seconds to milliseconds
                return { time, interval: interval * 1000 };
            })
            .filter(data => !isNaN(data.interval));

    } catch (fetchError) {
        console.warn(`Could not load stride data file for ${walkerId} walker (subject ${subject.id}, age ${subject.age}.txt not found), using dummy data:`, fetchError);
        walker.strideData = dummyData;
    }

    if (walker.strideData.length === 0) {
        console.error(`No valid stride data found for ${walkerId} walker (subject ${subject.id}) even dummy data failed.`);
        // Clear displays if no data at all
        if (avgIntervalEl) avgIntervalEl.textContent = '-';
        if (stdDevEl) stdDevEl.textContent = '-';

        // Also destroy existing chart if no data loaded
        if (walker.chart) {
            walker.chart.destroy();
            walker.chart = null;
        }

        return false;
    }

    // Calculate and display average interval and standard deviation for this walker
    const intervals = walker.strideData.map(d => d.interval);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Calculate standard deviation
    const stdDev = Math.sqrt(
        intervals.reduce((sq, n) => sq + Math.pow(n - avgInterval, 2), 0) / intervals.length
    );

    // Store std dev in walker state for chart use
    walker.stdDev = stdDev;
    walker.avgInterval = avgInterval;

    // Update displays
    if (avgIntervalEl) avgIntervalEl.textContent = avgInterval.toFixed(2) + ' ms';
    if (stdDevEl) stdDevEl.textContent = stdDev.toFixed(2) + ' ms';

    debug(`Loaded ${walker.strideData.length} stride intervals for ${walkerId} walker (subject ${subject.id}), avg: ${avgInterval.toFixed(2)}ms, std dev: ${stdDev.toFixed(2)}ms`);

    // Initialize or update chart after data load
    initializeStrideChart(walkerId);

    return true;
}

// Initialize Chart.js plot for a specific walker
function initializeStrideChart(walkerId) {
    debug(`Initializing stride chart for ${walkerId}`);
    const walker = walkerStates[walkerId];
    const { chartCanvas } = getWalkerElements(walkerId);

     if (!walker || !chartCanvas || !walker.strideData || walker.strideData.length === 0) {
         console.warn(`Cannot initialize chart for ${walkerId}: missing elements or data.`);
         if (walker && walker.chart) {
             walker.chart.destroy();
             walker.chart = null;
         }
         return;
     }

    // Destroy previous chart instance if it exists
    if (walker.chart) {
        walker.chart.destroy();
    }

    const ctx = chartCanvas.getContext('2d');

    // Prepare data for Chart.js
    const chartData = walker.strideData.map((d, index) => ({ x: index + 1, y: d.interval }));
    const intervals = walker.strideData.map(d => d.interval);
    const yMin = Math.min(...intervals);
    const yMax = Math.max(...intervals);

    // Create mean ± std dev band data
    const mean = walker.avgInterval;
    const stdDev = walker.stdDev;
    const bandData = chartData.map(point => ({
        x: point.x,
        y: mean + stdDev, // Upper band
        y0: mean - stdDev // Lower band
    }));

    // Create new chart instance
    walker.chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                // Mean ± std dev band
                label: 'Mean ± 1 Std Dev',
                data: bandData,
                type: 'line',
                borderColor: 'rgba(37, 99, 235, 0.2)', // Light blue
                backgroundColor: 'rgba(37, 99, 235, 0.1)', // Very light blue
                fill: true,
                pointRadius: 0,
                borderWidth: 0,
                stepped: false,
                tension: 0.1,
                showLine: true,
                segment: {
                    borderColor: ctx => 'rgba(37, 99, 235, 0.2)',
                    backgroundColor: ctx => 'rgba(37, 99, 235, 0.1)',
                }
            }, {
                // Stride History - shows line up to current step
                label: 'Stride History',
                data: [], // Will be populated in updateStridePlot
                borderColor: '#2563eb',
                backgroundColor: '#2563eb',
                pointRadius: 3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                showLine: true,
                borderWidth: 2,
                tension: 0.2,
                fill: false
            }, {
                // Current Step - single red point
                label: 'Current Step',
                data: [], // Will be populated in updateStridePlot
                borderColor: '#ef4444',
                backgroundColor: '#ef4444',
                pointRadius: 6,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                showLine: false,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Stride Index'
                    },
                    beginAtZero: true,
                    suggestedMin: 0,
                    suggestedMax: walker.strideData.length > 0 ? walker.strideData.length + 1 : 10,
                    ticks: {
                        stepSize: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Interval (ms)'
                    },
                    beginAtZero: false,
                    suggestedMin: yMin > 0 ? yMin * 0.9 : 0,
                    suggestedMax: yMax > 0 ? yMax * 1.1 : 1000,
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                // For the band, show mean ± std dev
                                return `Mean ± Std Dev: ${mean.toFixed(2)} ± ${stdDev.toFixed(2)} ms`;
                            }
                            // For other points, show stride index and interval
                            return `Stride ${context.parsed.x}: ${context.parsed.y.toFixed(2)} ms`;
                        }
                    }
                }
            }
        }
    });

    // Initialize the datasets with empty data
    updateStridePlot(walkerId, walker.currentStepIndex);
    debug(`Chart initialized for ${walkerId}`);
}

// Implement updateStridePlot to update both stride history and current step
function updateStridePlot(walkerId, stepIndex) {
    const walker = walkerStates[walkerId];
    if (!walker || !walker.chart || !walker.strideData || walker.strideData.length === 0) {
        return;
    }

    // Prepare the data arrays
    const chartData = walker.strideData.map((d, index) => ({ x: index + 1, y: d.interval }));
    
    // Update stride history dataset (blue line up to current step)
    walker.chart.data.datasets[1].data = chartData.slice(0, stepIndex + 1);
    
    // Update current step dataset (red point)
    walker.chart.data.datasets[2].data = chartData.map((point, index) => 
        index === stepIndex ? point : null
    );

    // Update the chart
    walker.chart.update();
}

// Helper function to set transform for leg parts (DRY)
function setLegTransform(legGroup, calf, hipAngle, kneeAngle) {
     if (!legGroup || !calf) return;
     // Apply rotation at the hip (origin is the translate point of the group)
    legGroup.setAttribute('transform', `translate(${parseFloat(legGroup.getAttribute('transform').split('(')[1].split(',')[0])},80) rotate(${hipAngle})`);
     // Apply rotation at the knee (origin is the top of the calf relative to the group)
    calf.setAttribute('transform', `translate(0,15) rotate(${kneeAngle}) translate(0,-15)`);
}

// Take a single step (animate legs) for a specific walker (DRY and use cached elements)
function takeStep(walkerId) {
    const walker = walkerStates[walkerId];
    const { leftLegGroup, rightLegGroup, leftCalf, rightCalf } = getWalkerElements(walkerId);

     if (!leftLegGroup || !rightLegGroup || !leftCalf || !rightCalf) {
        console.error(`Leg group or calf elements not found for ${walkerId} animation!`);
        return;
    }

    // Animate legs using rotation based on step count for this walker
    const hipRotationForward = 15; // Hip rotation angle for forward swing
    const hipRotationBackward = -5; // Hip rotation angle for backward swing
    const kneeRotationBend = -20; // Knee rotation angle for bending
    const kneeRotationStraight = 0; // Knee rotation angle for straight

    if (walker.stepCount % 2 === 0) {
        // Step 1: Left leg forward swing, Right leg backward swing
        setLegTransform(leftLegGroup, leftCalf, hipRotationForward, kneeRotationBend); // Left leg forward and bent
        setLegTransform(rightLegGroup, rightCalf, hipRotationBackward, kneeRotationStraight); // Right leg back and straight
    } else {
        // Step 2: Right leg forward swing, Left leg backward swing
        setLegTransform(leftLegGroup, leftCalf, hipRotationBackward, kneeRotationStraight); // Left leg back and straight
        setLegTransform(rightLegGroup, rightCalf, hipRotationForward, kneeRotationBend); // Right leg forward and bent
    }

    // FIX 6: Add hook for upcoming plot update
    // This is called here because takeStep is triggered per step
     updateStridePlot(walkerId, walker.currentStepIndex);
}

// Start/Stop walking for both walkers
function toggleWalking() {
    debug('Toggle walking button clicked');
    const olderWalker = walkerStates.older;
    const youngerWalker = walkerStates.younger;

    const isCurrentlyWalking = olderWalker.isWalking || youngerWalker.isWalking;

    if (isCurrentlyWalking) {
        debug('Stopping walk for both');
        stopWalking('older');
        stopWalking('younger');
        startButton.textContent = 'Start Walking';
    } else {
         // Only start if both have data
        if (olderWalker.strideData.length === 0 || youngerWalker.strideData.length === 0) {
             console.warn('Cannot start walking: Data not loaded for one or both walkers.');
             return;
         }
        debug('Starting walk for both');
        startButton.textContent = 'Stop Walking';

        // Start both animations
        startWalking('older');
        startWalking('younger');
    }
}

// Start walking for a specific walker
function startWalking(walkerId) {
    const walker = walkerStates[walkerId];
    const { stepCountEl, currentIntervalEl } = getWalkerElements(walkerId);

    if (!walker || !walker.strideData || walker.strideData.length === 0) {
        console.error(`No stride data available to start walking for ${walkerId}.`);
        return;
    }

    debug(`Starting walk animation for ${walkerId}`);
    walker.isWalking = true;

    // Reset state when starting
    walker.stepCount = 0;
    walker.currentStepIndex = 0;
    walker.lastStepTime = performance.now(); // Reset lastStepTime on start

    if(stepCountEl) stepCountEl.textContent = walker.stepCount;
    if(currentIntervalEl) currentIntervalEl.textContent = '-'; // Reset current interval on start

    // Take first step immediately and update plot
    takeStep(walkerId);
    updateStridePlot(walkerId, walker.currentStepIndex);

    walker.animationFrameId = requestAnimationFrame((ts) => animateWalker(walkerId, ts));
}

// Animate a specific walker based on its stride data
function animateWalker(walkerId, timestamp) {
    const walker = walkerStates[walkerId];
    const { currentIntervalEl, stepCountEl } = getWalkerElements(walkerId);

    if (!walker || !walker.isWalking || !walker.strideData || walker.strideData.length === 0) {
        return;
    }

    // Get current stride data
    let activeStride = walker.strideData[walker.currentStepIndex];
    if (!activeStride) {
        debug(`${walkerId} No more stride data, looping`);
        walker.currentStepIndex = 0; // Loop back to the beginning
        activeStride = walker.strideData[walker.currentStepIndex];
        if (!activeStride) {
            console.error(`Error: No stride data available for ${walkerId} after attempting loop.`);
            stopWalking(walkerId); // Stop this walker if data is still somehow missing
            return;
        }
    }

    // Update current interval display for this walker
    if (currentIntervalEl) currentIntervalEl.textContent = activeStride.interval.toFixed(2) + ' ms';

    // Check if it's time for the next step for this walker
    if (timestamp - walker.lastStepTime >= activeStride.interval * speedMultiplier) {
        debug(`${walkerId} Taking step ${walker.stepCount + 1} with interval ${activeStride.interval.toFixed(2)}ms`);
        // Take a step (animate legs) for this walker
        takeStep(walkerId);
        walker.lastStepTime = timestamp;
        walker.currentStepIndex = (walker.currentStepIndex + 1) % walker.strideData.length;
        walker.stepCount++;
        if (stepCountEl) stepCountEl.textContent = walker.stepCount;
    }

    // Continue animation for this walker
    walker.animationFrameId = requestAnimationFrame((ts) => animateWalker(walkerId, ts));
}

// Stop walking for a specific walker
function stopWalking(walkerId) {
    debug(`Stopping walk animation for ${walkerId}`);
    const walker = walkerStates[walkerId];
    const { svg, currentIntervalEl } = getWalkerElements(walkerId);

    if (!walker) return;

    walker.isWalking = false;
    if (walker.animationFrameId) {
        cancelAnimationFrame(walker.animationFrameId);
        walker.animationFrameId = null;
    }

    // Reset leg positions to a neutral stance for this walker
    if (svg) {
        const leftLegGroup = svg.querySelector('.left-leg');
        const rightLegGroup = svg.querySelector('.right-leg');
        const leftCalf = leftLegGroup ? leftLegGroup.querySelector('.calf') : null;
        const rightCalf = rightLegGroup ? rightLegGroup.querySelector('.calf') : null;

        if (leftLegGroup) leftLegGroup.setAttribute('transform', 'translate(40,80) rotate(0)');
        if (rightLegGroup) rightLegGroup.setAttribute('transform', 'translate(50,80) rotate(0)');
        if (leftCalf) leftCalf.setAttribute('transform', 'translate(0,0)');
        if (rightCalf) rightCalf.setAttribute('transform', 'translate(0,0)');
    }

    // Reset state variables on stop
    walker.stepCount = 0;
    walker.currentStepIndex = 0;
    walker.lastStepTime = 0;

    // Reset current interval display for this walker
     if(currentIntervalEl) currentIntervalEl.textContent = '-';

    // Remove chart highlighting when stopped
    // FIX 6: Implement chart reset on stop
    if (walker.chart) {
        walker.chart.data.datasets[1].data = []; // Clear highlight dataset
        walker.chart.update();
    }
}

// Load subject data from table.csv
async function loadSubjectData() {
    debug('Loading subject data from table.csv');
    try {
        const response = await fetch("table.csv");
        if (!response.ok) {
             // If table.csv is not found, maybe hardcode a minimal set or show error
             console.error('table.csv not found, cannot populate dropdowns dynamically.');
             // Fallback: if table.csv fails, use minimal hardcoded data or disable dropdowns
             allSubjectData = [
                 { id: 50, age: 163, gender: 'M', height: 0, weight: 0, legLength: 0, speed: 0, group: 'Older' },
                 { id: 10, age: 58, gender: 'F', height: 0, weight: 0, legLength: 0, speed: 0, group: 'Younger' },
             ];
             return true;
        }

        const text = await response.text();
        const rows = text.trim().split("\n").slice(1); // Skip header row

        allSubjectData = rows.map(row => {
            const [id, age, gender, height, weight, legLength, speed, group] = row.split(",");
            return {
                id: +id,
                age: +age, // Age in months, assuming based on comparison.js context
                gender,
                height: +height,
                weight: +weight,
                legLength: +legLength,
                speed: +speed,
                group // Keep original group if available, or derive from age
            };
        });

        // Derive group based on age threshold if not available or to ensure consistency
        allSubjectData.forEach(s => {
            s.group = s.age >= ageThreshold ? 'Older' : 'Younger';
        });

        debug(`Loaded ${allSubjectData.length} subjects from table.csv`);
        return true;
    } catch (error) {
        console.error('Error loading subject data from table.csv:', error);
         // Fallback in case of parsing error
         allSubjectData = [
             { id: 50, age: 163, gender: 'M', height: 0, weight: 0, legLength: 0, speed: 0, group: 'Older' },
             { id: 10, age: 58, gender: 'F', height: 0, weight: 0, legLength: 0, speed: 0, group: 'Younger' },
         ];
         return false;
    }
}

// Populate dropdowns dynamically and set up change listeners
async function setupSubjectDropdowns() {
    debug('Setting up subject dropdowns');

    // Populate dropdowns dynamically from loaded subject data
    if (allSubjectData.length === 0) {
        console.warn('No subject data available to populate dropdowns.');
        // Disable dropdowns if no data
        if (subjectSelectOlder) subjectSelectOlder.disabled = true;
        if (subjectSelectYounger) subjectSelectYounger.disabled = true;
        return;
    }

    const olderSubjects = allSubjectData.filter(s => s.group === 'Older');
    const youngerSubjects = allSubjectData.filter(s => s.group === 'Younger');

    if (subjectSelectOlder) {
        // Correctly set option value to s.id and add data-age attribute
        subjectSelectOlder.innerHTML = olderSubjects.map(s => `<option value="${s.id}" data-age="${s.age}">${s.id}: Age ${s.age}</option>`).join('');
        // Set default selection, try ID 50 first, then first available older subject
        if (olderSubjects.some(s => s.id === 50)) {
            subjectSelectOlder.value = '50';
        } else if (olderSubjects.length > 0) {
             subjectSelectOlder.value = olderSubjects[0].id.toString(); // Ensure value is string
        }

        subjectSelectOlder.addEventListener('change', async (event) => {
            const selectedOption = event.target.selectedOptions[0];
            const subjectId = parseInt(selectedOption.value);
            debug(`Older subject selected: ID ${subjectId}`);
            // Stop current animation for this walker
            stopWalking('older');
            // Load new data and re-initialize walker display (except starting animation)
            const success = await loadStrideData('older', subjectId);
             // Update subject title
            const walkerSection = subjectSelectOlder.closest('.walker-section');
            if(walkerSection && walkerStates.older.subject) walkerSection.querySelector('h2').textContent = `Older Subject (${walkerStates.older.subject.id}: Age ${walkerStates.older.subject.age})`;

            // After loading new data, update the main start button state
             updateStartButtonState();
        });
    }

    if (subjectSelectYounger) {
        // Correctly set option value to s.id and add data-age attribute
        subjectSelectYounger.innerHTML = youngerSubjects.map(s => `<option value="${s.id}" data-age="${s.age}">${s.id}: Age ${s.age}</option>`).join('');
         // Set default selection, try ID 10 first, then first available younger subject
        if (youngerSubjects.some(s => s.id === 10)) {
             subjectSelectYounger.value = '10';
        } else if (youngerSubjects.length > 0) {
             subjectSelectYounger.value = youngerSubjects[0].id.toString(); // Ensure value is string
        }

        subjectSelectYounger.addEventListener('change', async (event) => {
             const selectedOption = event.target.selectedOptions[0];
            const subjectId = parseInt(selectedOption.value);
            debug(`Younger subject selected: ID ${subjectId}`);
            // Stop current animation for this walker
            stopWalking('younger');
            // Load new data and re-initialize walker display (except starting animation)
            const success = await loadStrideData('younger', subjectId);
             // Update subject title
            const walkerSection = subjectSelectYounger.closest('.walker-section');
            if(walkerSection && walkerStates.younger.subject) walkerSection.querySelector('h2').textContent = `Younger Subject (${walkerStates.younger.subject.id}: Age ${walkerStates.younger.subject.age})`;

             // After loading new data, update the main start button state
            updateStartButtonState();
          });
    }

    debug('Subject dropdowns setup complete.');
}

// Update the state of the main start button based on data availability
function updateStartButtonState() {
     const olderWalker = walkerStates.older;
    const youngerWalker = walkerStates.younger;

    if (startButton) {
        if (olderWalker.strideData.length > 0 && youngerWalker.strideData.length > 0) {
            startButton.disabled = false;
            startButton.textContent = 'Start Walking';
        } else {
            startButton.disabled = true;
            startButton.textContent = 'Error Loading Data';
        }
    }
}

// Initialize application
async function init() {
    debug('Initializing comparison application');

    // Load subject data first
    const subjectDataLoaded = await loadSubjectData();

    // Initialize SVGs for both walkers
    initWalkerSVG('older');
    initWalkerSVG('younger');

    // Setup dropdowns and load initial data based on default selections
    // setupSubjectDropdowns will also trigger initial data load via change listeners
    if(subjectDataLoaded) {
        await setupSubjectDropdowns();
         // After initial data is loaded by setupSubjectDropdowns (via change events)
        // Update the start button state
        updateStartButtonState();
    } else {
         console.error('Subject data failed to load, cannot setup dropdowns or load initial stride data dynamically.');
         // Disable button and dropdowns if subject data failed
         if(startButton) {
             startButton.disabled = true;
             startButton.textContent = 'Error Loading Data';
         }
         if (subjectSelectOlder) subjectSelectOlder.disabled = true;
         if (subjectSelectYounger) subjectSelectYounger.disabled = true;
    }


    // Add event listener to the single start button
    if (startButton) {
         startButton.addEventListener('click', toggleWalking);
         debug('Start button event listener set up');
    } else {
        console.error('Start button not found!');
    }

    debug('Initialization complete for comparison view.');
}

// Start the application
init(); 