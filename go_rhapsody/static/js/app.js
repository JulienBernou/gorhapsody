// app.js
let goBoard; // WGo.js Board object
let gameData = []; // Stores analysis reports from backend
let wgoPlayer; // WGo.js Player instance for SGF playback
let currentMoveIndex = -1;
let playbackIntervalId = null;
const playbackSpeed = 1500; // Milliseconds between moves

// DOM elements
const sgfUploadInput = document.getElementById('sgfUpload');
const startButton = document.getElementById('startButton');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessageDiv = document.getElementById('status-message');

// --- Helper Functions ---
function showStatus(message, type = 'info') {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = type; // 'info', 'success', 'error'
}

function enableControls(enable = true) {
    // startButton is deprecated and can be removed if you wish
    playPauseBtn.disabled = !enable;
    prevBtn.disabled = !enable;
    nextBtn.disabled = !enable;
    resetBtn.disabled = !enable;
}

function setPlayPauseButton(isPlaying) {
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
}

// --- Go Board Playback Logic ---

/**
 * CORRECTED FUNCTION
 * Sets up the WGo.js player.
 * - Creates a single WGo.Player instance.
 * - Attaches to the correct HTML element ('wgo-player-display').
 * - Does NOT create conflicting built-in controls.
 */
function setupWGoPlayer(sgfString) {
    // Clear any existing player instance
    if (wgoPlayer) {
        wgoPlayer.destroy();
    }

    // Ensure your HTML has a <div id="wgo-player-display"></div>
    // Also, ensure your CSS gives this div a width and height, e.g.:
    // #wgo-player-display { width: 500px; height: 500px; }
    wgoPlayer = new WGo.BasicPlayer(document.getElementById('wgo-player-display'), {
        sgf: sgfString,
        enableMoving: false, // Prevent user from moving stones directly
        enableWheel: false, // Prevent wheel scrolling
        enableKeys: false, // Prevent keyboard navigation (we use our buttons)
        showTools: false // Hide built-in tools
    });

    // We override WGo.Player's onNodeChanged to integrate our music and analysis
    wgoPlayer.onNodeChanged = function(ev) {
        if (ev.node.move) { // Ensure it's a move node
            const moveNumber = ev.node.move.move_number;
            const report = gameData.find(d => d.move_number === moveNumber);
            if (report) {
                playMusicalCue(report);
            }
        } else if (ev.node.pass) { // Handle passes
             const moveNumber = ev.node.move_number;
             const report = gameData.find(d => d.move_number === moveNumber);
             if (report) {
                 playMusicalCue(report);
             }
        }
    };
}


function playNextMoveWithWGo() {
    // The player's next() method returns false if it's at the end
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        wgoPlayer.next();
        playbackIntervalId = setTimeout(playNextMoveWithWGo, playbackSpeed);
        playMusicalCue({type: 'Normal Move'});
    } else {
        stopPlayback();
        showStatus("Playback finished.", "info");
    }
}


function goToPrevMove() {
    pausePlayback();
    // The player's previous() method returns false if it's at the start
    if (wgoPlayer.previous()) {
        currentMoveIndex--;
    } else {
        // We're at the very beginning (before move 1)
        currentMoveIndex = -1;
        showStatus("At the start of the game.", "info");
        playMusicalCue({type: 'Reset'}); // Optional: cue for being at the start
    }
}


function goToNextMove() {
    pausePlayback();
    if (currentMoveIndex < gameData.length - 1) {
        currentMoveIndex++;
        wgoPlayer.next();
        playMusicalCue({type: 'Normal Move'});
        showStatus("Moved forward. Current index: " + currentMoveIndex, "info");
    } else {
        showStatus("At the end of the game.", "info");
        playMusicalCue({type: 'Finished'});
    }
}

function stopPlayback() {
    pausePlayback();
    currentMoveIndex = -1; // Reset to before first move
    wgoPlayer.first(); // Go to the initial board state in WGo.js
    setPlayPauseButton(false);
    showStatus("Playback stopped. Ready to play.", "info");
    playMusicalCue({type: 'Reset'}); // Special cue for reset/start
}

function startPlayback() {
    if (playbackIntervalId) {
        pausePlayback(); // If already playing, this acts as a resume button
    }
    setPlayPauseButton(true);
    showStatus("Playback started...", "info");
    playNextMoveWithWGo(); // Start from the current move
}

function pausePlayback() {
    clearTimeout(playbackIntervalId);
    playbackIntervalId = null;
    setPlayPauseButton(false);
    showStatus("Playback paused.", "info");
}

// --- Event Listeners ---
sgfUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) {
        showStatus("No file selected.", "error");
        return;
    }

    showStatus("Uploading and analyzing SGF...", "info");
    enableControls(false); // Disable controls during upload/analysis

    const formData = new FormData();
    formData.append('sgf_file', file);

    try {
        const response = await fetch('/upload_sgf', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showStatus("SGF analysis successful!", "success");
            const gameId = result.game_id;

            const analysisResponse = await fetch(`/analysis/${gameId}`);
            const analysisResult = await analysisResponse.json();

            if (analysisResponse.ok) {
                gameData = analysisResult;
                console.log("Analysis Log Loaded:", gameData);

                const reader = new FileReader();
                reader.onload = function(e) {
                    setupWGoPlayer(e.target.result);
                    enableControls(true);
                    currentMoveIndex = -1;
                    wgoPlayer.first();
                    setPlayPauseButton(false);
                };
                reader.readAsText(file);

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

// The original startButton is now redundant if you have a combined Play/Pause button
startButton.addEventListener('click', startPlayback);

playPauseBtn.addEventListener('click', () => {
    if (playbackIntervalId) {
        pausePlayback();
    } else {
        startPlayback();
    }
});
prevBtn.addEventListener('click', goToPrevMove);
nextBtn.addEventListener('click', goToNextMove);
resetBtn.addEventListener('click', stopPlayback);