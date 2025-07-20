// go_rhapsody/static/js/app.js

let gameData = [];
let wgoPlayer;
let currentMoveIndex = -1;
let playbackIntervalId = null;
let playbackSpeed = 300;
const gamma = .999;
let currentSgfContent = ''; // To store the SGF content for theme reloading

// --- Board Theme Configurations (WITH STONE STYLES) ---
const boardThemes = {
    classic: {
        background: "#e0ac69",
        lineWidth: 1,
        lineColor: "#4a4a4a",
        starColor: "#4a4a4a",
        stone: { // Flat, classic stones
            black: { shadow: 0, lineWidth: 0.5, strokeStyle: '#222' },
            white: { shadow: 0, lineWidth: 0.5, strokeStyle: '#999' }
        }
    },
    dark: {
        background: "#2c3e50",
        lineWidth: 1,
        lineColor: "#b0b0b0",
        starColor: "#b0b0b0",
        stone: { // Stones with a subtle glow for dark mode
             black: { shadow: 8, shadowColor: "rgba(0, 188, 212, 0.3)", lineWidth: 0 },
            white: { shadow: 8, shadowColor: "rgba(255, 255, 255, 0.3)", lineWidth: 0 }
        }
    }
};

// --- Music Configuration ---
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
const distributionChartDiv = document.getElementById('distribution-chart');
const boardThemeSelect = document.getElementById('board-theme-select');
const gobanContainer = document.getElementById('goban-container');
const wgoPlayerDisplay = document.getElementById('wgo-player-display');

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

/**
 * Creates or recreates the Go board player with a complete configuration.
 */
function createWgoPlayer() {
    if (!currentSgfContent) return;

    const selectedTheme = boardThemeSelect.value;
    const themeConfig = boardThemes[selectedTheme];
    const lastMove = currentMoveIndex;

    if (wgoPlayer) {
        wgoPlayer.destroy();
    }
    wgoPlayerDisplay.innerHTML = '';

    // Create the new player with a complete configuration object
    wgoPlayer = new WGo.BasicPlayer(wgoPlayerDisplay, {
        sgf: currentSgfContent,
        board: themeConfig, // Applies background, lines, AND stone styles
        
        // Options to hide all native WGo.js UI elements
        layout: { 
            top: [], right: [], left: [], bottom: [],
        },
        showGameInfo: false,
        showKomi: false,
        showPlayerNames: false,
        showTools: false,
        showMoves: false,
        enableKeys: false,
        enableWheel: false,
        enableMoving: false
    });

    if (lastMove > 0) {
        wgoPlayer.goTo(lastMove);
    }
    
    gobanContainer.className = `theme-${selectedTheme}`;
}


// --- Go Board and Playback Logic ---
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
    analysisText += `</ul><strong>Metrics:</strong><ul>`;
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

function displayMoveDistribution(data) {
    distributionChartDiv.innerHTML = '';
    const moveCounts = {};
    data.forEach(report => {
        if (report.type === 'Pass') return;
        let moveKey = report.type;
        if (moveKey.includes('Enclosure') && moveKey !== 'Corner Enclosure') {
            moveKey = 'Large Enclosure';
        }
        moveCounts[moveKey] = (moveCounts[moveKey] || 0) + 1;
    });
    const totalMoves = data.filter(r => r.type !== 'Pass').length;
    if (totalMoves === 0) return;
    for (const moveKey in moveCounts) {
        const count = moveCounts[moveKey];
        const percentage = ((count / totalMoves) * 100).toFixed(1);
        const label = musicControls[moveKey]?.label || moveKey;
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        const barLabel = document.createElement('div');
        barLabel.className = 'bar-label';
        barLabel.textContent = label;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${percentage}%`;
        bar.textContent = `${count} (${percentage}%)`;
        barContainer.appendChild(barLabel);
        barContainer.appendChild(bar);
        distributionChartDiv.appendChild(barContainer);
    }
}

function playNextMoveWithWGo() {
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        if(wgoPlayer) wgoPlayer.next();
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
        if(wgoPlayer) wgoPlayer.previous();
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
        if(wgoPlayer) wgoPlayer.next();
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
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
    if (wgoPlayer) wgoPlayer.first();
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
    distributionChartDiv.innerHTML = '';
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
                displayMoveDistribution(gameData);
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentSgfContent = e.target.result;
                    createWgoPlayer(); 
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
    } catch (error) { // <-- The typo is fixed here
        showStatus(`Network Error: ${error.message}`, "error");
        enableControls(false);
    }
});

boardThemeSelect.addEventListener('change', createWgoPlayer);
playPauseBtn.addEventListener('click', startPlayback);
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);

document.addEventListener('DOMContentLoaded', () => {
    enableControls(false);
});