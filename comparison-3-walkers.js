// === comparison-3walker.js ===

// Hardcoded subjects:
const youngSubject = { id: 9, age: 54 };
const middleSubject = { id: 15, age: 79 };
const oldSubject = { id: 50, age: 163 };

// Walker states:
const walkerStates = {
    young: { isWalking: false, currentStepIndex: 0, animationFrameId: null },
    middle: { isWalking: false, currentStepIndex: 0, animationFrameId: null },
    old: { isWalking: false, currentStepIndex: 0, animationFrameId: null },
};

// Start button
const startButton = document.getElementById("startButton");

// Initialize SVGs
initWalkerSVG("young");
initWalkerSVG("middle");
initWalkerSVG("old");

// Load stride data
loadStrideData(youngSubject.id, youngSubject.age, "young");
loadStrideData(middleSubject.id, middleSubject.age, "middle");
loadStrideData(oldSubject.id, oldSubject.age, "old");

// Add Start button listener
startButton.addEventListener("click", toggleWalking);

// === Full real functions ===

function initWalkerSVG(walkerId) {
    const svg = document.querySelector(`.kid-svg.${walkerId}`);
    if (!svg) return;

    svg.innerHTML = `
        <rect x="40" y="20" width="30" height="30" fill="#FFD700"></rect> <!-- head -->
        <rect x="40" y="50" width="20" height="30" fill="#FF6B6B"></rect> <!-- body -->
        <g class="leg left-leg" transform="translate(40,80)">
            <rect class="thigh" x="0" y="0" width="5" height="15" fill="#4ECDC4"></rect>
            <rect class="calf" x="0" y="15" width="5" height="15" fill="#4ECDC4"></rect>
        </g>
        <g class="leg right-leg" transform="translate(50,80)">
            <rect class="thigh" x="0" y="0" width="5" height="15" fill="#4ECDC4"></rect>
            <rect class="calf" x="0" y="15" width="5" height="15" fill="#4ECDC4"></rect>
        </g>
    `;
}

function loadStrideData(subjectId, age, walkerId) {
    fetch(`data/${subjectId}-${age}.txt`)
        .then((response) => response.text())
        .then((text) => {
            const intervals = text
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                    const [time, interval] = line.split(/\s+/).map(Number);
                    return interval * 1000; // convert seconds to ms
                });

            walkerStates[walkerId].strideData = intervals;

            // Update stats (example using table.csv-like data):
            document.getElementById(`${walkerId}Age`).textContent = age;
            // Here you can set speed and leg length if you want (placeholder for now):
            document.getElementById(`${walkerId}Speed`).textContent = "-";
            document.getElementById(`${walkerId}LegLength`).textContent = "-";
        });
}

function animateWalker(walkerId) {
    const state = walkerStates[walkerId];
    if (!state.isWalking) return;

    const svg = document.querySelector(`.kid-svg.${walkerId}`);
    if (!svg) return;

    const leftLegGroup = svg.querySelector(".left-leg");
    const rightLegGroup = svg.querySelector(".right-leg");

    const stepIndex = state.currentStepIndex;
    const strideData = state.strideData;
    const currentInterval = strideData[stepIndex];

    // Basic leg animation (alternate legs)
    if (stepIndex % 2 === 0) {
        leftLegGroup.setAttribute("transform", "translate(40,80) rotate(15)");
        rightLegGroup.setAttribute("transform", "translate(50,80) rotate(0)");
    } else {
        leftLegGroup.setAttribute("transform", "translate(40,80) rotate(0)");
        rightLegGroup.setAttribute("transform", "translate(50,80) rotate(15)");
    }

    // Advance step
    state.currentStepIndex = (state.currentStepIndex + 1) % strideData.length;

    // Schedule next frame
    state.animationFrameId = setTimeout(() => animateWalker(walkerId), currentInterval * 0.5); // 2x speed
}

function startWalking(walkerId) {
    const state = walkerStates[walkerId];
    if (!state.strideData || state.strideData.length === 0) return;

    state.isWalking = true;
    state.currentStepIndex = 0;
    animateWalker(walkerId);
}

function stopWalking(walkerId) {
    const state = walkerStates[walkerId];
    state.isWalking = false;
    if (state.animationFrameId !== null) {
        clearTimeout(state.animationFrameId);
        state.animationFrameId = null;
    }

    // Reset leg positions
    const svg = document.querySelector(`.kid-svg.${walkerId}`);
    if (svg) {
        const leftLegGroup = svg.querySelector(".left-leg");
        const rightLegGroup = svg.querySelector(".right-leg");
        leftLegGroup.setAttribute("transform", "translate(40,80) rotate(0)");
        rightLegGroup.setAttribute("transform", "translate(50,80) rotate(0)");
    }
}

function toggleWalking() {
    const anyWalking = walkerStates.young.isWalking || walkerStates.middle.isWalking || walkerStates.old.isWalking;

    if (anyWalking) {
        stopWalking("young");
        stopWalking("middle");
        stopWalking("old");
        startButton.textContent = "Start Walking";
    } else {
        startWalking("young");
        startWalking("middle");
        startWalking("old");
        startButton.textContent = "Stop Walking";
    }
}
