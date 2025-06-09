// Speed Predictor Model
function calculatePredictedSpeed(age, height, legLength, stride) {
    return 6.853
        - 0.03 * age
        + 0.05 * height
        - 0.01 * legLength
        - 1.51 * Math.log(age)
        + 0.93 * Math.sqrt(age)
        - 1.33 * Math.log(height)
        - 2.16 * stride;
}

function updatePredictedSpeed() {
    const age = parseFloat(document.getElementById('agePredictor').value);
    const height = parseFloat(document.getElementById('heightPredictor').value);
    const legLength = parseFloat(document.getElementById('legLengthPredictor').value);
    const stride = parseFloat(document.getElementById('stridePredictor').value);

    const predictedSpeed = calculatePredictedSpeed(age, height, legLength, stride);
    document.getElementById('predictedSpeed').textContent = predictedSpeed.toFixed(2) + ' m/s';
}

function initializeSpeedPredictor() {
    const sliders = ['agePredictor', 'heightPredictor', 'legLengthPredictor', 'stridePredictor'];
    const valueDisplays = ['ageValue', 'heightValue', 'legLengthValue', 'strideValue'];
    const units = ['months', 'inches', 'inches', 's'];

    sliders.forEach((sliderId, index) => {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(valueDisplays[index]);
        const unit = units[index];

        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            display.textContent = value.toFixed(unit === 's' ? 3 : 1) + ' ' + unit;
            updatePredictedSpeed();
        });
    });

    // Initial calculation
    updatePredictedSpeed();
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    
    // Initialize the speed predictor
    initializeSpeedPredictor();
}); 