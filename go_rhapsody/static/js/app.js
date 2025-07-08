// app.js
let goBoard; // WGo.js Board object (kept as it might be implicitly used or for future expansion)
let gameData = []; // Stores analysis reports from backend
let wgoPlayer; // WGo.js Player instance for SGF playback
let currentMoveIndex = -1; // -1 means before the first move
let playbackIntervalId = null;
let playbackSpeed = 250; // Milliseconds between moves
const gamma = 1.05

// DOM elements
const sgfUploadInput = document.getElementById('sgfUpload');
// const startButton = document.getElementById('startButton'); // Removed: Deprecated and not used
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessageDiv = document.getElementById('status-message');
const analysisDiv = document.getElementById('analysisDiv');


// --- Helper Functions ---
function showStatus(message, type = 'info') {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = type; // 'info', 'success', 'error'
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

// --- Go Board Playback Logic ---

function setupWGoPlayer(sgfString) {
    // Clear any existing player instance
    if (wgoPlayer) {
        wgoPlayer.destroy();
    }

    wgoPlayer = new WGo.BasicPlayer(document.getElementById('wgo-player-display'), {
        sgf: sgfString,
        enableMoving: false, // Prevent user from moving stones directly
        enableWheel: false, // Prevent wheel scrolling
        enableKeys: false, // Prevent keyboard navigation (we use our buttons)
        showTools: false, // Hide built-in tools
        layout: {
            // Removed 'Control' from here as per request.
            // Keeping 'InfoBox' and 'CommentBox' in case they are desired, otherwise can be removed.
            left: ['InfoBox', 'CommentBox'], 
        },
    });
    // We do NOT override WGo.Player's onNodeChanged.
    // Our display and musical cue logic is handled by displayMoveAnalysis in our custom playback functions.
}

function displayMoveAnalysis(report) {
    let analysisText = ``;

    if (!report) { // Case for initial state (currentMoveIndex = -1) or no game loaded
        analysisText = `<strong>No move selected or game not started.</strong>`;
    } else if (report.type === 'Pass') {
        analysisText = `<strong>Move ${report.move_number} (${report.player}): Pass</strong><br>`;
        analysisText += `Type: ${report.type}`;
    } else {
        analysisText += `<strong>Move ${report.move_number} (${report.player}): ${report.sgf_coords}</strong><br>`;
        
        // Display Main Move Type
        analysisText += `Type: ${report.type}`;

        // Add specifics based on the determined type
        if (report.type === 'Capture' && report.captured_count > 0) {
            analysisText += ` (Captured ${report.captured_count} stone(s))`;
        } else if (report.type === 'Atari' && report.atari && report.atari.length > 0) {
            analysisText += ` (Threatening ${report.atari.length} group(s) in atari)`;
        } else if (report.type === 'Atari Threat' && report.atari_threats && report.atari_threats.length > 0) {
            analysisText += ` (Created atari threat on ${report.atari_threats.length} group(s))`;
        }

        analysisText += `<br><br>`;
        analysisText += `<strong>Distances:</strong><br>`;
        
        // Distance from center
        if (report.distance_from_center !== null && report.distance_from_center !== undefined) {
             analysisText += `Center: ${report.distance_from_center.toFixed(2)}<br>`;
        } else {
             analysisText += `Center: N/A<br>`; // Should always be present for a stone placement
        }

        // Distance to nearest friendly stone
        if (report.distance_to_nearest_friendly_stone !== null && report.distance_to_nearest_friendly_stone !== undefined) {
             analysisText += `Closest Friendly: ${report.distance_to_nearest_friendly_stone.toFixed(2)}<br>`;
        } else {
             analysisText += `Closest Friendly: N/A (no other friendly stones)<br>`;
        }
        
        // Distance to nearest enemy stone
        if (report.distance_to_nearest_enemy_stone !== null && report.distance_to_nearest_enemy_stone !== undefined) {
             analysisText += `Closest Enemy: ${report.distance_to_nearest_enemy_stone.toFixed(2)}<br>`;
        } else {
             analysisText += `Closest Enemy: N/A (no enemy stones)<br>`;
        }
    }
    analysisDiv.innerHTML = analysisText;
}

function playNextMoveWithWGo() {
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        wgoPlayer.next();
        playbackSpeed = playbackSpeed * gamma
        playbackIntervalId = setTimeout(playNextMoveWithWGo, playbackSpeed);
        // Assuming playMusicalCue is defined elsewhere and handles the report object
        playMusicalCue(report); 
    } else {
        stopPlayback(); // Reached end of moves, stop playback
        showStatus("Playback finished.", "info");
    }
}

