let goBoard;
let gameData = [];
let wgoPlayer;
let currentMoveIndex = -1;
let playbackIntervalId = null;
let playbackSpeed = 250;
const gamma = .999;

// --- NEW: Detailed, Controllable Music Configuration ---
const musicControls = {
    'Capture': { label: '💥 Capture', instrument: 'membraneSynth', note: 'C3', volume: -5, duration: '0.4s' },
    'Atari': { label: '❗ Atari', instrument: 'gentleSynth', note: 'tension_chord', volume: -6, duration: '8n' },
    'Cut': { label: '✂️ Cut', instrument: 'membraneSynth', note: 'G4', volume: -7, duration: '16n' },
    'Connection': { label: '🔗 Connection', instrument: 'marimbaSynth', note: 'A4', volume: -9, duration: '4n' },
    'Atari Threat': { label: '⚠️ Atari Threat', instrument: 'gentleSynth', note: 'tension_dyad', volume: -8, duration: '16n' },
    'Star Point': { label: '⭐ Star Point', instrument: 'marimbaSynth', note: 'C4', volume: -9, duration: '2n' },
    '3-3 Point': { label: '🏡 3-3 Point', instrument: 'gentleSynth', note: 'C2', volume: -10, duration: '1n' },
    '3-4 Point': { label: '🎯 3-4 Point', instrument: 'marimbaSynth', note: 'E4', volume: -10, duration: '2n' },
    'Corner Play': { label: '📐 Corner Play', instrument: 'gentleSynth', note: 'G3', volume: -12, duration: '2n' },
    'Small Knight': { label: '🐴 Small Knight', instrument: 'marimbaSynth', note: 'D4', volume: -11, duration: '8n' },
    'Large Knight': { label: '🐴 Large Knight', instrument: 'marimbaSynth', note: 'D4', volume: -9, duration: '8n' },
    'One-Space Jump': { label: '🏃 One-Space Jump', instrument: 'marimbaSynth', note: 'F4', volume: -11, duration: '8n' },
    'Two-Space Jump': { label: '🚀 Two-Space Jump', instrument: 'marimbaSynth', note: 'G4', volume: -11, duration: '8n' },
    'First Corner Play': { label: '🚩 First Corner', instrument: 'gentleSynth', note: 'melodic', volume: -12, duration: '4n' },
    'Corner Enclosure': { label: '🧱 Small Enclosure', instrument: 'marimbaSynth', note: 'stable_chord', volume: -11, duration: '4n' },
    'Large Enclosure': { label: '🏰 Large Enclosure', instrument: 'marimbaSynth', note: 'resolving_dyad', volume: -10, duration: '8n' },
    'Contact Move': { label: '🤝 Contact', instrument: 'gentleSynth', note: 'melodic_accent', volume: -5, duration: '8n' },
    'Normal Move': { label: '⚪ Normal', instrument: 'dynamic', note: 'melodic', volume: -16, duration: '8n' },
    'FinishedGame': { label: '🏁 Game Finished', instrument: 'gentleSynth', note: 'C5', volume: -8, duration: '1n' },
};

// DOM elements
const sgfUploadInput = document.getElementById('sgfUpload');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessageDiv = document.getElementById('status-message');
const analysisDiv = document.getElementById('analysisDiv');
const analysisDetailsDiv = document.getElementById('analysis-details');
const advancedControlsPanel = document.getElementById('advanced-controls-panel');

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

// --- Advanced Control Panel Builder ---
function setupAdvancedControls() {
    advancedControlsPanel.innerHTML = '';
    for (const key in musicControls) {
        const config = musicControls[key];

        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = config.label;
        fieldset.appendChild(legend);

        const instrLabel = document.createElement('label');
        instrLabel.textContent = 'Instrument: ';
        const instrSelect = document.createElement('select');
        instrSelect.dataset.key = key;
        instrSelect.dataset.param = 'instrument';
        ['marimbaSynth', 'gentleSynth', 'membraneSynth', 'dynamic'].forEach(instr => {
            if (config.instrument !== 'dynamic' && instr === 'dynamic') return;
            const option = document.createElement('option');
            option.value = instr;
            option.textContent = instr.replace('Synth', '');
            if (config.instrument === instr) option.selected = true;
            instrSelect.appendChild(option);
        });
        fieldset.appendChild(instrLabel);
        fieldset.appendChild(instrSelect);

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

        const durLabel = document.createElement('label');
        durLabel.textContent = 'Duration: ';
        const durInput = document.createElement('input');
        durInput.type = 'text';
        durInput.value = config.duration;
        durInput.dataset.key = key;
        durInput.dataset.param = 'duration';
        fieldset.appendChild(durLabel);
        fieldset.appendChild(durInput);

        instrSelect.addEventListener('change', handleControlChange);
        volSlider.addEventListener('input', (e) => {
            handleControlChange(e);
            volValueSpan.textContent = e.target.value;
        });
        durInput.addEventListener('change', handleControlChange);

        advancedControlsPanel.appendChild(fieldset);
    }
}

function handleControlChange(event) {
    const { key, param } = event.target.dataset;
    let value = event.target.value;

    if (param === 'volume') {
        value = parseFloat(value);
    }

    if (musicControls[key]) {
        musicControls[key][param] = value;
    }
}


// --- Go Board and Playback Logic ---
function setupWGoPlayer(sgfString) {
    if (wgoPlayer) wgoPlayer.destroy();
    wgoPlayer = new WGo.BasicPlayer(document.getElementById('wgo-player-display'), {
        sgf: sgfString, enableMoving: false, enableWheel: false, enableKeys: false, showTools: false,
        layout: {}
    });
}

