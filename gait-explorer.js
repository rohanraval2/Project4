let explorerData = [];
let explorerStrideData = [];
let explorerIsPlaying = false;
let explorerWalkerState = { pos: -120, step: 0, frameId: null };
let explorerCurrentSubject = null;

async function loadExplorerData() {
  // Load summary data
  const response = await fetch('table.csv');
  const text = await response.text();
  const rows = text.trim().split('\n').slice(1);
  explorerData = rows.map(row => {
    const [id, age, gender, height, weight, legLength, speed, group] = row.split(',');
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
  populateExplorerDropdown();
}

function populateExplorerDropdown() {
  const select = document.getElementById('subjectSelect');
  select.innerHTML = explorerData.map(d => `<option value="${d.id}">${d.id}: Age ${d.age} (${d.gender}, ${d.group})</option>`).join('');
  select.value = '9'; // default to subject 9
  select.onchange = () => {
    explorerWalkerState.pos = -120;
    explorerWalkerState.step = 0;
    explorerWalkerState.frameId = null;
    explorerIsPlaying = false;
    document.getElementById('explorerPlay').textContent = 'Start Walk';
    document.getElementById('narrationBox').textContent = 'Select a child and click "Start Walk" to experience their gait!';
    renderExplorerWalker();
  };
  renderExplorerWalker();
}

async function loadExplorerStrideData(subject) {
  try {
    const response = await fetch(`data/${subject.id}_${subject.age}.str`);
    const text = await response.text();
    explorerStrideData = text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [time, interval] = line.split(/\s+/).map(Number);
        return { time, interval };
      })
      .filter(d => !isNaN(d.interval));
  } catch (e) {
    explorerStrideData = [];
  }
}

function renderExplorerWalker() {
  const select = document.getElementById('subjectSelect');
  const subject = explorerData.find(d => d.id == select.value);
  explorerCurrentSubject = subject;
  // Render SVG (reuse getWalkerSVG from comparison.js if available)
  const svg = document.getElementById('explorerWalker');
  svg.innerHTML = getExplorerWalkerSVG(subject);
  svg.style.left = '-120px';
}

function getExplorerWalkerSVG(subject) {
  // Young = spiky, lollipop; others = classic
  if (subject.group === 'Young') {
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

async function explorerStartWalk() {
  if (!explorerCurrentSubject) return;
  await loadExplorerStrideData(explorerCurrentSubject);
  explorerIsPlaying = true;
  document.getElementById('explorerPlay').textContent = 'Pause';
  explorerWalkerState.pos = -120;
  explorerWalkerState.step = 0;
  explorerWalkerState.frameId = null;
  explorerWalkLoop();
}

function explorerWalkLoop() {
  if (!explorerIsPlaying) return;
  const svg = document.getElementById('explorerWalker');
  const ground = svg.parentElement;
  const groundWidth = ground.offsetWidth;
  const walkerWidth = 120;
  let state = explorerWalkerState;
  // Use stride intervals for step timing
  let stride = explorerStrideData[state.step % explorerStrideData.length]?.interval || 1.0;
  // Move position
  state.pos += (groundWidth + walkerWidth) / (explorerCurrentSubject.speed * 60); // 60fps
  if (state.pos > groundWidth) {
    state.pos = -walkerWidth; // Loop back to start
    state.step = 0;
    document.getElementById('narrationBox').textContent = getExplorerNarration();
  }
  svg.style.left = `${state.pos}px`;
  // Leg jitter (simple up/down)
  const legs = svg.querySelectorAll('rect[fill="#4ECDC4"]');
  legs.forEach((leg, index) => {
    const isLeftLeg = index === 0;
    const isStep = state.step % 2 === (isLeftLeg ? 0 : 1);
    leg.style.transform = isStep ? 'translateY(-25px)' : 'translateY(0)';
  });
  // Narration update at each step
  if (state.frameId % Math.round(60 * stride) === 0) {
    document.getElementById('narrationBox').textContent = getExplorerNarration();
  }
  state.step++;
  explorerWalkerState = state;
  state.frameId = requestAnimationFrame(explorerWalkLoop);
}

function getExplorerNarration() {
  // Use stride variability to generate a message
  if (!explorerStrideData.length) return '';
  const intervals = explorerStrideData.map(d => d.interval);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const std = Math.sqrt(intervals.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / intervals.length);
  if (std < 0.05) return 'This walk is very steady and confident.';
  if (std < 0.12) return 'This walk is mostly steady, with a little natural variation.';
  if (std < 0.2) return 'You notice some wobbles and uneven steps.';
  return 'This walk is quite unsteady, with lots of variation between steps!';
}

function explorerPauseWalk() {
  explorerIsPlaying = false;
  document.getElementById('explorerPlay').textContent = 'Start Walk';
  if (explorerWalkerState.frameId) {
    cancelAnimationFrame(explorerWalkerState.frameId);
    explorerWalkerState.frameId = null;
  }
}

function explorerResetWalk() {
  explorerPauseWalk();
  explorerWalkerState.pos = -120;
  explorerWalkerState.step = 0;
  renderExplorerWalker();
  document.getElementById('narrationBox').textContent = 'Select a child and click "Start Walk" to experience their gait!';
}

document.addEventListener('DOMContentLoaded', () => {
  loadExplorerData();
  document.getElementById('explorerPlay').onclick = () => {
    if (explorerIsPlaying) {
      explorerPauseWalk();
    } else {
      explorerStartWalk();
    }
  };
  document.getElementById('explorerReset').onclick = explorerResetWalk;
}); 