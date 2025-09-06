// go_rhapsody/static/js/app.js

let gameData = [];
let wgoPlayer;
let currentMoveIndex = -1;
let playbackIntervalId = null;
let playbackSpeed = 300;
const gamma = .999;
let currentSgfContent = '';

// --- Board Theme Configurations ---
const boardThemes = {
    noir_et_or: {
        // UPDATED: Lighter charcoal slate for better contrast
        background: "#3a3a3a", 
        lineColor: "rgba(255, 255, 255, 0.10)",
        lineWidth: 1,
        starColor: "rgba(255, 255, 255, 0.20)",
        stone: {
            type: function(ctx, x, y, r, stone) {
                if (stone.c === WGo.B) {
                    const grd = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.2);
                    grd.addColorStop(0, "#4a4a4a");
                    grd.addColorStop(1, "#010101");
                    ctx.fillStyle = grd;
                } else {
                    const grd = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.2, x, y, r);
                    grd.addColorStop(0, "#ffffff");
                    grd.addColorStop(1, "#e0e0e0");
                    ctx.fillStyle = grd;
                    ctx.shadowColor = 'rgba(0,0,0,0.3)';
                    ctx.shadowBlur = 2;
                    ctx.shadowOffsetX = 1;
                    ctx.shadowOffsetY = 1;
                }
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
        }
    },
    classic: {
        background: "#e0ac69",
        lineWidth: 1,
        lineColor: "#4a4a4a",
        starColor: "#4a4a4a",
        stone: {
            black: { shadow: 0, lineWidth: 0.5, strokeStyle: '#222' },
            white: { shadow: 0, lineWidth: 0.5, strokeStyle: '#999' }
        }
    },
    dark: {
        background: "#2c3e50",
        lineWidth: 1,
        lineColor: "#b0b0b0",
        starColor: "#b0b0b0",
        stone: {
            black: { shadow: 8, shadowColor: "rgba(0, 188, 212, 0.3)", lineWidth: 0 },
            white: { shadow: 8, shadowColor: "rgba(255, 255, 255, 0.3)", lineWidth: 0 }
        }
    }
};

