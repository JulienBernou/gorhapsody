// music_engine.js

// --- Audio Context Initialization ---
// Ensures Tone.js starts only after user interaction, crucial for browser compatibility.
let audioContextStarted = false;

function startAudioContext() {
    if (!audioContextStarted) {
        Tone.start().then(() => {
            console.log("AudioContext started!");
            audioContextStarted = true;
            // Tone.Transport is needed if you plan to use Tone.js's scheduling features like LFOs or sequences.
            // Keeping it here in case future complexity is added.
            Tone.Transport.start();
        }).catch(e => {
            console.error("Error starting AudioContext:", e);
        });
    }
}

// Attach event listeners to start audio context on user interaction
document.documentElement.addEventListener('mousedown', startAudioContext);
document.documentElement.addEventListener('keydown', startAudioContext);
document.documentElement.addEventListener('touchstart', startAudioContext);


// --- Instruments ---

// 1. Marimba/Xylophone like sound (for White's Normal Move, Central Moves, and game state changes)
const marimbaSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
        type: "sine" // Pure sine wave for a clean, mellow sound
    },
    envelope: {
        attack: 0.005,    // Very fast attack for mallet feel
        decay: 0.3,       // Short decay
        sustain: 0.01,    // Minimal sustain
        release: 0.8      // Smooth release
    },
    filter: { // A low-pass filter to soften the sound, making it less harsh
        type: "lowpass",
        frequency: 3200, // Cut off higher frequencies
        rolloff: -24     // Steeper rolloff for a smoother filter
    },
    volume: -10          // Base volume for this synth
}).toDestination();

// 2. Membrane Synth: For a distinct, percussive "thump" (Capture moves)
const membraneSynth = new Tone.MembraneSynth({
    pitchDecay: 0.06,    // Rate at which pitch drops after initial attack
    octaves: 1.0,        // Range of pitch drop
    oscillator: {
        type: "sine"     // Pure sine for a clean, resonant hit
    },
    envelope: {
        attack: 0.001,
        decay: 0.4,      // Moderate decay for a clear 'thump'
        sustain: 0.01,
        release: 1.0,
        attackCurve: 'exponential'
    },
    volume: -7          // Base volume for this synth
}).toDestination();

// 3. Gentle Synth: A softer, more "fengshui" mallet sound.
// Now used for Black's Normal Move, and also for tension/contact sounds.
const gentleSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
        type: "triangle" // Slightly softer wave than sine
    },
    envelope: {
        attack: 0.002, // Very fast, but slightly less punch than pluck
        decay: 0.2,    // Shorter decay
        sustain: 0.005, // Minimal sustain
        release: 0.6    // Gentle release
    },
    filter: {
        type: "lowpass",
        frequency: 2800, // Softer filter
        rolloff: -12
    },
    volume: -12 // Even quieter by default
}).toDestination();


// --- Effects ---

// Master Reverb: Provides a spacious, echoing environment for all sounds.
// Tuned for a natural, slightly long decay like a quiet, open space.
const masterReverb = new Tone.Reverb({
    decay: 4.5,       // Longer decay for noticeable echo
    preDelay: 0.08,   // Short pre-delay for a sense of space
    wet: 0.5          // Moderate wet signal to blend original and reverbed sound
}).toDestination();

// Connect all instruments to the master reverb
marimbaSynth.connect(masterReverb);
membraneSynth.connect(masterReverb);
gentleSynth.connect(masterReverb);


// --- Musical Scales and Notes ---
// A C Major Pentatonic scale (C, D, E, G, A) known for its calming, "zen" quality.
// Expanded to cover multiple octaves for variety.
const zenNotes = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
// Notes intended to create subtle tension within the zen framework (chromatic steps).
const tensionNotes = ["C#4", "Eb4", "F#4", "A#4", "B4"];

// --- State for Pitch Tracking ---
// Tracks consecutive distance-1 moves for pitch progression
const PITCH_INCREMENT_SEMITONES = 2; // Increase pitch by a whole step (2 semitones)
const MAX_PITCH_OFFSET = 12; // Max 1 octave increase from base note index

// Base note indices for each player within the zenNotes scale
const BLACK_BASE_ZEN_INDEX = 0; // C3
const WHITE_BASE_ZEN_INDEX = 6; // C4

