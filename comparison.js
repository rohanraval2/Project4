let data;
let strideData = {};
let isPlaying = false;
let walkerStates = {};

async function loadData() {
    // Load summary data
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

    // Load stride data for selected subjects
    const youngSubject = data.find(d => d.group === "Young" && d.age === 54); // Subject 9
    //const middleSubject = data.find(d => d.group === "Middle" && d.age === 85); // Subject 22
    const oldSubject = data.find(d => d.group === "Old" && d.age === 148); // Subject 46

    // Load stride data for each subject
    await Promise.all([
        loadStrideData(youngSubject.id, youngSubject.age, "young"),
        //loadStrideData(middleSubject.id, middleSubject.age, "middle"),
        loadStrideData(oldSubject.id, oldSubject.age, "old")
    ]);

    // Update walker info
    updateWalkerInfo("young", youngSubject);
    //updateWalkerInfo("middle", middleSubject);
    updateWalkerInfo("old", oldSubject);

    // Set up restart button
    document.getElementById("restartButton").addEventListener("click", toggleWalking);

    populateDropdowns();
}

async function loadStrideData(id, age, type) {
    try {
        const response = await fetch(`data/${id}_${age}.str`);
        const text = await response.text();
        
        // Parse stride data (time and stride interval)
        const strideIntervals = text.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [time, interval] = line.split(/\s+/).map(Number);
                return { time, interval };
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
        ['young', 'old'].forEach(type => {
            // Get current selected subject for this group
            const select = document.getElementById(type + 'Select');
            const selectedId = parseInt(select.value);
            const subjectData = data.find(d => d.id === selectedId);

            // Calculate maxSpeed based on current dropdowns
            const maxSpeed = Math.max(
                data.find(d => d.id === parseInt(document.getElementById('youngSelect').value)).speed,
                //data.find(d => d.id === parseInt(document.getElementById('middleSelect').value)).speed,
                data.find(d => d.id === parseInt(document.getElementById('oldSelect').value)).speed
            );

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

function startWalking(resume = false) {
    // Reset all walkers to starting position if not resuming
    const walkers = document.querySelectorAll('.kid-svg');
    if (!resume) {
        walkers.forEach(walker => {
            walker.style.animation = 'none';
            walker.offsetHeight; // Trigger reflow
            walker.style.animation = null;
            walker.classList.remove('animate');
            walker.style.left = '-120px';
        });
        walkerStates = {};
    }

    // Get the data points again
    const youngData = data.find(d => d.group === "Young" && d.age === 54);
    //const middleData = data.find(d => d.group === "Middle" && d.age === 85);
    const oldData = data.find(d => d.group === "Old" && d.age === 148);

    // Calculate base animation parameters
    const baseDuration = 20; // seconds for the slowest walker
    const maxSpeed = Math.max(youngData.speed, oldData.speed);
    
    // Apply animations with stride-based timing
    animateWalker('young', youngData, baseDuration, maxSpeed, resume);
    //animateWalker('middle', middleData, baseDuration, maxSpeed, resume);
    animateWalker('old', oldData, baseDuration, maxSpeed, resume);
}

function calculateTotalDuration(type, baseDuration, maxSpeed) {
    const data = strideData[type];
    if (!data) return baseDuration;

    const subjectData = type === 'young' ? data.find(d => d.group === "Young" && d.age === 54) :
                       //type === 'middle' ? data.find(d => d.group === "Middle" && d.age === 85) :
                       data.find(d => d.group === "Old" && d.age === 148);

    const speedRatio = maxSpeed / subjectData.speed;
    return baseDuration * speedRatio;
}

function animateWalker(type, subjectData, baseDuration, maxSpeed, resume = false) {
    const walker = document.querySelector(`.kid-svg.${type}`);
    const strideInfo = strideData[type];
    if (!strideInfo || !walker) return;

    // Calculate animation duration based on average stride interval
    const speedRatio = maxSpeed / subjectData.speed;
    const duration = (baseDuration * speedRatio).toFixed(2);
    walker.style.animationDuration = `${duration}s`;
    walker.classList.add('animate');

    // Set leg length based on subject data (scale: 1 SVG unit = 1 inch, but clamp to min 10, max 40 for visual)
    const legs = walker.querySelectorAll('rect[fill="#4ECDC4"]');
    const svgLegLength = Math.max(10, Math.min(40, subjectData.legLength * 1.2));
    legs.forEach((leg) => {
        leg.setAttribute('height', svgLegLength);
        leg.setAttribute('y', 115 - svgLegLength);
    });

    // Move the body and arms down so they sit above the legs
    const bodyHeight = 35;
    const bodyY = 115 - svgLegLength - bodyHeight;
    const body = walker.querySelector('rect[x="45"][width="30"][height="35"]');
    if (body) body.setAttribute('y', bodyY);
    const leftArm = walker.querySelector('rect[x="30"][width="15"][height="20"]');
    const rightArm = walker.querySelector('rect[x="75"][width="15"][height="20"]');
    if (leftArm) leftArm.setAttribute('y', bodyY + 5);
    if (rightArm) rightArm.setAttribute('y', bodyY + 5);
    const head = walker.querySelector('rect[x="40"][width="40"][height="40"]');
    if (head) head.setAttribute('y', bodyY - 40);
    const hair1 = walker.querySelector('rect[x="35"][width="50"][height="10"]');
    const hair2 = walker.querySelector('rect[x="30"][width="10"][height="15"]');
    const hair3 = walker.querySelector('rect[x="80"][width="10"][height="15"]');
    if (hair1) hair1.setAttribute('y', bodyY - 45);
    if (hair2) hair2.setAttribute('y', bodyY - 40);
    if (hair3) hair3.setAttribute('y', bodyY - 40);
    const leftEye = walker.querySelector('rect[x="45"][width="5"][height="5"]');
    const rightEye = walker.querySelector('rect[x="70"][width="5"][height="5"]');
    if (leftEye) leftEye.setAttribute('y', bodyY - 30);
    if (rightEye) rightEye.setAttribute('y', bodyY - 30);
    const nose = walker.querySelector('rect[x="57"][width="3"][height="3"]');
    if (nose) nose.setAttribute('y', bodyY - 20);
    const mouth = walker.querySelector('rect[x="50"][width="20"][height="3"]');
    if (mouth) mouth.setAttribute('y', bodyY - 10);

    // --- Animation state ---
    if (!walkerStates[type] || !resume) {
        walkerStates[type] = {
            pos: -120, // px, start off screen
            step: 0,
            legStep: 0,
            frameId: null
        };
    }

    function walkLoop() {
        if (!isPlaying) return;
        const ground = walker.parentElement;
        const groundWidth = ground.offsetWidth;
        const walkerWidth = 120;
        let state = walkerStates[type];
        // Move position
        state.pos += (groundWidth + walkerWidth) / (duration * 60); // 60fps
        if (state.pos > groundWidth) {
            state.pos = -walkerWidth; // Loop back to start
        }
        walker.style.left = `${state.pos}px`;
        // Leg jitter
        const stepsPerSecond = 4;
        const strideInterval = 1000 / stepsPerSecond;
        if (!state.legLastTime || Date.now() - state.legLastTime > strideInterval) {
            const legs = walker.querySelectorAll('rect[fill="#4ECDC4"]');
            legs.forEach((leg, index) => {
                const isLeftLeg = index === 0;
                const isStep = state.legStep % 2 === (isLeftLeg ? 0 : 1);
                leg.style.transform = isStep ? 'translateY(-25px)' : 'translateY(0)';
            });
            state.legStep++;
            state.legLastTime = Date.now();
        }
        walkerStates[type] = state;
        state.frameId = requestAnimationFrame(walkLoop);
    }
    if (isPlaying) walkLoop();
}

// Helper to render the SVG for a walker (returns SVG string)
function getWalkerSVG(type) {
    if (type === 'young') {
        return `
            <rect x="40" y="20" width="40" height="40" fill="#FFD700"></rect>
            <rect x="45" y="10" width="6" height="15" fill="#8B4513" transform="rotate(-15 48 17)"></rect>
            <rect x="55" y="8" width="6" height="17" fill="#8B4513"></rect>
            <rect x="65" y="10" width="6" height="15" fill="#8B4513" transform="rotate(15 68 17)"></rect>
            <rect x="45" y="30" width="5" height="5" fill="#000"></rect>
            <rect x="70" y="30" width="5" height="5" fill="#000"></rect>
            <rect x="57" y="40" width="3" height="3" fill="#FF69B4"></rect>
            <rect x="50" y="50" width="20" height="3" fill="#000"></rect>
            <rect x="63" y="53" width="6" height="25" fill="#B5651D" rx="3"></rect>
            <circle cx="66" cy="78" r="10" fill="#FF2222" stroke="#fff" stroke-width="3"/>
            <rect x="45" y="60" width="30" height="35" fill="#FF6B6B"></rect>
            <rect x="30" y="65" width="15" height="20" fill="#FFD700"></rect>
            <rect x="75" y="65" width="15" height="20" fill="#FFD700"></rect>
            <rect x="50" y="95" width="8" height="20" fill="#4ECDC4"></rect>
            <rect x="62" y="95" width="8" height="20" fill="#4ECDC4"></rect>
            <rect x="45" y="115" width="18" height="5" fill="#000"></rect>
            <rect x="57" y="115" width="18" height="5" fill="#000"></rect>
        `;
    } else {
        return `
            <rect x="40" y="20" width="40" height="40" fill="#FFD700"></rect>
            <rect x="35" y="15" width="50" height="10" fill="#8B4513"></rect>
            <rect x="30" y="20" width="10" height="15" fill="#8B4513"></rect>
            <rect x="80" y="20" width="10" height="15" fill="#8B4513"></rect>
            <rect x="45" y="30" width="5" height="5" fill="#000"></rect>
            <rect x="70" y="30" width="5" height="5" fill="#000"></rect>
            <rect x="57" y="40" width="3" height="3" fill="#FF69B4"></rect>
            <rect x="50" y="50" width="20" height="3" fill="#000"></rect>
            <rect x="45" y="60" width="30" height="35" fill="#FF6B6B"></rect>
            <rect x="30" y="65" width="15" height="20" fill="#FFD700"></rect>
            <rect x="75" y="65" width="15" height="20" fill="#FFD700"></rect>
            <rect x="50" y="95" width="8" height="20" fill="#4ECDC4"></rect>
            <rect x="62" y="95" width="8" height="20" fill="#4ECDC4"></rect>
            <rect x="45" y="115" width="18" height="5" fill="#000"></rect>
            <rect x="57" y="115" width="18" height="5" fill="#000"></rect>
        `;
    }
}

// Populate dropdowns and set up listeners
function populateDropdowns() {
    const groups = {
        young: data.filter(d => d.group === 'Young'),
        //middle: data.filter(d => d.group === 'Middle'),
        old: data.filter(d => d.group === 'Old')
    };
    // Populate each dropdown
    Object.entries(groups).forEach(([type, arr]) => {
        const select = document.getElementById(type + 'Select');
        select.innerHTML = arr.map(d => `<option value="${d.id}">${d.id}: Age ${d.age} (${d.gender})</option>`).join('');
        // Set default selection
        if (type === 'young') select.value = '9';
        //if (type === 'middle') select.value = '22';
        if (type === 'old') select.value = '46';
        select.onchange = () => {
            // Stop animation and reset everything
            isPlaying = false;
            document.getElementById("restartButton").textContent = "Play ▶️";
            Object.values(walkerStates).forEach(state => {
                if (state && state.frameId) {
                    cancelAnimationFrame(state.frameId);
                    state.frameId = null;
                }
            });
            // For all groups, update the walker card and reset the SVG/position
            ['young', 'middle', 'old'].forEach(groupType => {
                const groupSelect = document.getElementById(groupType + 'Select');
                const groupArr = groups[groupType];
                const selected = groupArr.find(d => d.id == groupSelect.value);
                updateWalkerCard(groupType, selected);
            });
        };
        // Initial render
        updateWalkerCard(type, arr.find(d => d.id == select.value));
    });
}

// Update stats and animation for a group
function updateWalkerCard(type, subjectData) {
    // Update stats
    const info = document.getElementById(type + 'Info');
    const spans = info.getElementsByClassName('stat-value');
    spans[0].textContent = subjectData.age;
    spans[1].textContent = subjectData.speed.toFixed(2);
    spans[2].textContent = subjectData.legLength.toFixed(1);
    // Render SVG
    const svg = document.querySelector(`.kid-svg.${type}`);
    svg.innerHTML = getWalkerSVG(type);

    // --- Animation: set duration and restart only if playing ---
    svg.classList.remove('animate');
    void svg.offsetWidth;
    if (isPlaying) {
        const duration = (10 / subjectData.speed).toFixed(2);
        svg.style.animationDuration = `${duration}s`;
        svg.classList.add('animate');
        svg.style.animationPlayState = 'running';
    } else {
        svg.style.animationDuration = '';
        svg.style.left = '-120px'; // Reset to start
        svg.style.animationPlayState = 'paused';
    }
}

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", loadData); 