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
    const oldSubject = data.find(d => d.group === "Old" && d.age === 148); // Subject 46

    // Load stride data for each subject
    await Promise.all([
        loadStrideData(youngSubject.id, youngSubject.age, "young"),
        loadStrideData(oldSubject.id, oldSubject.age, "old")
    ]);

    // Update walker info
    updateWalkerInfo("young", youngSubject);
    updateWalkerInfo("old", oldSubject);

    // Set up restart button
    document.getElementById("restartButton").addEventListener("click", toggleWalking);

    populateDropdowns();
}

async function loadStrideData(id, age, type) {
    try {
        let response = await fetch(`data/${id}_${age}.str`); // Try .str first
        let isStrFile = response.ok;
        if (!isStrFile) {
             response = await fetch(`data/${id}-${age}.txt`); // Fallback to .txt
             if (!response.ok) {
                 throw new Error(`Neither .str nor .txt file found for ${id}_${age}`);
             }
        }
        const text = await response.text();
        
        // Parse stride data (time and stride interval)
        const strideIntervals = text.split('\n')
            .filter(line => line.trim() && line.split(/\s+/).length >= 2)
            .map(line => {
                const parts = line.split(/\s+/);
                const time = Number(parts[0]);
                const interval = Number(parts[1]);
                 // Ensure interval is in milliseconds, assuming original might be in seconds based on stride-walker.js
                 // If data is already in ms, remove * 1000. Let's assume it's in seconds based on stride-walker.js adjustment.
                return { time, interval: interval * 1000 };
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
            rawData: strideIntervals // Keep raw data if needed later
        };
    } catch (error) {
        console.error(`Error loading or parsing stride data for ${type} (Subject ${id}, Age ${age}):`, error);
         // Provide dummy data or indicate failure if loading fails
         strideData[type] = {
             intervals: [500, 550, 600, 580, 520], // Dummy intervals in ms
             avgInterval: 550,
             stdDev: 30,
             rawData: []
         };
         console.warn(`Using dummy data for ${type}`);
    }
}

function updateWalkerInfo(type, data) {
    if (!data) return;

    const info = document.getElementById(`${type}Info`);
    if (!info) return; // Check if the info element exists
    const spans = info.getElementsByClassName("stat-value");
    if (spans.length > 0) spans[0].textContent = data.age; // Assuming age is first span
    if (spans.length > 1) spans[1].textContent = data.speed.toFixed(2); // Assuming speed is second
    if (spans.length > 2) spans[2].textContent = data.legLength.toFixed(1); // Assuming legLength is third
}

function toggleWalking() {
    isPlaying = !isPlaying;
    const button = document.getElementById("restartButton");
    if (!button) return; // Ensure button exists

    if (isPlaying) {
        button.textContent = "Pause ⏸️";
        // Only iterate over 'young' and 'old'
        ['young', 'old'].forEach(type => {
            const select = document.getElementById(type + 'Select');
            if (!select) return; // Ensure select exists
            const selectedId = parseInt(select.value);
            const subjectData = data.find(d => d.id === selectedId);

            if (!subjectData) return; // Ensure subject data is found

            // Calculate maxSpeed based on current dropdowns for Young and Old
            const youngSelect = document.getElementById('youngSelect');
            const oldSelect = document.getElementById('oldSelect');
            
            const selectedYoungSpeed = youngSelect ? data.find(d => d.id === parseInt(youngSelect.value))?.speed || 0 : 0;
            const selectedOldSpeed = oldSelect ? data.find(d => d.id === parseInt(oldSelect.value))?.speed || 0 : 0;

            const maxSpeed = Math.max(
                selectedYoungSpeed,
                selectedOldSpeed
            );

            const baseDuration = 20; // seconds for the slowest walker relative to maxSpeed
            animateWalker(type, subjectData, baseDuration, maxSpeed, true);
        });
    } else {
        button.textContent = "Play ▶️";
        // Cancel animation frames for all walkers - filter to 'young' and 'old'
        ['young', 'old'].forEach(type => {
             // Using a placeholder state object structure if needed, but per requirements, walkerStates is removed
             // This part might need adjustment depending on how animation frames are tracked globally or per type
             // Assuming animationFrameId is stored per type if needed, otherwise CSS animation pause is handled below
        });

        // --- Pause/resume CSS animation ---
        document.querySelectorAll('.kid-svg').forEach(walker => {
            walker.style.animationPlayState = isPlaying ? 'running' : 'paused';
        });

         // Reset position when pausing to -120px
        document.querySelectorAll('.kid-svg').forEach(walker => {
            walker.style.animation = 'none'; // Remove animation first
            walker.offsetHeight; // Trigger reflow
            walker.style.left = '-120px'; // Reset position
            // Don't re-add animation property here, it will be added on play
        });
    }

}

function animateWalker(type, subjectData, baseDuration, maxSpeed, resume = false) {
    const walker = document.querySelector(`.kid-svg.${type}`);
    const strideInfo = strideData[type]; // Use strideData for average interval/speed relation
    if (!strideInfo || !walker || !subjectData) return;

    // Calculate animation duration based on the selected subject's speed relative to maxSpeed
    // Duration should be inversely proportional to speed: faster speed means shorter duration
    const speed = subjectData.speed;
    // Avoid division by zero if speed is 0
    const duration = maxSpeed > 0 ? (baseDuration * (maxSpeed / speed)).toFixed(2) : baseDuration.toFixed(2);
    
    walker.style.animationDuration = `${duration}s`;

    // Add the 'animate' class if not already present (handles resume case)
    if (!walker.classList.contains('animate')) {
        walker.classList.add('animate');
    }

    // Set leg length based on subject data (scale: 1 SVG unit = 1 inch, but clamp to min 10, max 40 for visual)
    const legs = walker.querySelectorAll('rect[fill="#4ECDC4"]');
    const svgLegLength = Math.max(10, Math.min(40, subjectData.legLength * 1.2));
    legs.forEach((leg) => {
        leg.setAttribute('height', svgLegLength);
        leg.setAttribute('y', 115 - svgLegLength); // Adjust y to keep top of leg at 115 - svgLegLength
    });

    // Move the body and arms, head down so they sit above the legs
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
    // Hair and face elements - adjust their Y position based on head Y
    const hair1 = walker.querySelector('rect[x="35"][width="50"][height="10"]'); // Older hair
    const hair2 = walker.querySelector('rect[x="30"][width="10"][height="15"]');
    const hair3 = walker.querySelector('rect[x="80"][width="10"][height="15"]');
    const hairYoung1 = walker.querySelector('rect[x="45"][width="6"][height="15"]'); // Younger hair spikes
    const hairYoung2 = walker.querySelector('rect[x="55"][width="6"][height="17"]');
    const hairYoung3 = walker.querySelector('rect[x="65"][width="6"][height="15"]');

    const eyeLeft = walker.querySelector('rect[x="45"][width="5"][height="5"]');
    const eyeRight = walker.querySelector('rect[x="70"][width="5"][height="5"]');
    const nose = walker.querySelector('rect[x="57"][width="3"][height="3"]');
    const mouth = walker.querySelector('rect[x="50"][width="20"][height="3"]');

    const faceElements = [eyeLeft, eyeRight, nose, mouth];
    const hairElements = [hair1, hair2, hair3, hairYoung1, hairYoung2, hairYoung3];

    faceElements.forEach(el => { if(el) el.setAttribute('y', bodyY - 30); });
    if (nose) nose.setAttribute('y', bodyY - 20); // Nose is slightly lower
    if (mouth) mouth.setAttribute('y', bodyY - 10); // Mouth is lower still

    // Adjust hair based on type (assuming younger has spiky hair, older has flatter hair)
    if (type === 'young') {
         if (hairYoung1) hairYoung1.setAttribute('y', bodyY - 40); // Adjust Y relative to head
         if (hairYoung2) hairYoung2.setAttribute('y', bodyY - 42); // Adjust Y relative to head
         if (hairYoung3) hairYoung3.setAttribute('y', bodyY - 40); // Adjust Y relative to head
         // Hide older hair elements if they exist on the SVG
         if (hair1) hair1.style.display = 'none';
         if (hair2) hair2.style.display = 'none';
         if (hair3) hair3.style.display = 'none';
    } else { // Assuming 'old'
         if (hair1) hair1.setAttribute('y', bodyY - 45); // Adjust Y relative to head
         if (hair2) hair2.setAttribute('y', bodyY - 40); // Adjust Y relative to head
         if (hair3) hair3.setAttribute('y', bodyY - 40); // Adjust Y relative to head
         // Hide younger hair elements if they exist on the SVG
         if (hairYoung1) hairYoung1.style.display = 'none';
         if (hairYoung2) hairYoung2.style.display = 'none';
         if (hairYoung3) hairYoung3.style.display = 'none';
    }


    // --- Leg Jitter Animation (using requestAnimationFrame) ---
    // This part keeps the leg movement within the SVG independent of the main translation
    // Need a state per walker for this animation frame ID and step tracking
    if (!walkerStates[type]) {
         walkerStates[type] = {
             legStep: 0,
             legLastTime: 0,
             legFrameId: null // Use a distinct frame ID for leg animation
         };
    }

    let state = walkerStates[type];

    // Clear previous leg animation frame if exists
    if (state.legFrameId) {
        cancelAnimationFrame(state.legFrameId);
    }

    function legJitterLoop(timestamp) {
        if (!isPlaying) {
             // Reset legs to straight position when paused
             legs.forEach(leg => { leg.style.transform = 'translateY(0)'; });
             state.legStep = 0;
             state.legLastTime = 0;
             state.legFrameId = null;
             return;
        }

        if (!state.legLastTime) state.legLastTime = timestamp;

        // Calculate time per step based on the subject's average stride interval
        // Use average interval from loaded stride data
        const avgInterval = strideInfo.avgInterval || 600; // Default if not available
        const timePerStep = avgInterval / 2; // One step is half a stride cycle (right foot, then left foot)

        if (timestamp - state.legLastTime >= timePerStep) {
            legs.forEach((leg, index) => {
                // Assuming first rect is left leg, second is right leg
                const isLeftLeg = index === 0;
                // Alternate the 'up' position for left and right legs on each step
                const isStepUp = state.legStep % 2 === (isLeftLeg ? 0 : 1);
                // Simple transform for now, can be made more complex
                leg.style.transform = isStepUp ? 'translateY(-15px)' : 'translateY(0)';
            });
            state.legStep++;
            state.legLastTime = timestamp;
        }

        state.legFrameId = requestAnimationFrame(legJitterLoop);
    }

     if (isPlaying) {
          // Start the leg jitter animation loop
          state.legFrameId = requestAnimationFrame(legJitterLoop);
     }

    // Store the updated state back (important if state is not modified by reference)
    walkerStates[type] = state;
}

// Populate dropdowns and set up listeners
function populateDropdowns() {
    const groups = {
        young: data.filter(d => d.group === 'Young'),
        old: data.filter(d => d.group === 'Old') // Filter to only include Young and Old
    };
    // Populate each dropdown
    Object.entries(groups).forEach(([type, arr]) => {
        const select = document.getElementById(type + 'Select');
         if (!select) return; // Ensure select element exists

        select.innerHTML = arr.map(d => `<option value="${d.id}">${d.id}: Age ${d.age} (${d.gender})</option>`).join('');
        // Set default selection
        if (type === 'young') select.value = '9'; // Default for Young
        if (type === 'old') select.value = '46'; // Default for Old

        select.onchange = async () => { // Made async because loadStrideData is async
            // Stop current animation and reset everything
            isPlaying = false;
            const restartButton = document.getElementById("restartButton");
            if(restartButton) restartButton.textContent = "Play ▶️";

            // Stop leg jitter animations for all walkers
             ['young', 'old'].forEach(walkerType => {
                 if (walkerStates[walkerType] && walkerStates[walkerType].legFrameId) {
                     cancelAnimationFrame(walkerStates[walkerType].legFrameId);
                     walkerStates[walkerType].legFrameId = null;
                      // Reset leg position in SVG
                     const walkerSvg = document.querySelector(`.kid-svg.${walkerType}`);
                     if(walkerSvg) {
                         const legs = walkerSvg.querySelectorAll('rect[fill="#4ECDC4"]');
                         legs.forEach(leg => { leg.style.transform = 'translateY(0)'; });
                     }
                 }
             });

            // Reset CSS animation state and position for all walkers
             document.querySelectorAll('.kid-svg').forEach(walker => {
                 walker.style.animation = 'none';
                 walker.offsetHeight; // Trigger reflow
                 walker.style.left = '-120px';
                 walker.style.animationPlayState = 'paused';
             });

            // For selected group, update the walker card and load new stride data
            const groupSelect = document.getElementById(type + 'Select');
            const groupArr = groups[type];
            const selected = groupArr.find(d => d.id == groupSelect.value);
            
            if (selected) {
                updateWalkerCard(type, selected);
                // Load new stride data for the selected subject
                await loadStrideData(selected.id, selected.age, type);
            } else {
                console.error(`Selected subject data not found for type: ${type}`);
                // Handle case where selected subject is not found (e.g., clear stats)
                 updateWalkerInfo(type, null); // Clear info display
                 strideData[type] = {}; // Clear stride data
            }
             // After updating one card/data, ensure all walkers' appearance is correct based on current selections (e.g., leg length)
             ['young', 'old'].forEach(walkerType => {
                const currentSelect = document.getElementById(walkerType + 'Select');
                const currentArr = groups[walkerType];
                const currentSelected = currentArr.find(d => d.id == currentSelect.value);
                 if(currentSelected) {
                      // Re-apply size/positioning that depends on subject data (like leg length)
                      const walkerSvg = document.querySelector(`.kid-svg.${walkerType}`);
                      if(walkerSvg) {
                           // Re-run the part of animateWalker that sets leg length and body position
                            const legs = walkerSvg.querySelectorAll('rect[fill="#4ECDC4"]');
                            const svgLegLength = Math.max(10, Math.min(40, currentSelected.legLength * 1.2));
                            legs.forEach((leg) => {
                                leg.setAttribute('height', svgLegLength);
                                leg.setAttribute('y', 115 - svgLegLength);
                            });

                             const bodyHeight = 35;
                            const bodyY = 115 - svgLegLength - bodyHeight;
                            const body = walkerSvg.querySelector('rect[x="45"][width="30"][height="35"]');
                            if (body) body.setAttribute('y', bodyY);
                            const leftArm = walkerSvg.querySelector('rect[x="30"][width="15"][height="20"]');
                            const rightArm = walkerSvg.querySelector('rect[x="75"][width="15"][height="20"]');
                            if (leftArm) { leftArm.setAttribute('y', bodyY + 5); leftArm.setAttribute('x', 30); }
                            if (rightArm) { rightArm.setAttribute('y', bodyY + 5); rightArm.setAttribute('x', 75); }

                            const head = walkerSvg.querySelector('rect[x="40"][width="40"][height="40"]');
                            if (head) { head.setAttribute('y', bodyY - 40); head.setAttribute('x', 40); }

                             // Re-position hair and face elements
                             const eyeLeft = walkerSvg.querySelector('rect[x="45"][width="5"][height="5"]');
                             const eyeRight = walkerSvg.querySelector('rect[x="70"][width="5"][height="5"]');
                             const nose = walkerSvg.querySelector('rect[x="57"][width="3"][height="3"]');
                             const mouth = walkerSvg.querySelector('rect[x="50"][width="20"][height="3"]');

                            if(eyeLeft) eyeLeft.setAttribute('y', bodyY - 30);
                            if(eyeRight) eyeRight.setAttribute('y', bodyY - 30);
                            if(nose) nose.setAttribute('y', bodyY - 20);
                            if(mouth) mouth.setAttribute('y', bodyY - 10);

                           // Handle hair visibility and position based on type
                            const hair1 = walkerSvg.querySelector('rect[x="35"][width="50"][height="10"]'); // Older hair
                            const hair2 = walkerSvg.querySelector('rect[x="30"][width="10"][height="15"]');
                            const hair3 = walkerSvg.querySelector('rect[x="80"][width="10"][height="15"]');
                            const hairYoung1 = walkerSvg.querySelector('rect[x="45"][width="6"][height="15"]'); // Younger hair spikes
                            const hairYoung2 = walkerSvg.querySelector('rect[x="55"][width="6"][height="17"]');
                            const hairYoung3 = walkerSvg.querySelector('rect[x="65"][width="6"][height="15"]');

                            if (walkerType === 'young') {
                                 if (hairYoung1) { hairYoung1.setAttribute('y', bodyY - 40); hairYoung1.style.display = ''; }
                                 if (hairYoung2) { hairYoung2.setAttribute('y', bodyY - 42); hairYoung2.style.display = ''; }
                                 if (hairYoung3) { hairYoung3.setAttribute('y', bodyY - 40); hairYoung3.style.display = ''; }
                                 if (hair1) hair1.style.display = 'none';
                                 if (hair2) hair2.style.display = 'none';
                                 if (hair3) hair3.style.display = 'none';
                            } else { // 'old'
                                 if (hair1) { hair1.setAttribute('y', bodyY - 45); hair1.style.display = ''; }
                                 if (hair2) { hair2.setAttribute('y', bodyY - 40); hair2.style.display = ''; }
                                 if (hair3) { hair3.setAttribute('y', bodyY - 40); hair3.style.display = ''; }
                                 if (hairYoung1) hairYoung1.style.display = 'none';
                                 if (hairYoung2) hairYoung2.style.display = 'none';
                                 if (hairYoung3) hairYoung3.style.display = 'none';
                            }
                      }
                 }
             });
        };
        // Initial render based on default selection
         const initialSelected = arr.find(d => d.id == select.value);
         if(initialSelected) {
              updateWalkerCard(type, initialSelected);
              // Also load stride data initially
             loadStrideData(initialSelected.id, initialSelected.age, type);
         } else {
              console.error(`Initial subject data not found for type: ${type}`);
             updateWalkerInfo(type, null);
             strideData[type] = {};
         }
    });
}

// Update stats and animation duration for a group (Simplified)
function updateWalkerCard(type, subjectData) {
     if (!subjectData) return; // Ensure data is valid

    // Update stats
    updateWalkerInfo(type, subjectData);

    // Note: Rendering SVG content is no longer needed here as SVGs are static in HTML
    // The animateWalker function now handles dynamic aspects like leg length and body position

    // Animation: set duration if playing. Reset position if not playing.
    const svg = document.querySelector(`.kid-svg.${type}`);
    if (!svg) return; // Ensure SVG exists

    if (isPlaying) {
        // Recalculate maxSpeed based on current selections when updating a card while playing
        const youngSelect = document.getElementById('youngSelect');
        const oldSelect = document.getElementById('oldSelect');
        
        const selectedYoungSpeed = youngSelect ? data.find(d => d.id === parseInt(youngSelect.value))?.speed || 0 : 0;
        const selectedOldSpeed = oldSelect ? data.find(d => d.id === parseInt(oldSelect.value))?.speed || 0 : 0;

        const maxSpeed = Math.max(
            selectedYoungSpeed,
            selectedOldSpeed
        );

        const baseDuration = 20; // seconds reference
         const speed = subjectData.speed;
         const duration = maxSpeed > 0 ? (baseDuration * (maxSpeed / speed)).toFixed(2) : baseDuration.toFixed(2);
        
        svg.style.animationDuration = `${duration}s`;
        // Ensure animate class is present and animation is running
        if (!svg.classList.contains('animate')) svg.classList.add('animate');
        svg.style.animationPlayState = 'running';

        // Restart leg jitter animation if needed
        if(isPlaying) {
             // The leg jitter loop is started/stopped by toggleWalking/populateDropdowns change handler
             // Need to make sure it's running for this walker if isPlaying is true
             if (!walkerStates[type] || !walkerStates[type].legFrameId) {
                  animateWalker(type, subjectData, baseDuration, maxSpeed, true); // Call to restart leg jitter
             }
        }

    } else {
        // When not playing, remove animation and reset position
        svg.style.animation = 'none';
        svg.offsetHeight; // Trigger reflow
        svg.style.left = '-120px'; // Reset to start
        svg.style.animationPlayState = 'paused';
         svg.classList.remove('animate'); // Ensure animate class is removed
    }
     // Always update leg length and body position as this depends on the selected subject
     animateWalker(type, subjectData, 20, 1, false); // Call animateWalker to update static positioning parts even when not playing
}

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", loadData); 