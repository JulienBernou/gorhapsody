// app.js
let goBoard;
let gameData = [];
let wgoPlayer;
let currentMoveIndex = -1;
let playbackIntervalId = null;
let playbackSpeed = 250;
const gamma = .999;

// --- NEW: Detailed, Controllable Music Configuration ---
// This object now defines the *entire* musical behavior and will be manipulated by the UI.
const musicControls = {
    'Capture': { label: '💥 Capture', instrument: 'membraneSynth', note: 'C3', volume: -5, duration: '0.4s' },
    'Atari': { label: '❗ Atari', instrument: 'gentleSynth', note: 'tension_chord', volume: -6, duration: '8n' },
    'Atari Threat': { label: '⚠️ Atari Threat', instrument: 'gentleSynth', note: 'tension_dyad', volume: -8, duration: '16n' },
    'Star Point': { label: '⭐ Star Point', instrument: 'marimbaSynth', note: 'C4', volume: -9, duration: '2n' },
    '3-3 Point': { label: '🏡 3-3 Point', instrument: 'gentleSynth', note: 'C2', volume: -10, duration: '1n' },
    '3-4 Point': { label: '🎯 3-4 Point', instrument: 'marimbaSynth', note: 'E4', volume: -10, duration: '2n' },
    'First Corner Play': { label: '🚩 First Corner', instrument: 'gentleSynth', note: 'melodic', volume: -12, duration: '4n' },
    'Corner Enclosure': { label: '🧱 Small Enclosure', instrument: 'marimbaSynth', note: 'stable_chord', volume: -11, duration: '4n' },
    'Large Enclosure': { label: '🏰 Large Enclosure', instrument: 'marimbaSynth', note: 'resolving_dyad', volume: -10, duration: '8n' },
    'Contact Move': { label: '🤝 Contact', instrument: 'gentleSynth', note: 'melodic_accent', volume: -5, duration: '8n' },
    'Normal Move': { label: '⚪ Normal', instrument: 'dynamic', note: 'melodic', volume: -16, duration: '8n' },
};

// DOM elements
const sgfUploadInput = document.getElementById('sgfUpload');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessageDiv = document.getElementById('status-message');
const analysisDiv = document.getElementById('analysisDiv');
const advancedControlsPanel = document.getElementById('advanced-controls-panel'); // NEW

// --- Helper Functions ---
function showStatus(message, type = 'info') {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = type;
}
function enableControls(enable = true) {
    playPauseBtn.disabled = !enable;
    prevBtn.disabled = !enable;
    nextBtn.disabled = !enable;
    resetBtn.disabled = !enable;
}
function setPlayPauseButton(isPlaying) {
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
}

// --- NEW: Advanced Control Panel Builder ---
function setupAdvancedControls() {
    advancedControlsPanel.innerHTML = ''; // Clear previous
    for (const key in musicControls) {
        const config = musicControls[key];

        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = config.label;
        fieldset.appendChild(legend);

        // 1. Instrument Selector (Dropdown)
        const instrLabel = document.createElement('label');
        instrLabel.textContent = 'Instrument: ';
        const instrSelect = document.createElement('select');
        instrSelect.dataset.key = key;
        instrSelect.dataset.param = 'instrument';
        ['marimbaSynth', 'gentleSynth', 'membraneSynth', 'dynamic'].forEach(instr => {
             // 'dynamic' is a special case for Normal Move
            if (config.instrument !== 'dynamic' && instr === 'dynamic') return;
            const option = document.createElement('option');
            option.value = instr;
            option.textContent = instr.replace('Synth', '');
            if (config.instrument === instr) option.selected = true;
            instrSelect.appendChild(option);
        });
        fieldset.appendChild(instrLabel);
        fieldset.appendChild(instrSelect);

        // 2. Volume Slider
        const volLabel = document.createElement('label');
        volLabel.textContent = 'Volume (dB): ';
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.min = -40;
        volSlider.max = 0;
        volSlider.step = 1;
        volSlider.value = config.volume;
        volSlider.dataset.key = key;
        volSlider.dataset.param = 'volume';
        const volValueSpan = document.createElement('span');
        volValueSpan.textContent = config.volume;
        fieldset.appendChild(volLabel);
        fieldset.appendChild(volSlider);
        fieldset.appendChild(volValueSpan);

        // 3. Duration Input
        const durLabel = document.createElement('label');
        durLabel.textContent = 'Duration: ';
        const durInput = document.createElement('input');
        durInput.type = 'text';
        durInput.value = config.duration;
        durInput.dataset.key = key;
        durInput.dataset.param = 'duration';
        fieldset.appendChild(durLabel);
        fieldset.appendChild(durInput);

        // --- Event Listeners for controls ---
        instrSelect.addEventListener('change', handleControlChange);
        volSlider.addEventListener('input', (e) => { // 'input' for live update
            handleControlChange(e);
            volValueSpan.textContent = e.target.value; // Update value display
        });
        durInput.addEventListener('change', handleControlChange);

        advancedControlsPanel.appendChild(fieldset);
    }
}

function handleControlChange(event) {
    const { key, param } = event.target.dataset;
    let value = event.target.value;

    // Convert value if necessary (e.g., for volume slider)
    if (param === 'volume') {
        value = parseFloat(value);
    }

    if (musicControls[key]) {
        musicControls[key][param] = value;
        console.log(`Updated ${key}.${param} to:`, value);
    }
}