// --- Board background darkness utilities ---
function darkenHexColor(hex, percent) {
    // hex like #rrggbb, percent 0-100 darker
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    const p = Math.max(0, Math.min(100, percent)) / 100;
    const num = parseInt(hex.replace('#',''), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00FF;
    const b = num & 0x0000FF;
    const nr = Math.round(r * (1 - p));
    const ng = Math.round(g * (1 - p));
    const nb = Math.round(b * (1 - p));
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function applyBoardDarkness(themeConfig, darknessPercent) {
    const cloned = JSON.parse(JSON.stringify(themeConfig));
    if (cloned.background && cloned.background.startsWith('#')) {
        cloned.background = darkenHexColor(cloned.background, darknessPercent);
    }
    if (cloned.lineColor && cloned.lineColor.startsWith('#')) {
        cloned.lineColor = darkenHexColor(cloned.lineColor, Math.min(50, darknessPercent / 2));
    }
    if (cloned.starColor && cloned.starColor.startsWith('#')) {
        cloned.starColor = darkenHexColor(cloned.starColor, Math.min(50, darknessPercent / 2));
    }
    return cloned;
}

// --- Music Configuration ---
const musicControls = {
    'Capture': { label: '💥 Capture', instrument: 'membraneSynth', note: 'C3', volume: -5, duration: '0.4s' },
    'Atari': { label: '❗ Atari', instrument: 'gentleSynth', note: 'tension_chord', volume: -6, duration: '8n' },
    'Hane': { label: '⤴️ Hane', instrument: 'marimbaSynth', note: 'melodic_accent', volume: -7, duration: '8n' },
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

// --- Preset Definitions ---
const musicPresets = {
    classic: {
        'Capture': 'marimbaSynth',
        'Atari': 'gentleSynth',
        'Hane': 'marimbaSynth',
        'Cut': 'marimbaSynth',
        'Connection': 'marimbaSynth',
        'Atari Threat': 'gentleSynth',
        'Star Point': 'marimbaSynth',
        '3-3 Point': 'gentleSynth',
        '3-4 Point': 'marimbaSynth',
        'Corner Play': 'gentleSynth',
        'Small Knight': 'marimbaSynth',
        'Large Knight': 'marimbaSynth',
        'One-Space Jump': 'marimbaSynth',
        'Two-Space Jump': 'marimbaSynth',
        'First Corner Play': 'gentleSynth',
        'Corner Enclosure': 'marimbaSynth',
        'Large Enclosure': 'marimbaSynth',
        'Contact Move': 'gentleSynth',
        'Normal Move': 'marimbaSynth',
        'FinishedGame': 'gentleSynth',
    },
    electronic: {
        'Capture': 'membraneSynth',
        'Atari': 'fmSynth',
        'Hane': 'amSynth',
        'Cut': 'membraneSynth',
        'Connection': 'amSynth',
        'Atari Threat': 'fmSynth',
        'Star Point': 'duoSynth',
        '3-3 Point': 'membraneSynth',
        '3-4 Point': 'amSynth',
        'Corner Play': 'duoSynth',
        'Small Knight': 'membraneSynth',
        'Large Knight': 'fmSynth',
        'One-Space Jump': 'amSynth',
        'Two-Space Jump': 'duoSynth',
        'First Corner Play': 'membraneSynth',
        'Corner Enclosure': 'amSynth',
        'Large Enclosure': 'fmSynth',
        'Contact Move': 'duoSynth',
        'Normal Move': 'membraneSynth',
        'FinishedGame': 'fmSynth',
    },
    piano: {
        'Capture': 'piano',
        'Atari': 'piano',
        'Hane': 'piano',
        'Cut': 'piano',
        'Connection': 'piano',
        'Atari Threat': 'piano',
        'Star Point': 'piano',
        '3-3 Point': 'piano',
        '3-4 Point': 'piano',
        'Corner Play': 'piano',
        'Small Knight': 'piano',
        'Large Knight': 'piano',
        'One-Space Jump': 'piano',
        'Two-Space Jump': 'piano',
        'First Corner Play': 'piano',
        'Corner Enclosure': 'piano',
        'Large Enclosure': 'piano',
        'Contact Move': 'piano',
        'Normal Move': 'piano',
        'FinishedGame': 'piano',
    },
    kalimba: {
        'Capture': 'kalimba',
        'Atari': 'kalimba',
        'Hane': 'kalimba',
        'Cut': 'kalimba',
        'Connection': 'kalimba',
        'Atari Threat': 'kalimba',
        'Star Point': 'kalimba',
        '3-3 Point': 'kalimba',
        '3-4 Point': 'kalimba',
        'Corner Play': 'kalimba',
        'Small Knight': 'kalimba',
        'Large Knight': 'kalimba',
        'One-Space Jump': 'kalimba',
        'Two-Space Jump': 'kalimba',
        'First Corner Play': 'kalimba',
        'Corner Enclosure': 'kalimba',
        'Large Enclosure': 'kalimba',
        'Contact Move': 'kalimba',
        'Normal Move': 'kalimba',
        'FinishedGame': 'kalimba',
    },
    fun: {
        'Capture': 'pluckSynth',
        'Atari': 'kalimba',
        'Hane': 'pluckSynth',
        'Cut': 'metalSynth',
        'Connection': 'piano',
        'Atari Threat': 'gentleSynth',
        'Star Point': 'marimbaSynth',
        '3-3 Point': 'pluckSynth',
        '3-4 Point': 'kalimba',
        'Corner Play': 'duoSynth',
        'Small Knight': 'pluckSynth',
        'Large Knight': 'monoSynth',
        'One-Space Jump': 'marimbaSynth',
        'Two-Space Jump': 'metalSynth',
        'First Corner Play': 'kalimba',
        'Corner Enclosure': 'amSynth',
        'Large Enclosure': 'fmSynth',
        'Contact Move': 'pluckSynth',
        'Normal Move': 'dynamic',
        'FinishedGame': 'gentleSynth',
    },
    // Romantic, piano-centric palette inspired by Liszt
    liszt: {
        'Capture': 'piano',
        'Atari': 'piano',
        'Hane': 'piano',
        'Cut': 'piano',
        'Connection': 'piano',
        'Atari Threat': 'piano',
        'Star Point': 'piano',
        '3-3 Point': 'piano',
        '3-4 Point': 'piano',
        'Corner Play': 'piano',
        'Small Knight': 'piano',
        'Large Knight': 'piano',
        'One-Space Jump': 'piano',
        'Two-Space Jump': 'piano',
        'First Corner Play': 'piano',
        'Corner Enclosure': 'piano',
        'Large Enclosure': 'piano',
        'Contact Move': 'piano',
        'Normal Move': 'piano',
        'FinishedGame': 'piano',
    },
};

// Scale assignment per preset (keyed by preset id)
const presetScales = {
    classic: 'zen',
    electronic: 'zen',
    piano: 'zen',
    kalimba: 'zen',
    fun: 'zen',
    liszt: 'zen'
};

function applyMusicPreset(presetKey) {
    const preset = musicPresets[presetKey];
    if (!preset) return;
    for (const key in musicControls) {
        if (preset[key]) {
            musicControls[key].instrument = preset[key];
        }
    }
    // Re-render advanced controls to update selects
    setupAdvancedControls();
    // Apply associated scale
    if (presetScales[presetKey] && window.setMusicScale) {
        window.setMusicScale(presetScales[presetKey]);
        // Reflect in UI select if present
        const scaleSelect = document.getElementById('music-scale-select');
        if (scaleSelect) scaleSelect.value = presetScales[presetKey];
    }
}

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
const boardDarknessRange = document.getElementById('board-darkness-range');
const gobanContainer = document.getElementById('goban-container');
const wgoPlayerDisplay = document.getElementById('wgo-player-display');
// --- New: Playback controls ---
const playbackSpeedRange = document.getElementById('playbackSpeedRange');
const playbackSpeedNumber = document.getElementById('playbackSpeedNumber');
const gammaRange = document.getElementById('gammaRange');
const gammaNumber = document.getElementById('gammaNumber');
// --- New: Presets ---
const musicPresetsSelect = document.getElementById('music-presets-select');
const musicScaleSelect = document.getElementById('music-scale-select');

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

function setupAdvancedControls() {
    const groups = {
        contact: ['Hane', 'Contact Move'],
        threats: ['Atari', 'Atari Threat', 'Cut'],
        development: ['Corner Play', 'Corner Enclosure', 'Large Enclosure', 'Small Knight', 'Large Knight', 'One-Space Jump', 'Two-Space Jump', 'Star Point', '3-3 Point', '3-4 Point', 'First Corner Play'],
        other: ['Capture', 'Connection', 'Normal Move', 'FinishedGame']
    };

    const mountPoints = {
        contact: document.getElementById('advanced-controls-panel-contact'),
        threats: document.getElementById('advanced-controls-panel-threats'),
        development: document.getElementById('advanced-controls-panel-development'),
        other: document.getElementById('advanced-controls-panel-other')
    };
    Object.values(mountPoints).forEach(mp => { if (mp) mp.innerHTML = ''; });

    const renderFieldset = (key) => {
        const config = musicControls[key];
        if (!config) return null;
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = config.label;
        fieldset.appendChild(legend);

        const instrLabel = document.createElement('label');
        instrLabel.textContent = 'Instrument: ';
        const instrSelect = document.createElement('select');
        instrSelect.dataset.key = key;
        instrSelect.dataset.param = 'instrument';
        [
            'marimbaSynth', 'gentleSynth', 'membraneSynth', 'piano', 'kalimba', 'pluckSynth',
            'fmSynth', 'duoSynth', 'amSynth', 'monoSynth', 'metalSynth', 'dynamic'
        ].forEach(instr => {
            if (config.instrument !== 'dynamic' && instr === 'dynamic') return;
            const option = document.createElement('option');
            option.value = instr;
            option.textContent = instr.replace('Synth', '').replace('Synth', '').replace('am', 'AM').replace('fm', 'FM').replace('duo', 'Duo').replace('mono', 'Mono').replace('metal', 'Metal');
            if (config.instrument === instr) option.selected = true;
            instrSelect.appendChild(option);
        });
        fieldset.appendChild(instrLabel);
        fieldset.appendChild(instrSelect);
        instrSelect.addEventListener('change', handleControlChange);
        return fieldset;
    };

    const place = (groupKey) => {
        const mount = mountPoints[groupKey];
        if (!mount) return;
        groups[groupKey].forEach(moveName => {
            const fs = renderFieldset(moveName);
            if (fs) mount.appendChild(fs);
        });
    };

    place('contact');
    place('threats');
    place('development');
    place('other');
}

function handleControlChange(event) {
    const { key, param } = event.target.dataset;
    let value = event.target.value;
    if (musicControls[key]) {
        musicControls[key][param] = value;
    }
}

function createWgoPlayer() {
    if (!currentSgfContent) return;
    const selectedTheme = boardThemeSelect.value;
    const baseTheme = boardThemes[selectedTheme];
    const darkness = boardDarknessRange ? parseInt(boardDarknessRange.value) : 0;
    const themeConfig = applyBoardDarkness(baseTheme, isNaN(darkness) ? 0 : darkness);
    const lastMove = currentMoveIndex;
    if (wgoPlayer) {
        wgoPlayer.destroy();
    }
    wgoPlayerDisplay.innerHTML = '';
    wgoPlayer = new WGo.BasicPlayer(wgoPlayerDisplay, {
        sgf: currentSgfContent,
        board: themeConfig,
        layout: { top: [], right: [], left: [], bottom: [] },
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
    if (report.is_hane) detailsText += `<li>Hane shape detected</li>`;
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
    } catch (error) {
        showStatus(`Network Error: ${error.message}`, "error");
        enableControls(false);
    }
});

boardThemeSelect.addEventListener('change', createWgoPlayer);
if (boardDarknessRange) {
    boardDarknessRange.addEventListener('input', createWgoPlayer);
}
playPauseBtn.addEventListener('click', startPlayback);
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);

// --- New: Playback & Gamma Controls Sync ---
function syncPlaybackSpeedInputs(value) {
    playbackSpeedRange.value = value;
    playbackSpeedNumber.value = value;
    playbackSpeed = parseInt(value);
}
function syncGammaInputs(value) {
    gammaRange.value = value;
    gammaNumber.value = value;
    gamma = parseFloat(value);
}
if (playbackSpeedRange && playbackSpeedNumber) {
    playbackSpeedRange.addEventListener('input', (e) => {
        syncPlaybackSpeedInputs(e.target.value);
    });
    playbackSpeedNumber.addEventListener('input', (e) => {
        syncPlaybackSpeedInputs(e.target.value);
    });
}
if (gammaRange && gammaNumber) {
    gammaRange.addEventListener('input', (e) => {
        syncGammaInputs(e.target.value);
    });
    gammaNumber.addEventListener('input', (e) => {
        syncGammaInputs(e.target.value);
    });
}

// --- New: Presets ---
if (musicPresetsSelect) {
    musicPresetsSelect.addEventListener('change', (e) => {
        applyMusicPreset(e.target.value);
    });
}

// Tab switching logic
document.querySelectorAll('#advanced-controls-container .tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#advanced-controls-container .tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#advanced-controls-container .tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        const pane = document.getElementById(target);
        if (pane) pane.classList.add('active');
    });
});

// Scale selector wiring
if (musicScaleSelect) {
    musicScaleSelect.addEventListener('change', (e) => {
        if (window.setMusicScale) {
            window.setMusicScale(e.target.value);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupAdvancedControls();
    enableControls(false);
    // Initialize playback controls to match variables
    if (playbackSpeedRange && playbackSpeedNumber) {
        syncPlaybackSpeedInputs(playbackSpeed);
    }
    if (gammaRange && gammaNumber) {
        syncGammaInputs(gamma);
    }
    // Initialize scale select to current engine scale if available
    if (musicScaleSelect && window.getMusicScale) {
        musicScaleSelect.value = window.getMusicScale();
    }
});