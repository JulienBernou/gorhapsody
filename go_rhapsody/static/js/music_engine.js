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
// pluckSynth is removed here too.
marimbaSynth.connect(masterReverb);
membraneSynth.connect(masterReverb);
gentleSynth.connect(masterReverb);


// --- Musical Scales and Notes ---
// A C Major Pentatonic scale (C, D, E, G, A) known for its calming, "zen" quality.
// Expanded to cover multiple octaves for variety.
const zenNotes = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5"]; 
// Notes intended to create subtle tension within the zen framework (chromatic steps).
const tensionNotes = ["C#4", "Eb4", "F#4", "A#4", "B4"]; 


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

    let noteToPlay = null; 
    let instrument = gentleSynth; // Default instrument is now gentleSynth
    let baseVolume = -15;        // Default base volume in dB for subtle background sounds
    let duration = "8n";         // Default note duration (eighth note)

    // Select instrument, note, and volume based on the report type
    switch (report.type) {
        case 'Capture':
            instrument = membraneSynth; // Still membraneSynth for distinct thump
            noteToPlay = zenNotes[0];  // C3, a lower, more impactful note
            baseVolume = -3;           // Louder for emphasis
            duration = "0.4s";         // Slightly longer duration
            break;
        case 'Atari':
            instrument = gentleSynth; // Now using gentleSynth for tension
            // Play two notes quickly to create tension
            const atariNote1 = tensionNotes[Math.floor(Math.random() * tensionNotes.length)] || zenNotes[zenNotes.length - 1];
            const atariNote2 = Tone.Frequency(atariNote1).transpose(7).toNote(); // A perfect fifth up
            baseVolume = -6;
            
            instrument.triggerAttackRelease(atariNote1, "8n", Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(atariNote2, "16n"); // Second note quicker
            }, Tone.now() + Tone.Time("16n").toSeconds());
            return; // Exit here as notes are scheduled
        case 'Atari Threat':
            instrument = gentleSynth; // Now using gentleSynth for tension
            // Play two notes quickly for rising tension
            const threatNote1 = zenNotes[Math.floor(Math.random() * zenNotes.length)];
            const threatNote2 = Tone.Frequency(threatNote1).transpose(3).toNote(); // A minor third up
            baseVolume = -8;
            
            instrument.triggerAttackRelease(threatNote1, "16n", Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(threatNote2, "16n");
            }, Tone.now() + Tone.Time("32n").toSeconds());
            return; // Exit here as notes are scheduled
        case 'Contact Move':
            instrument = gentleSynth; // Now using gentleSynth for direct interaction
            noteToPlay = zenNotes[3]; // G3, a slightly higher, clear pluck
            baseVolume = -10;
            duration = "8n";
            break;
        case 'Central Move': 
            instrument = marimbaSynth; // Still marimba for harmonious central moves
            noteToPlay = zenNotes[6]; // E4, a bright, central note
            baseVolume = -9;
            duration = "0.3s";
            break;
        case 'Normal Move': 
            baseVolume = -16; 
            duration = "8n";  

            // Determine instrument AND note based on player
            if (report.player === 'B') {
                instrument = gentleSynth; // Black player uses the soft gentleSynth
                noteToPlay = zenNotes[Math.floor(Math.random() * 7)]; 
            } else if (report.player === 'W') {
                instrument = marimbaSynth; // White player uses marimbaSynth
                noteToPlay = zenNotes[Math.floor(Math.random() * 4) + 7]; 
            } else {
                // Fallback if player information is missing or unexpected
                console.warn("Player information missing or invalid for Normal Move. Playing a default C4 with gentleSynth.");
                instrument = gentleSynth; // Default instrument is the softer one
                noteToPlay = "C4"; 
            }
            break;
        case 'ResetGame': 
            marimbaSynth.triggerAttackRelease(["C3", "E3", "G3", "C4"], "2s", Tone.now(), 0.8);
            return; 
        case 'FinishedGame': 
            marimbaSynth.triggerAttackRelease(["C4", "A3", "F3", "D3"], "2s", Tone.now(), 0.8);
            return; 
        case 'Pass': 
            // Explicitly no sound for pass moves, contributes to zen feel
            return; 
        default:
            // Fallback for any unhandled or new move types
            instrument = gentleSynth; // Use gentleSynth for unknown types
            noteToPlay = zenNotes[Math.floor(Math.random() * zenNotes.length)];
            baseVolume = -18; // Very subtle
            duration = "8n";
    }

    // Final check before playing, ensuring a valid note and volume
    if (noteToPlay && typeof baseVolume === 'number') {
        // Smoothly ramp the volume to the target level to avoid clicks/pops
        instrument.volume.rampTo(baseVolume, 0.01); // Very quick ramp (10ms)
        instrument.triggerAttackRelease(noteToPlay, duration);
    } else {
        console.warn(`Attempted to play a musical cue with invalid note or volume: Note: ${noteToPlay}, Volume: ${baseVolume}`);
    }
}