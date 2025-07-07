// music_engine.js
// Ensure AudioContext starts on user interaction
document.documentElement.addEventListener('mousedown', () => {
    if (Tone.context.state !== 'running') {
        Tone.start(); // Changed from Tone.context.resume() to Tone.start()
        console.log("AudioContext started!");
    }
}, { once: true }); // Add { once: true } for efficiency

// Define your Tone.js instruments and effects here
// Let's start with a few basic synths
const synthLead = new Tone.Synth({
    oscillator: { type: "sawtooth" },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.8,
    },
    volume: 5 // INCREASE THIS for testing!
}).toDestination();

const synthPad = new Tone.PolySynth(Tone.Synth, { // PolySynth for chords
    oscillator: { type: "sine" },
    envelope: {
        attack: 1,      // Longer attack for a pad sound
        decay: 0.5,
        sustain: 0.5,
        release: 1,     // Longer release for fade out
    },
    volume: -0 // Set to 0 or even positive for testing, -10 was quiet
}).toDestination();

const drumKick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 10,
    envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.5,
    },
    oscillator: { type: "sine" },
    volume: 5 // INCREASE THIS for testing!
}).toDestination();

const drumSnare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
    },
    volume: 5 // INCREASE THIS for testing!
}).chain(new Tone.Filter(8000, "lowpass"), Tone.Destination);


// Global NoiseSynth for illegal moves (more efficient than creating every time)
const illegalMoveNoise = new Tone.NoiseSynth({
    noise: { type: "pink" }, // A bit richer than white noise
    envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0,
        release: 0.5
    },
    volume: 8 // Make it noticeable
}).toDestination();


// Main function to interpret Go analysis and play music
function playMusicalCue(analysisReport) {
    // Remove the testSynth code you added previously
    // if (Tone.context.state === 'running') {
    //     const testSynth = new Tone.MembraneSynth({ ... }).toDestination();
    //     testSynth.triggerAttackRelease("C4", "0.5s", Tone.now());
    //     console.log("Played temporary test sound!");
    // }

    // Add checks for Tone.js context and instrument readiness,
    // though the 'mousedown' listener and loading order should largely prevent issues.
    if (Tone.context.state !== 'running') {
        console.warn("Tone.js audio context not running. Cannot play musical cue.");
        return;
    }
    // You might also want to check if the individual synths are initialized,
    // but if the DOMContentLoaded listener runs, they should be.

    console.log("Musical Cue for:", analysisReport);

    const player = analysisReport.player; // 'B' or 'W'
    const coords = analysisReport.coords; // [r, c] or null
    const type = analysisReport.type; // 'Normal Move', 'Capture', 'Pass', 'Illegal Move'
    const musicalIntensity = analysisReport.musical_intensity || 'background_pulse'; // Default if not set

    let baseMidi = player === 'B' ? Tone.Midi('C4').toMidi() : Tone.Midi('G4').toMidi();
    if (coords) {
        baseMidi += (coords[0] % 7) + (coords[1] % 5);
    }
    const baseFrequency = Tone.Midi(baseMidi).toFrequency(); // Convert only at the end

    const now = Tone.now(); // Get current Tone.js time for precise scheduling

    // --- Musical Mappings ---
    switch (musicalIntensity) {
        case 'percussive_hit':
            console.log("  - Musical: Percussive hit (Capture)");
            drumKick.triggerAttackRelease("C2", "8n", now);
            drumSnare.triggerAttackRelease("8n", now + 0.05);
            synthLead.triggerAttackRelease(Tone.Midi(baseMidi + 7).toFrequency(), '8n', now, 0.9);
            break;
        case 'high_tension':
            console.log("  - Musical: High tension (Atari/Self-Atari)");
            synthLead.triggerAttackRelease(Tone.Midi(baseMidi + 5).toFrequency(), '16n', now, 0.8);
            synthLead.triggerAttackRelease(Tone.Midi(baseMidi + 8).toFrequency(), '16n', now + 0.15, 0.8);
            // Increased duration for pad to make it more noticeable
            synthPad.triggerAttackRelease([Tone.Midi(baseMidi - 12).toFrequency(), Tone.Midi(baseMidi).toFrequency()], '1n', now, 0.6); // Changed from '4n' to '1n'
            break;
        case 'background_pulse':
            console.log("  - Musical: Background pulse (Normal Move)");
            // Increased duration and velocity for pulse
            synthPad.triggerAttackRelease(Tone.Midi(baseMidi - 12).toFrequency(), '4n', now, 0.6); // Changed from '8n' to '4n', velocity from 0.4 to 0.6
            break;
        default:
            if (type === 'Pass') {
                console.log("  - Musical: Ambient fade (Pass)");
                synthPad.triggerAttackRelease(['C3', 'E3', 'G3'], '2n', now, 0.5); // Increased velocity
            } else if (type === 'Illegal Move') {
                console.log("  - Musical: Harsh noise (Illegal Move)");
                // Now using the globally defined illegalMoveNoise synth
                illegalMoveNoise.triggerAttackRelease('8n', now, 1.0);
            } else {
                console.log("  - Musical: Default subtle sound.");
                synthLead.triggerAttackRelease(baseFrequency, '8n', now, 0.8); // Increased duration to '8n', velocity from 0.6 to 0.8
            }
            break;
    }
}