const pitchState = {
    'B': {
        consecutiveDist1: 0,
        currentPitchOffset: 0,
        currentZenNoteIndex: BLACK_BASE_ZEN_INDEX,
        lastPlayedNote: null
    },
    'W': {
        consecutiveDist1: 0,
        currentPitchOffset: 0,
        currentZenNoteIndex: WHITE_BASE_ZEN_INDEX,
        lastPlayedNote: null
    }
};

// --- Helper to get notes from scale with offset ---
// This function now specifically applies pitchOffsetSemitones on top of the
// current note determined by the melodic progression (currentZenNoteIndex).
function getNoteFromZenScale(playerColor, pitchOffsetSemitones) {
    const playerState = pitchState[playerColor];
    const baseMidiNote = Tone.Frequency(zenNotes[playerState.currentZenNoteIndex]).toMidi();
    const finalMidiNote = baseMidiNote + pitchOffsetSemitones;

    // Convert back to a note string (e.g., "C4", "D#4")
    return Tone.Frequency(finalMidiNote, "midi").toNote();
}

// --- Main Musical Cue Playback Function ---

/**
 * Plays a musical cue based on the analysis report from the Go game.
 * Ensures the audio context is active and handles various move types.
 * @param {object} report - The analysis report for the current move. Can be null for initial state or passes.
 */