// --- Go Board and Playback Logic ---
function setupWGoPlayer(sgfString) {
    if (wgoPlayer) wgoPlayer.destroy();
    wgoPlayer = new WGo.BasicPlayer(document.getElementById('wgo-player-display'), {
        sgf: sgfString, enableMoving: false, enableWheel: false, enableKeys: false, showTools: false,
    });
}

function displayMoveAnalysis(report) {
    if (report.type === 'Pass') { analysisDiv.innerHTML = `<strong>Move ${report.move_number} (${report.player}): Pass</strong>`; return; }

    let analysisText = `<strong>Move ${report.move_number} (${report.player}): ${report.sgf_coords}</strong>`;
    analysisText += `<br><br><strong>Move Type:</strong><ul>`;
    
    let moveKey = report.type;
    if (moveKey.includes('Enclosure') && moveKey !== 'Corner Enclosure') {
        moveKey = 'Large Enclosure';
    }
    
    const label = musicControls[moveKey]?.label || '⚪ Developing Move';
    const displayText = moveKey === 'Large Enclosure' ? `${label} (${report.type})` : label;
    analysisText += `<li>${displayText}</li>`;

    if (report.ko_detected) analysisText += `<li>⚖️ <strong>Ko:</strong> A ko fight may be starting.</li>`;
    analysisText += `</ul>`;
    
    // Metrics section remains the same...
    analysisText += `<strong>Metrics:</strong><ul>`;
    if (report.distance_from_center !== null) analysisText += `<li><strong>Center:</strong> ${report.distance_from_center.toFixed(2)}</li>`;
    if (report.distance_from_previous_friendly_stone !== null) analysisText += `<li><strong>From Previous Friendly:</strong> ${report.distance_from_previous_friendly_stone.toFixed(2)}</li>`;
    else analysisText += `<li><strong>From Previous Friendly:</strong> N/A (first move)</li>`;
    if (report.distance_to_nearest_friendly_stone !== null) analysisText += `<li><strong>To Nearest Friendly:</strong> ${report.distance_to_nearest_friendly_stone.toFixed(2)}</li>`;
    if (report.distance_to_nearest_enemy_stone !== null) analysisText += `<li><strong>To Nearest Enemy:</strong> ${report.distance_to_nearest_enemy_stone.toFixed(2)}</li>`;
    else analysisText += `<li><strong>To Nearest Enemy:</strong> N/A (no enemy stones)</li>`;
    analysisText += `</ul>`;

    analysisDiv.innerHTML = analysisText;
}

function playNextMoveWithWGo() {
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        wgoPlayer.next();
        playbackSpeed = playbackSpeed * gamma;
        playbackIntervalId = setTimeout(playNextMoveWithWGo, playbackSpeed);
        // Pass the entire controls object to the music engine
        playMusicalCue(report, musicControls);
    } else {
        stopPlayback();
        showStatus("Playback finished.", "info");
    }
}

function goToPrevMove() {
    pausePlayback();
    if (currentMoveIndex > -1) {
        wgoPlayer.previous();
        currentMoveIndex--;
    }
    const report = gameData[currentMoveIndex];
    displayMoveAnalysis(report || null);
    playMusicalCue(report || {type: 'ResetGame'}, musicControls);
}

function goToNextMove() {
    pausePlayback();
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        wgoPlayer.next();
        playMusicalCue(report, musicControls);
    } else {
        showStatus("At the end of the game.", "info");
        playMusicalCue({type: 'FinishedGame'}, musicControls);
    }
}

function stopPlayback() {
    pausePlayback();
    currentMoveIndex = -1;
    playbackSpeed = 250;
    wgoPlayer.first();
    setPlayPauseButton(false);
    displayMoveAnalysis(null);
    playMusicalCue({type: 'ResetGame'}, musicControls);
}

function startPlayback() {
    if (currentMoveIndex === gameData.length - 1) stopPlayback();
    if (playbackIntervalId) pausePlayback();
    else {
        setPlayPauseButton(true);
        playNextMoveWithWGo();
    }
}

function pausePlayback() {
    clearTimeout(playbackIntervalId);
    playbackIntervalId = null;
    setPlayPauseButton(false);
}

// --- Event Listeners & Initialization ---
sgfUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    enableControls(false);
    const formData = new FormData();
    formData.append('sgf_file', file);
    try {
        const response = await fetch('/upload_sgf', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            const analysisResponse = await fetch(`/analysis/${result.game_id}`);
            const analysisResult = await analysisResponse.json();
            if (analysisResponse.ok) {
                gameData = analysisResult;
                const reader = new FileReader();
                reader.onload = (e) => {
                    setupWGoPlayer(e.target.result);
                    enableControls(true);
                    stopPlayback(); // Reset to initial state
                };
                reader.readAsText(file);
            } else {
                showStatus(`Analysis Failed: ${analysisResult.error}`, "error");
            }
        } else {
            showStatus(`Upload Failed: ${result.error}`, "error");
        }
    } catch (error) {
        showStatus(`Network Error: ${error.message}`, "error");
    }
});

playPauseBtn.addEventListener('click', startPlayback);
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);

// Build the control panel when the page loads
document.addEventListener('DOMContentLoaded', setupAdvancedControls);