function goToPrevMove() {
    pausePlayback(); // Always pause when manually navigating
    if (currentMoveIndex > -1) { // Check if we are not already before the first move
        wgoPlayer.previous(); // Navigate WGo.js board
        currentMoveIndex--;
    } else {
        showStatus("At the beginning of the game.", "info");
    }
    const report = gameData[currentMoveIndex]; // Will be undefined if currentMoveIndex is -1
    displayMoveAnalysis(report || null); // Display current move's analysis or a clear state
    // Assuming playMusicalCue handles null or a default object for beginning state
    playMusicalCue(report || {type: 'ResetGame'}); 
}

function goToNextMove() {
    pausePlayback(); // Always pause when manually navigating
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        const report = gameData[currentMoveIndex];
        displayMoveAnalysis(report);
        wgoPlayer.next(); // Navigate WGo.js board
        // Assuming playMusicalCue is defined elsewhere and handles the report object
        playMusicalCue(report); 
    } else {
        showStatus("At the end of the game.", "info");
        // Specific cue for reaching the end of the game
        playMusicalCue({type: 'FinishedGame'}); 
    }
}

function stopPlayback() {
    pausePlayback(); // Clear any ongoing playback
    currentMoveIndex = -1; // Reset index to before the first move
    wgoPlayer.first(); // Reset WGo.js board to initial state
    setPlayPauseButton(false); // Update button text to 'Play'
    displayMoveAnalysis(null); // Clear analysis display or show initial message
    // Specific cue for resetting playback
    playMusicalCue({type: 'ResetGame'}); 
}

function startPlayback() {
    // If at the end of the game, reset to start before playing again
    if (currentMoveIndex === gameData.length - 1) {
        stopPlayback(); 
    }
    // If already playing (playbackIntervalId is not null), calling startPlayback will pause it
    if (playbackIntervalId) {
        pausePlayback(); 
    } else {
        setPlayPauseButton(true); // Update button text to 'Pause'
        // If currentMoveIndex is -1, playNextMoveWithWGo will increment to 0 and play the first move.
        // If paused mid-game, it will resume from the currentMoveIndex.
        playNextMoveWithWGo(); 
    }
}


function pausePlayback() {
    clearTimeout(playbackIntervalId);
    playbackIntervalId = null;
    setPlayPauseButton(false); // Update button text to 'Play'
}

// --- Event Listeners ---
sgfUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) {
        showStatus("No file selected.", "error");
        return;
    }

    enableControls(false); // Disable controls during file processing

    const formData = new FormData();
    formData.append('sgf_file', file);

    try {
        const response = await fetch('/upload_sgf', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            const gameId = result.game_id;

            const analysisResponse = await fetch(`/analysis/${gameId}`);
            const analysisResult = await analysisResponse.json();

            if (analysisResponse.ok) {
                gameData = analysisResult; // Store the analysis data
                console.log("Analysis Log Loaded:", gameData);

                const reader = new FileReader();
                reader.onload = function(e) {
                    setupWGoPlayer(e.target.result); // Initialize WGo.js player
                    enableControls(true); // Enable controls after successful load
                    currentMoveIndex = -1; // Reset playback index
                    wgoPlayer.first(); // Set WGo.js board to initial state
                    setPlayPauseButton(false); // Set play/pause button to 'Play'
                    displayMoveAnalysis(null); // Clear/reset analysis display
                };
                reader.readAsText(file); // Read the SGF file content
            } else {
                showStatus(`Failed to fetch analysis log: ${analysisResult.error}`, "error");
                enableControls(false);
            }
        } else {
            showStatus(`SGF Upload Failed: ${result.error}`, "error");
            enableControls(false);
        }
    } catch (error) {
        showStatus(`Network or other error: ${error.message}`, "error");
        console.error("Error:", error);
        enableControls(false);
    }
});

// Event listeners for playback controls
playPauseBtn.addEventListener('click', () => {
    startPlayback(); // Toggle play/pause
});
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);