function displayMoveAnalysis(report) {
    if (!report) {
        analysisDiv.innerHTML = 'Upload an SGF file to begin.';
        analysisDetailsDiv.innerHTML = '';
        return;
    }

    if (report.type === 'Pass') { 
        analysisDiv.innerHTML = `<strong>Move ${report.move_number} (${report.player}): Pass</strong>`;
        analysisDetailsDiv.innerHTML = '';
        return;
    }

    let analysisText = `<strong>Move ${report.move_number} (${report.player}): ${report.sgf_coords}</strong>`;
    analysisText += `<br><br><strong>Move Type:</strong><ul>`;
    
    let moveKey = report.type;
    if (moveKey.includes('Enclosure') && moveKey !== 'Corner Enclosure') {
        moveKey = 'Large Enclosure';
    }
    
    const label = musicControls[moveKey]?.label || `⚪ ${moveKey}`;
    const displayText = moveKey === 'Large Enclosure' ? `${label} (${report.type})` : label;
    analysisText += `<li>${displayText}</li>`;

    if (report.ko_detected) analysisText += `<li>⚖️ <strong>Ko:</strong> A ko fight may be starting.</li>`;
    analysisText += `</ul>`;
    
    analysisText += `<strong>Metrics:</strong><ul>`;
    if (report.distance_from_center !== null) analysisText += `<li><strong>Center:</strong> ${report.distance_from_center.toFixed(2)}</li>`;
    if (report.distance_from_previous_friendly_stone !== null) analysisText += `<li><strong>From Previous Friendly:</strong> ${report.distance_from_previous_friendly_stone.toFixed(2)}</li>`;
    else analysisText += `<li><strong>From Previous Friendly:</strong> N/A (first move)</li>`;
    if (report.distance_to_nearest_friendly_stone !== null) analysisText += `<li><strong>To Nearest Friendly:</strong> ${report.distance_to_nearest_friendly_stone.toFixed(2)}</li>`;
    if (report.distance_to_nearest_enemy_stone !== null) analysisText += `<li><strong>To Nearest Enemy:</strong> ${report.distance_to_nearest_enemy_stone.toFixed(2)}</li>`;
    else analysisText += `<li><strong>To Nearest Enemy:</strong> N/A (no enemy stones)</li>`;
    analysisText += `</ul>`;

    analysisDiv.innerHTML = analysisText;

    let detailsText = '<strong>Detected Patterns:</strong><ul>';
    if (report.captures && report.captures.length > 0) detailsText += `<li>Captured ${report.captured_count} stone(s)</li>`;
    if (report.atari && report.atari.length > 0) detailsText += `<li>Atari on ${report.atari.length} group(s)</li>`;
    if (report.is_cut) detailsText += `<li>Is a cutting move</li>`;
    if (report.is_connection) detailsText += `<li>Connects friendly groups</li>`;
    if (report.atari_threats && report.atari_threats.length > 0) detailsText += `<li>Atari threat on ${report.atari_threats.length} group(s)</li>`;
    if (report.is_contact) detailsText += `<li>Is a contact move</li>`;
    if (report.large_enclosure_type) detailsText += `<li>Forms a large enclosure: ${report.large_enclosure_type}</li>`;
    if (report.type === 'Star Point') detailsText += `<li>Played on a star point</li>`;
    if (report.type === '3-3 Point') detailsText += `<li>Played on a 3-3 point</li>`;
    if (report.type === '3-4 Point') detailsText += `<li>Played on a 3-4 point</li>`;
    if (report.type === 'Corner Enclosure') detailsText += `<li>Makes a corner enclosure</li>`;
    if (report.ko_detected) detailsText += `<li>A ko is detected</li>`;

    if (detailsText === '<strong>Detected Patterns:</strong><ul>') {
        detailsText += '<li>None</li>';
    }
    detailsText += '</ul>';
    analysisDetailsDiv.innerHTML = detailsText;
}

function playNextMoveWithWGo() {
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        wgoPlayer.next();
        playbackSpeed = playbackSpeed * gamma;
        playbackIntervalId = setTimeout(playNextMoveWithWGo, playbackSpeed);
        playMusicalCue(report, musicControls);
    } else {
        pausePlayback();
        showStatus("Playback finished.", "info");
        playMusicalCue({type: 'FinishedGame'}, musicControls);
    }
}

function goToPrevMove() {
    pausePlayback();
    if (currentMoveIndex > 0) {
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
    showStatus('Processing SGF...', 'info');
    enableControls(false);
    const formData = new FormData();
    formData.append('sgf_file', file);
    try {
        const response = await fetch('/upload_sgf', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            showStatus('Analyzing game...', 'info');
            const analysisResponse = await fetch(`/analysis/${result.game_id}`);
            const analysisResult = await analysisResponse.json();
            if (analysisResponse.ok) {
                gameData = analysisResult;
                const reader = new FileReader();
                reader.onload = (e) => {
                    setupWGoPlayer(e.target.result);
                    enableControls(true);
                    stopPlayback();
                    showStatus('Ready. Press Play to start.', 'success');
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
        enableControls(false);
    }
});

playPauseBtn.addEventListener('click', startPlayback);
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);

document.addEventListener('DOMContentLoaded', () => {
    setupAdvancedControls();
    enableControls(false);
});