function playMusicalCue(report) {
    if (!audioContextStarted) {
        console.warn("AudioContext not yet started. Click/tap anywhere on the page to enable audio.");
        return; // Do nothing if audio isn't ready
    }

    // Handle null or undefined reports gracefully (e.g., at game start or reset before first move)
    if (!report) {
        console.log("No analysis report received for musical cue (e.g., initial board state).");
        return; // Exit without playing sound
    }

    let instrument = gentleSynth; // Default instrument is now gentleSynth
    let baseVolume = -15;        // Default base volume in dB for subtle background sounds
    let duration = "8n";         // Default note duration (eighth note)
    let noteToPlay = null;

    const player = report.player;
    const isPlayerMove = (player === 'B' || player === 'W'); // True if it's a Black or White stone placement

    // --- Reset Logic for Pitch State (Consecutive Distance 1 & Melodic Progression) ---
    // This complex logic ensures streaks are broken correctly when players alternate,
    // or when special game events occur.
    if (report.type === 'Pass' || report.type === 'ResetGame' || report.type === 'FinishedGame') {
        // Full reset for both players on these global game state changes
        pitchState['B'] = { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: BLACK_BASE_ZEN_INDEX, lastPlayedNote: null };
        pitchState['W'] = { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: WHITE_BASE_ZEN_INDEX, lastPlayedNote: null };
    } else if (isPlayerMove) {
        // If current player is B and last played was W, reset W's state
        if (player === 'B' && pitchState['W'].lastPlayedNote !== null) {
            pitchState['W'].consecutiveDist1 = 0;
            pitchState['W'].currentPitchOffset = 0;
            pitchState['W'].currentZenNoteIndex = WHITE_BASE_ZEN_INDEX; // Reset melodic index
            pitchState['W'].lastPlayedNote = null;
        }
        // If current player is W and last played was B, reset B's state
        else if (player === 'W' && pitchState['B'].lastPlayedNote !== null) {
            pitchState['B'].consecutiveDist1 = 0;
            pitchState['B'].currentPitchOffset = 0;
            pitchState['B'].currentZenNoteIndex = BLACK_BASE_ZEN_INDEX; // Reset melodic index
            pitchState['B'].lastPlayedNote = null;
        }
    }

    // --- Update currentPitchOffset based on distance_from_previous_friendly_stone (BEFORE switch) ---
    // This state update happens for all relevant player moves, even if the pitchOffset isn't *applied*
    // for a specific move type (like 'Contact Move').
    let currentPitchOffsetFromDist1 = 0;
    if (isPlayerMove) {
        let playerState = pitchState[player];
        const distance = report.distance_from_previous_friendly_stone;

        if (distance === 1.0) {
            playerState.consecutiveDist1++;
            playerState.currentPitchOffset = Math.min(
                playerState.currentPitchOffset + PITCH_INCREMENT_SEMITONES,
                MAX_PITCH_OFFSET
            );
        } else {
            // Reset consecutive distance 1 streak if not 1.0
            playerState.consecutiveDist1 = 0;
            playerState.currentPitchOffset = 0;
        }
        currentPitchOffsetFromDist1 = playerState.currentPitchOffset; // Store for use in switch
    }


    // Select instrument, note, and volume based on the report type
    switch (report.type) {
        case 'Capture':
            instrument = membraneSynth;
            noteToPlay = zenNotes[0]; // C3
            baseVolume = -3;
            duration = "0.4s";
            break;
        case 'Atari':
            instrument = gentleSynth;
            const atariNote1 = tensionNotes[Math.floor(Math.random() * tensionNotes.length)] || zenNotes[zenNotes.length - 1];
            const atariNote2 = Tone.Frequency(atariNote1).transpose(7).toNote();
            baseVolume = -6;

            instrument.triggerAttackRelease(atariNote1, "8n", Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(atariNote2, "16n");
            }, Tone.now() + Tone.Time("16n").toSeconds());
            return;
        case 'Atari Threat':
            instrument = gentleSynth;
            const threatNote1 = zenNotes[Math.floor(Math.random() * zenNotes.length)];
            const threatNote2 = Tone.Frequency(threatNote1).transpose(3).toNote();
            baseVolume = -8;

            instrument.triggerAttackRelease(threatNote1, "16n", Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(threatNote2, "16n");
            }, Tone.now() + Tone.Time("32n").toSeconds());
            return;
        case 'Contact Move':
            instrument = gentleSynth;
            // !!! PITCH CHANGE REMOVED FOR CONTACT MOVE !!!
            // We still use the zen note sequence, but WITHOUT the distance-1 pitch offset.
            if (player === 'B') {
                noteToPlay = getNoteFromZenScale('B', 0); // Pass 0 for pitchOffsetSemitones
            } else if (player === 'W') {
                noteToPlay = getNoteFromZenScale('W', 0); // Pass 0 for pitchOffsetSemitones
            }
            // !!! ACCENT CREATED WITH VOLUME !!!
            baseVolume = -5; // Significantly louder for an accent
            duration = "8n";
            break;
        case 'Central Move':
            instrument = marimbaSynth;
            if (player === 'B') {
                noteToPlay = getNoteFromZenScale('B', currentPitchOffsetFromDist1);
            } else if (player === 'W') {
                noteToPlay = getNoteFromZenScale('W', currentPitchOffsetFromDist1);
            }
            baseVolume = -9;
            duration = "0.3s";
            break;
        case 'Normal Move':
            baseVolume = -16;
            duration = "8n";

            if (player === 'B') {
                instrument = gentleSynth;
                noteToPlay = getNoteFromZenScale('B', currentPitchOffsetFromDist1);
            } else if (player === 'W') {
                instrument = marimbaSynth;
                noteToPlay = getNoteFromZenScale('W', currentPitchOffsetFromDist1);
            } else {
                console.warn("Player information missing or invalid for Normal Move. Playing a default C4 with gentleSynth.");
                instrument = gentleSynth;
                noteToPlay = "C4";
                currentPitchOffsetFromDist1 = 0; // Reset offset for invalid player
            }
            break;
        case 'ResetGame':
            // Reset logic already handled at the top
            marimbaSynth.triggerAttackRelease(["C3", "E3", "G3", "C4"], "2s", Tone.now(), 0.8);
            return;
        case 'FinishedGame':
            // Reset logic already handled at the top
            marimbaSynth.triggerAttackRelease(["C4", "A3", "F3", "D3"], "2s", Tone.now(), 0.8);
            return;
        case 'Pass':
            // Reset logic already handled at the top
            return;
        default:
            // Fallback for any unhandled or new move types
            instrument = gentleSynth;
            noteToPlay = getNoteFromZenScale('B', 0); // Default to Black's base with no offset
            baseVolume = -18;
            duration = "8n";
            currentPitchOffsetFromDist1 = 0;
            break;
    }

    // Final check before playing, ensuring a valid note and volume
    if (noteToPlay && typeof baseVolume === 'number') {
        instrument.volume.rampTo(baseVolume, 0.01);
        instrument.triggerAttackRelease(noteToPlay, duration);

        if (isPlayerMove) {
            // Update the last played note for the current player
            pitchState[player].lastPlayedNote = noteToPlay;

            // Increment the currentZenNoteIndex for the *next* move by this player
            // This creates the consecutive pitch sequence
            if (player === 'B') {
                pitchState['B'].currentZenNoteIndex = (pitchState['B'].currentZenNoteIndex + 1) % zenNotes.length;
            } else if (player === 'W') {
                pitchState['W'].currentZenNoteIndex = (pitchState['W'].currentZenNoteIndex + 1) % zenNotes.length;
            }
        }
    } else {
        console.warn(`Attempted to play a musical cue with invalid note or volume: Note: ${noteToPlay}, Volume: ${baseVolume}, Report:`, report);
    }
}